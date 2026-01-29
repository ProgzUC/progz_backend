import ClassSession from "../models/ClassSession.js";
import Batch from "../models/Batch.js";
import User from "../models/User.js";

/**
 * @desc    Start a new class session
 * @route   POST /api/class-session/start
 * @access  Private (Trainer)
 */
export async function startClass(req, res) {
    try {
        const { batchId } = req.body;
        const trainerId = req.user.id;

        // Validate batch
        const batch = await Batch.findById(batchId).populate("students").lean();
        if (!batch) {
            return res.status(404).json({ message: "Batch not found" });
        }

        // Check if trainer is assigned to this batch
        const isTrainerAssigned = batch.trainers.some(
            (t) => String(t.trainer) === String(trainerId)
        );
        if (!isTrainerAssigned) {
            return res.status(403).json({ message: "You are not assigned to this batch" });
        }

        // Check if there's already an active session (no endTime)
        const activeSession = await ClassSession.findOne({
            batch: batchId,
            endTime: null,
        });

        if (activeSession) {
            return res.status(400).json({
                message: "There is already an active class session for this batch",
                session: activeSession,
            });
        }

        // Create attendance array with all students marked as Absent
        const attendance = batch.students.map((student) => ({
            student: student._id,
            status: "Absent",
        }));

        // Create new class session
        const session = await ClassSession.create({
            batch: batchId,
            trainer: trainerId,
            date: new Date(),
            startTime: new Date(),
            attendance,
        });

        // Populate and return
        const populatedSession = await ClassSession.findById(session._id)
            .populate("batch", "name")
            .populate("trainer", "name email")
            .populate("attendance.student", "name email");

        res.status(201).json(populatedSession);
    } catch (error) {
        console.error("Start class error:", error);
        res.status(500).json({ message: "Failed to start class session" });
    }
}

/**
 * @desc    Mark attendance for students
 * @route   PATCH /api/class-session/:id/attendance
 * @access  Private (Trainer)
 */
export async function markAttendance(req, res) {
    try {
        const { id } = req.params;
        const { attendance } = req.body; // [{ studentId, status }]

        if (!Array.isArray(attendance)) {
            return res.status(400).json({ message: "Attendance must be an array" });
        }

        // Find session
        const session = await ClassSession.findById(id);
        if (!session) {
            return res.status(404).json({ message: "Class session not found" });
        }

        // Verify trainer owns this session
        if (String(session.trainer) !== String(req.user.id)) {
            return res.status(403).json({ message: "Not authorized to modify this session" });
        }

        // Update attendance
        attendance.forEach((attendanceUpdate) => {
            const entry = session.attendance.find(
                (e) => String(e.student) === String(attendanceUpdate.studentId)
            );
            if (entry) {
                // Validate status
                if (["Present", "Absent", "Late"].includes(attendanceUpdate.status)) {
                    entry.status = attendanceUpdate.status;
                }
            }
        });

        await session.save();

        // Return populated session
        const populatedSession = await ClassSession.findById(session._id)
            .populate("batch", "name")
            .populate("trainer", "name email")
            .populate("attendance.student", "name email");

        res.json(populatedSession);
    } catch (error) {
        console.error("Mark attendance error:", error);
        res.status(500).json({ message: "Failed to mark attendance" });
    }
}

/**
 * @desc    End a class session
 * @route   PATCH /api/class-session/:id/end
 * @access  Private (Trainer)
 */
export async function endClass(req, res) {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        // Find session
        const session = await ClassSession.findById(id);
        if (!session) {
            return res.status(404).json({ message: "Class session not found" });
        }

        // Verify trainer owns this session
        if (String(session.trainer) !== String(req.user.id)) {
            return res.status(403).json({ message: "Not authorized to modify this session" });
        }

        // Check if already ended
        if (session.endTime) {
            return res.status(400).json({ message: "Class session already ended" });
        }

        // Update session
        session.endTime = new Date();
        if (notes) {
            session.notes = notes;
        }
        await session.save();

        // Calculate duration
        const duration = Math.floor((session.endTime - session.startTime) / 1000 / 60); // minutes

        // Return populated session with duration
        const populatedSession = await ClassSession.findById(session._id)
            .populate("batch", "name")
            .populate("trainer", "name email")
            .populate("attendance.student", "name email")
            .lean();

        res.json({
            ...populatedSession,
            duration: `${duration} minutes`,
        });
    } catch (error) {
        console.error("End class error:", error);
        res.status(500).json({ message: "Failed to end class session" });
    }
}

/**
 * @desc    Get class sessions for a batch
 * @route   GET /api/class-session/batch/:batchId
 * @access  Private (Trainer/Admin)
 */
export async function getClassSessions(req, res) {
    try {
        const { batchId } = req.params;
        const { startDate, endDate } = req.query;

        // Build query
        const query = { batch: batchId };

        // Add date filters if provided
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const sessions = await ClassSession.find(query)
            .populate("batch", "name")
            .populate("trainer", "name email")
            .populate("attendance.student", "name email")
            .sort({ date: -1 })
            .lean();

        // Add duration to each session
        const sessionsWithDuration = sessions.map((session) => {
            let duration = null;
            if (session.endTime) {
                const durationMinutes = Math.floor(
                    (new Date(session.endTime) - new Date(session.startTime)) / 1000 / 60
                );
                duration = `${durationMinutes} minutes`;
            }

            const presentCount = session.attendance.filter((a) => a.status === "Present").length;
            const absentCount = session.attendance.filter((a) => a.status === "Absent").length;
            const lateCount = session.attendance.filter((a) => a.status === "Late").length;

            return {
                ...session,
                duration,
                attendanceSummary: {
                    present: presentCount,
                    absent: absentCount,
                    late: lateCount,
                    total: session.attendance.length,
                },
            };
        });

        res.json({ sessions: sessionsWithDuration });
    } catch (error) {
        console.error("Get class sessions error:", error);
        res.status(500).json({ message: "Failed to fetch class sessions" });
    }
}

/**
 * @desc    Get attendance history for logged-in student
 * @route   GET /api/class-session/student/me
 * @access  Private (Student)
 */
export async function getStudentAttendance(req, res) {
    try {
        const studentId = req.user.id;

        // Find all batches the student is enrolled in
        const batches = await Batch.find({ students: studentId }).select("_id name").lean();
        const batchIds = batches.map((b) => b._id);

        // Find all sessions for these batches
        const sessions = await ClassSession.find({ batch: { $in: batchIds } })
            .populate("batch", "name")
            .populate("trainer", "name")
            .sort({ date: -1 })
            .lean();

        // Filter and format sessions for this student
        const attendanceHistory = [];
        let totalPresent = 0;
        let totalLate = 0;
        let totalAbsent = 0;

        sessions.forEach((session) => {
            const studentAttendance = session.attendance.find(
                (a) => String(a.student) === String(studentId)
            );

            if (studentAttendance) {
                let duration = null;
                if (session.endTime) {
                    const durationMinutes = Math.floor(
                        (new Date(session.endTime) - new Date(session.startTime)) / 1000 / 60
                    );
                    duration = `${durationMinutes} minutes`;
                }

                attendanceHistory.push({
                    sessionId: session._id,
                    date: session.date,
                    batchName: session.batch.name,
                    trainerName: session.trainer.name,
                    status: studentAttendance.status,
                    duration,
                    notes: session.notes,
                });

                // Count statuses
                if (studentAttendance.status === "Present") totalPresent++;
                else if (studentAttendance.status === "Late") totalLate++;
                else totalAbsent++;
            }
        });

        const totalSessions = attendanceHistory.length;
        const attendancePercentage =
            totalSessions > 0 ? Math.round(((totalPresent + totalLate) / totalSessions) * 100) : 0;

        res.json({
            attendanceHistory,
            summary: {
                totalSessions,
                present: totalPresent,
                late: totalLate,
                absent: totalAbsent,
                attendancePercentage,
            },
        });
    } catch (error) {
        console.error("Get student attendance error:", error);
        res.status(500).json({ message: "Failed to fetch attendance" });
    }
}

/**
 * @desc    Get attendance report for a batch
 * @route   GET /api/class-session/batch/:batchId/report
 * @access  Private (Admin/Trainer)
 */
export async function getBatchAttendanceReport(req, res) {
    try {
        const { batchId } = req.params;

        // Get batch with students
        const batch = await Batch.findById(batchId).populate("students", "name email").lean();
        if (!batch) {
            return res.status(404).json({ message: "Batch not found" });
        }

        // Get all sessions for this batch
        const sessions = await ClassSession.find({ batch: batchId }).lean();

        // Build report per student
        const studentReports = batch.students.map((student) => {
            let present = 0;
            let absent = 0;
            let late = 0;

            sessions.forEach((session) => {
                const attendance = session.attendance.find(
                    (a) => String(a.student) === String(student._id)
                );
                if (attendance) {
                    if (attendance.status === "Present") present++;
                    else if (attendance.status === "Late") late++;
                    else absent++;
                }
            });

            const totalSessions = sessions.length;
            const percentage =
                totalSessions > 0 ? Math.round(((present + late) / totalSessions) * 100) : 0;

            return {
                studentId: student._id,
                studentName: student.name,
                studentEmail: student.email,
                present,
                late,
                absent,
                totalSessions,
                attendancePercentage: percentage,
            };
        });

        res.json({
            batchName: batch.name,
            totalSessions: sessions.length,
            studentReports,
        });
    } catch (error) {
        console.error("Get batch attendance report error:", error);
        res.status(500).json({ message: "Failed to generate attendance report" });
    }
}
