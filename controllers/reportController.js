import Course from "../models/Course.js";
import User from "../models/User.js";
import Batch from "../models/Batch.js";
import ClassSession from "../models/ClassSession.js";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// @desc    Get operational summary (Executive KPIs)
// @route   GET /api/admin/reports/operational-summary
// @access  Private (Admin)
export const getOperationalSummary = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalTrainers = await User.countDocuments({ role: 'trainer' });
        const totalCourses = await Course.countDocuments();
        
        const activeTrainersDocs = await Batch.distinct("trainers.trainer", { status: "active" });
        const activeTrainers = activeTrainersDocs.length;

        const batches = await Batch.find().lean();
        const totalBatches = batches.length;
        const activeBatches = batches.filter(b => b.status === 'active').length;
        const completedBatches = batches.filter(b => b.status === 'completed').length;
        const upcomingBatches = batches.filter(b => b.status === 'upcoming').length;

        const activeStudentsDocs = await Batch.distinct("students", { status: "active" });
        const activeStudents = activeStudentsDocs.length;

        const pendingApprovals = await User.countDocuments({ role: 'student', status: 'inactive' });

        // Attendance & Sessions
        const sessions = await ClassSession.find().lean();
        const totalSessionsConducted = sessions.length;
        
        let totalPresent = 0;
        let totalAttendances = 0;
        let totalTeachingMinutes = 0;

        sessions.forEach(session => {
            if (session.attendance && session.attendance.length > 0) {
                session.attendance.forEach(a => {
                    totalAttendances++;
                    if (a.status === 'Present' || a.status === 'Late') {
                        totalPresent++;
                    }
                });
            }
            if (session.startTime && session.endTime) {
                totalTeachingMinutes += (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
            }
        });

        const overallAttendanceRate = totalAttendances > 0 ? Math.round((totalPresent / totalAttendances) * 100) : 0;
        const totalTeachingHours = Math.round(totalTeachingMinutes / 60);

        // Recent Sessions
        const recentSessionLogs = await ClassSession.find()
            .sort({ date: -1 })
            .limit(5)
            .populate("batch", "name")
            .populate("trainer", "name")
            .lean()
            .then(logs => logs.map(log => {
                 let presentCount = 0;
                 let total = log.attendance?.length || 0;
                 if (total > 0) {
                     presentCount = log.attendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
                 }
                 return {
                     id: log._id,
                     date: log.date,
                     batchName: log.batch?.name || 'Unknown',
                     trainerName: log.trainer?.name || 'Unknown',
                     attendanceRate: total > 0 ? Math.round((presentCount / total) * 100) : 0,
                     duration: log.endTime ? Math.round((new Date(log.endTime) - new Date(log.startTime)) / 60000) : null
                 };
            }));

        res.json({
            totalStudents, activeStudents, pendingApprovals,
            totalTrainers, activeTrainers,
            totalCourses,
            totalBatches, activeBatches, completedBatches, upcomingBatches,
            overallAttendanceRate, totalSessionsConducted, totalTeachingHours,
            recentSessionLogs
        });
    } catch (err) {
        console.error('getOperationalSummary error', err);
        res.status(500).json({ message: 'Failed to fetch operational summary' });
    }
};

// @desc    Get attendance analytics
// @route   GET /api/admin/reports/attendance-analytics
// @access  Private (Admin)
export const getAttendanceAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, batchId } = req.query;
        let query = {};
        
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }
        if (batchId) {
            query.batch = batchId;
        }

        const sessions = await ClassSession.find(query).populate('batch', 'name course').populate('attendance.student', 'name email').lean();
        
        let totalRecordedAttendances = 0;
        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;

        // Trend over time (monthly grouping for simplicity)
        const trendMap = {};

        // Batch Comparison
        const batchMap = {};
        
        // At Risk Students
        const studentMap = {};

        sessions.forEach(session => {
            const batchName = session.batch?.name || 'Unknown';
            const bId = String(session.batch?._id || 'unknown');
            
            if (!batchMap[bId]) {
                batchMap[bId] = { batchId: bId, batchName, totalSessions: 0, totalAttendances: 0, presentLateCount: 0 };
            }
            batchMap[bId].totalSessions++;

            // For trend
            const monthKey = new Date(session.date).toISOString().slice(0, 7); // YYYY-MM
            if (!trendMap[monthKey]) trendMap[monthKey] = { date: monthKey, total: 0, presentLate: 0, sessionCount: 0 };
            trendMap[monthKey].sessionCount++;

            if (session.attendance) {
                session.attendance.forEach(a => {
                    totalRecordedAttendances++;
                    batchMap[bId].totalAttendances++;
                    trendMap[monthKey].total++;
                    
                    const sId = String(a.student?._id || 'unknown');
                    if (!studentMap[sId]) {
                        studentMap[sId] = { 
                            studentId: sId, 
                            name: a.student?.name || 'Unknown', 
                            email: a.student?.email || 'Unknown',
                            batchName: batchName,
                            present: 0, late: 0, absent: 0, total: 0 
                        };
                    }
                    studentMap[sId].total++;

                    if (a.status === 'Present') {
                        presentCount++;
                        batchMap[bId].presentLateCount++;
                        trendMap[monthKey].presentLate++;
                        studentMap[sId].present++;
                    } else if (a.status === 'Late') {
                        lateCount++;
                        batchMap[bId].presentLateCount++;
                        trendMap[monthKey].presentLate++;
                        studentMap[sId].late++;
                    } else {
                        absentCount++;
                        studentMap[sId].absent++;
                    }
                });
            }
        });

        const overallAttendanceRate = totalRecordedAttendances > 0 ? Math.round(((presentCount + lateCount) / totalRecordedAttendances) * 100) : 0;
        
        const statusDistribution = [
            { name: 'Present', count: presentCount, percentage: totalRecordedAttendances > 0 ? Math.round((presentCount/totalRecordedAttendances)*100) : 0 },
            { name: 'Late', count: lateCount, percentage: totalRecordedAttendances > 0 ? Math.round((lateCount/totalRecordedAttendances)*100) : 0 },
            { name: 'Absent', count: absentCount, percentage: totalRecordedAttendances > 0 ? Math.round((absentCount/totalRecordedAttendances)*100) : 0 }
        ];

        const trendOverTime = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date)).map(t => ({
            date: t.date,
            attendanceRate: t.total > 0 ? Math.round((t.presentLate / t.total) * 100) : 0,
            sessionCount: t.sessionCount
        }));

        const batchComparison = Object.values(batchMap).map(b => ({
            ...b,
            avgAttendancePercentage: b.totalAttendances > 0 ? Math.round((b.presentLateCount / b.totalAttendances) * 100) : 0,
            isAtRisk: b.totalAttendances > 0 && Math.round((b.presentLateCount / b.totalAttendances) * 100) < 75
        }));

        const atRiskStudents = Object.values(studentMap)
            .map(s => ({
                ...s,
                attendancePercentage: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0
            }))
            .filter(s => s.attendancePercentage < 75 && s.total >= 3); // Must have at least 3 sessions to be flagged

        res.json({
            summary: {
                totalSessions: sessions.length,
                totalRecordedAttendances,
                presentCount,
                lateCount,
                absentCount,
                overallAttendanceRate
            },
            statusDistribution,
            trendOverTime,
            batchComparison,
            atRiskStudents
        });

    } catch (err) {
        console.error('getAttendanceAnalytics error', err);
        res.status(500).json({ message: 'Failed to fetch attendance analytics' });
    }
};

// @desc    Get enrollment analytics
// @route   GET /api/admin/reports/enrollment-analytics
// @access  Private (Admin)
export const getEnrollmentAnalytics = async (req, res) => {
    try {
        const courses = await Course.find().populate('enrolledStudents.student').lean();
        
        let totalEnrollments = 0;
        let activeCount = 0;
        let completedCount = 0;
        const courseDistribution = [];

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const trendMap = {};

        for (let i = 0; i < 12; i++) {
            const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            trendMap[key] = { month: MONTH_NAMES[d.getMonth()], year: d.getFullYear(), value: 0 };
        }

        courses.forEach(c => {
            const enrolled = c.enrolledStudents || [];
            totalEnrollments += enrolled.length;
            
            let cActive = 0;
            let cCompleted = 0;

            enrolled.forEach(e => {
                if (e.courseCompleted) {
                    completedCount++;
                    cCompleted++;
                } else {
                    activeCount++;
                    cActive++;
                }

                if (e.enrolledDate && e.enrolledDate >= start) {
                    const key = `${e.enrolledDate.getFullYear()}-${String(e.enrolledDate.getMonth()+1).padStart(2,'0')}`;
                    if (trendMap[key]) {
                        trendMap[key].value++;
                    }
                }
            });

            courseDistribution.push({
                courseId: c._id,
                courseName: c.courseName,
                totalEnrollments: enrolled.length,
                activeCount: cActive,
                completedCount: cCompleted,
                completionRate: enrolled.length > 0 ? Math.round((cCompleted / enrolled.length) * 100) : 0
            });
        });

        const trends = Object.keys(trendMap).sort().map(k => ({
            month: `${trendMap[k].month} ${trendMap[k].year}`,
            value: trendMap[k].value
        }));

        const batches = await Batch.find().lean();
        const batchCapacity = {
            totalBatches: batches.length,
            avgStudentsPerBatch: batches.length > 0 ? Math.round(activeCount / batches.length) : 0,
            batchList: batches.map(b => ({
                name: b.name,
                studentsCount: b.students?.length || 0,
                status: b.status
            }))
        };

        const registeredUsers = await User.countDocuments({ role: 'student' });
        const conversionFunnel = [
            { stage: 'Registered Users', count: registeredUsers },
            { stage: 'Enrolled in Course', count: totalEnrollments },
            { stage: 'Assigned to Batch', count: activeCount }, 
            { stage: 'Completed Course', count: completedCount }
        ];

        res.json({
            trends,
            courseDistribution,
            batchCapacity,
            conversionFunnel
        });

    } catch (err) {
        console.error('getEnrollmentAnalytics error', err);
        res.status(500).json({ message: 'Failed to fetch enrollment analytics' });
    }
};

// @desc    Get trainer utilization
// @route   GET /api/admin/reports/trainer-utilization
// @access  Private (Admin)
export const getTrainerUtilization = async (req, res) => {
    try {
        const trainersDocs = await User.find({ role: 'trainer' }).lean();
        const batches = await Batch.find().lean();
        const sessions = await ClassSession.find().lean();

        let totalTeachingHours = 0;

        const trainers = trainersDocs.map(trainer => {
            const tId = String(trainer._id);
            const trainerBatches = batches.filter(b => b.trainers?.some(t => String(t.trainer) === tId));
            
            const activeBatchesCount = trainerBatches.filter(b => b.status === 'active').length;
            const completedBatchesCount = trainerBatches.filter(b => b.status === 'completed').length;
            
            const trainerSessions = sessions.filter(s => String(s.trainer) === tId);
            
            let teachingMinutes = 0;
            let presentCount = 0;
            let totalAttendances = 0;

            trainerSessions.forEach(s => {
                if (s.startTime && s.endTime) {
                    teachingMinutes += (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60);
                }
                if (s.attendance) {
                    s.attendance.forEach(a => {
                        totalAttendances++;
                        if (a.status === 'Present' || a.status === 'Late') presentCount++;
                    });
                }
            });

            totalTeachingHours += (teachingMinutes / 60);

            return {
                trainerId: tId,
                name: trainer.name,
                email: trainer.email,
                activeBatchesCount,
                completedBatchesCount,
                totalSessionsConducted: trainerSessions.length,
                totalHoursTaught: (teachingMinutes / 60).toFixed(1),
                avgStudentAttendanceRate: totalAttendances > 0 ? Math.round((presentCount / totalAttendances) * 100) : 0
            };
        });

        res.json({
            trainers,
            workloadSummary: {
                totalTeachingHours: Math.round(totalTeachingHours),
                avgHoursPerTrainer: trainers.length > 0 ? Math.round(totalTeachingHours / trainers.length) : 0
            }
        });

    } catch (err) {
        console.error('getTrainerUtilization error', err);
        res.status(500).json({ message: 'Failed to fetch trainer utilization' });
    }
};

// @desc    Get batch health
// @route   GET /api/admin/reports/batch-health
// @access  Private (Admin)
export const getBatchHealthReport = async (req, res) => {
    try {
        const batchesDocs = await Batch.find().populate('course').lean();
        const sessions = await ClassSession.find().lean();

        const lifecycleBreakdown = {
            upcoming: 0, active: 0, completed: 0, cancelled: 0, 'on-hold': 0
        };

        const batches = batchesDocs.map(b => {
            if (lifecycleBreakdown[b.status] !== undefined) {
                lifecycleBreakdown[b.status]++;
            }

            const batchSessions = sessions.filter(s => String(s.batch) === String(b._id));
            let totalAttendances = 0;
            let presentCount = 0;

            batchSessions.forEach(s => {
                if (s.attendance) {
                    s.attendance.forEach(a => {
                        totalAttendances++;
                        if (a.status === 'Present' || a.status === 'Late') presentCount++;
                    });
                }
            });

            const attendanceRate = totalAttendances > 0 ? Math.round((presentCount / totalAttendances) * 100) : 0;
            let healthStatus = 'healthy';
            if (b.status === 'active') {
                if (attendanceRate < 50) healthStatus = 'at-risk';
                else if (attendanceRate < 75) healthStatus = 'needs-attention';
            } else {
                 healthStatus = 'neutral';
            }

            const completedSections = b.sectionProgress?.filter(sp => sp.isCompleted).length || 0;
            const totalSections = b.course?.modules?.reduce((acc, m) => acc + (m.sections?.length || 0), 0) || 10;
            const progressPercentage = Math.round((completedSections / Math.max(totalSections, 1)) * 100);

            return {
                batchId: b._id,
                name: b.name,
                courseName: b.course?.courseName || 'Unknown',
                status: b.status,
                studentsCount: b.students?.length || 0,
                sessionsCompleted: batchSessions.length,
                attendanceRate,
                healthStatus,
                progressPercentage
            };
        });

        res.json({
            batches,
            lifecycleBreakdown
        });

    } catch (err) {
        console.error('getBatchHealthReport error', err);
        res.status(500).json({ message: 'Failed to fetch batch health report' });
    }
};

// @desc    Export attendance to CSV
// @route   GET /api/admin/reports/export/attendance
// @access  Private (Admin)
export const exportAttendanceCSV = async (req, res) => {
    try {
        const { batchId } = req.query;
        let query = {};
        if (batchId) query.batch = batchId;

        const sessions = await ClassSession.find(query)
            .populate('batch', 'name')
            .populate('attendance.student', 'name email')
            .sort({ date: 1 })
            .lean();

        let csvContent = "Date,Batch,Student Name,Email,Status\n";

        sessions.forEach(session => {
            const dateStr = session.date ? new Date(session.date).toISOString().split('T')[0] : '';
            const batchName = session.batch?.name || 'Unknown';
            
            if (session.attendance) {
                session.attendance.forEach(a => {
                    const studentName = (a.student?.name || 'Unknown').replace(/,/g, '');
                    const email = a.student?.email || 'Unknown';
                    csvContent += `${dateStr},${batchName},${studentName},${email},${a.status}\n`;
                });
            }
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="attendance_export_${new Date().getTime()}.csv"`);
        res.status(200).send(csvContent);

    } catch (err) {
        console.error('exportAttendanceCSV error', err);
        res.status(500).send('Failed to generate CSV');
    }
};
