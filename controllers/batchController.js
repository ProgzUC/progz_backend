import Batch from "../models/Batch.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import RecycleBin from "../models/RecycleBin.js";
import PendingUser from "../models/PendingUser.js";
import {
  isAdmin,
  canManageCourse,
  canManageBatch,
  denyAccess,
  getUserId,
} from "../utils/authorizationHelpers.js";
import { logAuditAction } from "../utils/auditLogger.js";

export const createBatch = async (req, res) => {
  try {
    const {
      name,
      course,
      trainers = [],
      students = [],
      classTiming,
      meetLink,
      startDate,
      endDate,
      daysOfWeek,
      status,
      sectionProgress = [],
    } = req.body;

    // Required field validation
    if (!name || !course || !classTiming?.startTime || !classTiming?.endTime) {
      return res.status(400).json({
        msg: "name, course, classTiming.startTime and classTiming.endTime are required",
      });
    }

    // Verify course exists
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(404).json({ msg: "Course not found" });
    }

    if (!isAdmin(req) && !canManageCourse(req, courseExists)) {
      return denyAccess(res, "You do not have permission to create a batch for this course");
    }

    // Optional: validate trainers & students existence
    if (trainers.length) {
      for (const t of trainers) {
        if (!t.trainer) {
          return res.status(400).json({ msg: "Each trainer entry must have trainer id" });
        }

        const trainerExists = await User.findById(t.trainer);
        if (!trainerExists || !["trainer", "instructor"].includes(String(trainerExists.role).toLowerCase())) {
          return res.status(400).json({ msg: `User is not a valid trainer: ${t.trainer}` });
        }
      }
    }

    if (students.length) {
      const count = await User.countDocuments({ _id: { $in: students } });
      if (count !== students.length) {
        return res.status(400).json({ msg: "One or more students are invalid" });
      }
    }

    const batch = await Batch.create({
      name,
      course,
      trainers: trainers.map(t => ({
        trainer: t.trainer,
        assignedModules: t.assignedModules || [],
        fromDate: t.fromDate,
        toDate: t.toDate,
        isCurrent: !!t.isCurrent,
      })),
      students,
      classTiming: {
        startTime: classTiming.startTime,
        endTime: classTiming.endTime,
        timezone: classTiming.timezone || "Asia/Kolkata",
      },
      meetLink,
      startDate,
      endDate,
      daysOfWeek,
      status, // schema will validate enum & default
      sectionProgress,
    });

    // Sync enrollments to User.enrolledCourses + Course.enrolledStudents before responding
    if (students.length > 0) {
      for (const studentId of students) {
        const student = await User.findById(studentId);
        if (!student) continue;

        const existing = student.enrolledCourses.find(
          (e) => e.course?.toString() === course.toString()
        );
        if (existing) {
          existing.batch = batch._id;
        } else {
          student.enrolledCourses.push({
            course,
            batch: batch._id,
            enrolledAt: new Date(),
          });
        }
        await student.save();

        await Course.updateOne(
          { _id: course, "enrolledStudents.student": { $ne: studentId } },
          {
            $push: {
              enrolledStudents: {
                student: studentId,
                enrolledDate: new Date(),
                batchId: batch._id,
              },
            },
          }
        );
      }
    }

    res.status(201).json({
      msg: "Batch created successfully",
      batch,
    });
  } catch (error) {
    res.status(500).json({
      msg: "Server error",
      error: error.message,
    });
  }
};


// @desc    Get all batches
// @route   GET /api/batches
// @access  Private
export const getAllBatches = async (req, res) => {
    try {
        const query = isAdmin(req) ? {} : { "trainers.trainer": getUserId(req) };

        const batches = await Batch.find(query)
            .populate("course", "courseName")
            .populate("students", "name email")
            .populate("trainers.trainer", "name email");
        res.json(batches);
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// @desc    Get single batch
// @route   GET /api/batches/:id
// @access  Private
export const getBatch = async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id)
            .populate("course", "courseName")
            .populate("students", "name email phone enrolledCourses")
            .populate("trainers.trainer", "name email phone");

        if (!batch) {
            return res.status(404).json({ msg: "Batch not found" });
        }

        if (!canManageBatch(req, batch)) {
            return denyAccess(res, "You do not have access to this batch");
        }

        res.json(batch);
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// @desc    Enroll student in batch
// @route   POST /api/batches/:id/enroll
// @access  Private (Admin/Trainer)
export const enrollStudent = async (req, res) => {
    try {
        const { studentId } = req.body;
        const batchId = req.params.id;

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ msg: "Batch not found" });

        if (!canManageBatch(req, batch)) {
            return denyAccess(res, "You do not have permission to enroll students in this batch");
        }

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ msg: "Student not found" });

        // Add to batch students array if not already there
        if (!batch.students.includes(studentId)) {
            batch.students.push(studentId);
            await batch.save();
        }

        // Update student's enrolledCourses to include this batch reference for that course
        let enrolled = student.enrolledCourses.find(
            (e) => e.course.toString() === batch.course.toString()
        );

        if (enrolled) {
            enrolled.batch = batchId;
        } else {
            student.enrolledCourses.push({
                course: batch.course,
                batch: batchId,
                enrolledAt: new Date(),
            });
        }

        await student.save();

        // Sync to Course.enrolledStudents (dedupe by student id)
        await Course.updateOne(
            { _id: batch.course, "enrolledStudents.student": { $ne: studentId } },
            {
                $push: {
                    enrolledStudents: {
                        student: studentId,
                        enrolledDate: new Date(),
                        batchId: batch._id,
                    },
                },
            }
        );

        await logAuditAction({
            req,
            action: "enroll_student",
            targetType: "Batch",
            targetId: batch._id,
            details: {
                batchName: batch.name,
                studentId,
                studentEmail: student.email,
                courseId: batch.course
            }
        });

        res.json({ msg: "Student enrolled successfully", batch });
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// @desc    Remove student from batch
// @route   POST /api/batches/:id/remove-student
// @access  Private (Admin/Trainer)
export const removeStudent = async (req, res) => {
    try {
        const { studentId } = req.body;
        const batchId = req.params.id;

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ msg: "Batch not found" });

        if (!canManageBatch(req, batch)) {
            return denyAccess(res, "You do not have permission to remove students from this batch");
        }

        // Remove from batch students array
        batch.students = batch.students.filter((id) => id.toString() !== studentId);
        await batch.save();

        // Update student's enrolledCourses to remove this batch reference
        const student = await User.findById(studentId);
        if (student) {
            student.enrolledCourses = student.enrolledCourses.map((e) => {
                if (e.batch && e.batch.toString() === batchId) {
                    e.batch = undefined;
                }
                return e;
            });
            await student.save();
        }

        await logAuditAction({
            req,
            action: "unenroll_student",
            targetType: "Batch",
            targetId: batchId,
            details: {
                batchName: batch.name,
                studentId,
                studentEmail: student?.email,
                courseId: batch.course
            }
        });

        res.json({ msg: "Student removed from batch", batch });
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// @desc    Add/Edit trainers in batch (including module assignment)
// @route   POST /api/batches/:id/trainers
// @access  Private (Admin/Trainer)
export const manageTrainers = async (req, res) => {
    try {
        const { trainers } = req.body; // Array of { trainer, assignedModules, fromDate, toDate, isCurrent }
        const batchId = req.params.id;

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ msg: "Batch not found" });

        if (!canManageBatch(req, batch)) {
            return denyAccess(res, "You do not have permission to manage trainers for this batch");
        }

        // Validate trainers exist
        for (const t of trainers) {
            const trainerUser = await User.findById(t.trainer);
            if (!trainerUser || trainerUser.role !== "trainer") {
                return res.status(400).json({ msg: `User ${t.trainer} is not a valid trainer` });
            }
        }

        // Replace trainer list with new assignment
        batch.trainers = trainers;
        await batch.save();

        res.json({ msg: "Trainers updated successfully", batch });
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// @desc    Toggle section completion
// @route   POST /api/batches/:id/sections/toggle
// @access  Private (Admin/Trainer)
export const toggleSectionCompletion = async (req, res) => {
    try {
        const { moduleIndex, sectionIndex } = req.body;
        const batchId = req.params.id;
        const userId = req.user.id;

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ msg: "Batch not found" });

        if (!canManageBatch(req, batch)) {
            return denyAccess(res, "You do not have permission to update section progress for this batch");
        }

        // Find if progress entry exists
        const progressIndex = batch.sectionProgress.findIndex(
            (p) => p.moduleIndex === moduleIndex && p.sectionIndex === sectionIndex
        );

        if (progressIndex > -1) {
            // Toggle existing
            const currentStatus = batch.sectionProgress[progressIndex].isCompleted;
            batch.sectionProgress[progressIndex].isCompleted = !currentStatus;

            if (!currentStatus) {
                // Marking as completed
                batch.sectionProgress[progressIndex].completedBy = userId;
                batch.sectionProgress[progressIndex].completionTime = new Date();
            } else {
                // Marking as incomplete (optional: clear details or keep history? usually clear for current state)
                batch.sectionProgress[progressIndex].completedBy = undefined;
                batch.sectionProgress[progressIndex].completionTime = undefined;
            }

        } else {
            // Create new entry as completed
            batch.sectionProgress.push({
                moduleIndex,
                sectionIndex,
                isCompleted: true,
                completedBy: userId,
                completionTime: new Date(),
            });
        }

        await batch.save();

        // Return the updated section progress element or the whole batch
        const updatedEntry = batch.sectionProgress.find(
            (p) => p.moduleIndex === moduleIndex && p.sectionIndex === sectionIndex
        );

        res.json({ msg: "Section progress updated", sectionProgress: updatedEntry, batchId });
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error?.message });
    }
};

export const deleteBatch = async (req, res) => {
  try {
    const batchId = req.params.id;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ msg: "Batch not found" });
    }

    if (!canManageBatch(req, batch)) {
      return denyAccess(res, "You do not have permission to delete this batch");
    }

    // Move to Recycle Bin
    await RecycleBin.create({
      itemType: "Batch",
      originalId: batch._id,
      data: batch.toObject(),
      deletedBy: req.user.id,
      itemRefName: batch.name,
    });

    await Batch.findByIdAndDelete(batchId);

    await logAuditAction({
      req,
      action: "delete_batch",
      targetType: "Batch",
      targetId: batch._id,
      details: {
        batchName: batch.name,
        courseId: batch.course,
        type: "soft_delete"
      }
    });

    res.json({ msg: "Batch moved to recycle bin" });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
}

export const updateBatch = async (req, res) => {
  try {
    const batchId = req.params.id;
    const updates = req.body;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ msg: "Batch not found" });
    }

    if (!canManageBatch(req, batch)) {
      return denyAccess(res, "You do not have permission to update this batch");
    }

    // Apply updates
    const allowedFields = [
      "name",
      "course",
      "trainers",
      "students",
      "classTiming",
      "meetLink",
      "startDate",
      "endDate",
      "daysOfWeek",
      "status",
      "sectionProgress",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        batch[field] = updates[field];
      }
    });

    await batch.save();

    // Sync students to Course if changed
    if (updates.students) {
      await Course.findByIdAndUpdate(batch.course, {
        $addToSet: { 
          enrolledStudents: { 
            $each: updates.students.map(s => ({ student: s, enrolledDate: new Date() })) 
          } 
        }
      });
    }

    res.json({
      msg: "Batch updated successfully",
      batch,
    });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

export const bulkEnrollStudents = async (req, res) => {
    try {
        const batchId = req.params.id;
        const { studentIds = [], pendingStudentIds = [], emails = [] } = req.body;

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ msg: "Batch not found" });

        if (!canManageBatch(req, batch)) {
            return denyAccess(res, "You do not have permission to bulk enroll students in this batch");
        }

        const finalStudentIds = new Set();
        let approvedCount = 0;
        const errors = [];

        // 1. Resolve active student IDs
        for (const sId of studentIds) {
            const student = await User.findById(sId);
            if (student && student.role === "student") {
                finalStudentIds.add(String(student._id));
            } else {
                errors.push(`Student ID ${sId} not found or is not a student.`);
            }
        }

        // 2. Resolve pending student IDs
        for (const pId of pendingStudentIds) {
            try {
                const pendingUser = await PendingUser.findById(pId);
                if (pendingUser) {
                    const normalizedEmail = String(pendingUser.email || "").trim().toLowerCase();
                    
                    let activeUser = await User.findOne({ email: normalizedEmail });
                    if (!activeUser) {
                        const userData = pendingUser.toObject();
                        delete userData._id;
                        delete userData.createdAt;
                        delete userData.updatedAt;
                        delete userData.__v;
                        delete userData.status;
                        userData.email = normalizedEmail;
                        activeUser = await User.create(userData);
                        approvedCount++;
                    }
                    finalStudentIds.add(String(activeUser._id));
                    await PendingUser.findByIdAndDelete(pId);
                } else {
                    errors.push(`Pending student ID ${pId} not found.`);
                }
            } catch (err) {
                errors.push(`Failed to approve pending student ID ${pId}: ${err.message}`);
            }
        }

        // 3. Resolve CSV emails
        const cleanEmails = emails.map(e => String(e).trim().toLowerCase()).filter(Boolean);
        for (const email of cleanEmails) {
            try {
                let activeUser = await User.findOne({ email });
                if (activeUser) {
                    finalStudentIds.add(String(activeUser._id));
                    continue;
                }

                const pendingUser = await PendingUser.findOne({ email });
                if (pendingUser) {
                    const userData = pendingUser.toObject();
                    delete userData._id;
                    delete userData.createdAt;
                    delete userData.updatedAt;
                    delete userData.__v;
                    delete userData.status;
                    userData.email = email;
                    activeUser = await User.create(userData);
                    approvedCount++;
                    finalStudentIds.add(String(activeUser._id));
                    await PendingUser.findByIdAndDelete(pendingUser._id);
                    continue;
                }

                errors.push(`Email ${email} has no active profile or pending CRM registration.`);
            } catch (err) {
                errors.push(`Failed to process email ${email}: ${err.message}`);
            }
        }

        // 4. Enroll resolved students
        let enrolledCount = 0;
        for (const sId of finalStudentIds) {
            try {
                const student = await User.findById(sId);
                if (!student) continue;

                if (!batch.students.includes(sId)) {
                    batch.students.push(sId);
                    enrolledCount++;
                }

                let enrolled = student.enrolledCourses.find(
                    (e) => e.course.toString() === batch.course.toString()
                );

                if (enrolled) {
                    enrolled.batch = batchId;
                } else {
                    student.enrolledCourses.push({
                        course: batch.course,
                        batch: batchId,
                        enrolledAt: new Date(),
                    });
                }
                await student.save();

                await Course.updateOne(
                    { _id: batch.course, "enrolledStudents.student": { $ne: sId } },
                    {
                        $push: {
                            enrolledStudents: {
                                student: sId,
                                enrolledDate: new Date(),
                                batchId: batch._id,
                            },
                        },
                    }
                );

                await logAuditAction({
                    req,
                    action: "enroll_student",
                    targetType: "Batch",
                    targetId: batchId,
                    details: {
                        batchName: batch.name,
                        studentId: sId,
                        studentEmail: student.email,
                        courseId: batch.course,
                        type: "bulk"
                    }
                });
            } catch (err) {
                errors.push(`Failed to enroll student ID ${sId}: ${err.message}`);
            }
        }

        if (enrolledCount > 0) {
            await batch.save();
        }

        res.json({
            msg: `Bulk enrollment completed. Enrolled: ${enrolledCount}, Approved: ${approvedCount}`,
            enrolledCount,
            approvedCount,
            errors
        });
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};