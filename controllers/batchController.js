import Batch from "../models/Batch.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import RecycleBin from "../models/RecycleBin.js";
import PendingUser from "../models/PendingUser.js";
import {
  isAdmin,
  canCreateBatch,
  canManageBatch,
  denyAccess,
  getUserId,
} from "../utils/authorizationHelpers.js";
import { logAuditAction } from "../utils/auditLogger.js";
import {
  resolveCourseIdsFromBody,
  getBatchCourseIds,
  findSectionProgressIndex,
  matchesSectionProgress,
} from "../utils/batchCourses.js";

const enrollStudentIntoCourses = async (student, batchId, courseIds) => {
  for (const courseId of courseIds) {
    const existing = student.enrolledCourses.find(
      (e) => e.course?.toString() === courseId.toString()
    );
    if (existing) {
      existing.batch = batchId;
    } else {
      student.enrolledCourses.push({
        course: courseId,
        batch: batchId,
        enrolledAt: new Date(),
      });
    }

    await Course.updateOne(
      { _id: courseId, "enrolledStudents.student": { $ne: student._id } },
      {
        $push: {
          enrolledStudents: {
            student: student._id,
            enrolledDate: new Date(),
            batchId,
          },
        },
      }
    );
  }
  await student.save();
};

/** When batch courses change, re-link every student to the new course set. */
const syncBatchStudentsToCourses = async (batch, previousCourseIds = []) => {
  const courseIds = getBatchCourseIds(batch);
  const courseIdSet = new Set(courseIds.map(String));
  const batchId = String(batch._id);

  for (const studentId of batch.students || []) {
    const student = await User.findById(studentId);
    if (!student) continue;

    student.enrolledCourses = (student.enrolledCourses || []).filter((e) => {
      if (String(e.batch || "") !== batchId) return true;
      return courseIdSet.has(String(e.course || ""));
    });

    await enrollStudentIntoCourses(student, batch._id, courseIds);
  }

  const removed = previousCourseIds
    .map(String)
    .filter((id) => id && !courseIdSet.has(id));

  for (const courseId of removed) {
    await Course.updateOne(
      { _id: courseId },
      { $pull: { enrolledStudents: { batchId: batch._id } } }
    );
  }
};

export const createBatch = async (req, res) => {
  try {
    const {
      name,
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

    const courseIds = resolveCourseIdsFromBody(req.body);

    // Required field validation
    if (!name || !courseIds.length || !classTiming?.startTime || !classTiming?.endTime) {
      return res.status(400).json({
        msg: "name, course(s), classTiming.startTime and classTiming.endTime are required",
      });
    }

    const courseDocs = await Course.find({ _id: { $in: courseIds } });
    if (courseDocs.length !== courseIds.length) {
      return res.status(404).json({ msg: "One or more courses not found" });
    }

    for (const courseDoc of courseDocs) {
      if (!canCreateBatch(req, courseDoc)) {
        return denyAccess(res, "You do not have permission to create a batch for one or more selected courses");
      }
    }

    const primaryCourse = courseIds[0];

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
      course: primaryCourse,
      courses: courseIds,
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
        await enrollStudentIntoCourses(student, batch._id, courseIds);
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
            .populate("courses", "courseName")
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
            .populate("courses", "courseName")
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
        const alreadyInBatch = batch.students.some(
            (id) => String(id) === String(studentId)
        );
        if (!alreadyInBatch) {
            batch.students.push(studentId);
            await batch.save();
        }

        const courseIds = getBatchCourseIds(batch);
        await enrollStudentIntoCourses(student, batchId, courseIds);

        await logAuditAction({
            req,
            action: "enroll_student",
            targetType: "Batch",
            targetId: batch._id,
            details: {
                batchName: batch.name,
                studentId,
                studentEmail: student.email,
                courseIds,
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

// @desc    Toggle section completion (lock/unlock for students)
// @route   POST /api/batches/:id/sections/toggle
// @access  Private (Admin/Trainer)
export const toggleSectionCompletion = async (req, res) => {
    try {
        let { moduleIndex, sectionIndex, courseId } = req.body;
        const batchId = req.params.id;
        const userId = req.user.id;

        moduleIndex = moduleIndex !== undefined ? parseInt(moduleIndex, 10) : undefined;
        sectionIndex = sectionIndex !== undefined ? parseInt(sectionIndex, 10) : undefined;

        if (moduleIndex === undefined || Number.isNaN(moduleIndex) || sectionIndex === undefined || Number.isNaN(sectionIndex)) {
            return res.status(400).json({ msg: "moduleIndex and sectionIndex must be valid integers" });
        }

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ msg: "Batch not found" });

        if (!canManageBatch(req, batch)) {
            return denyAccess(res, "You do not have permission to update section progress for this batch");
        }

        const primaryCourseId = String(batch.course?._id || batch.course);
        const resolvedCourseId = courseId ? String(courseId) : primaryCourseId;
        const matchOpts = {
            courseId: resolvedCourseId,
            moduleIndex,
            sectionIndex,
            primaryCourseId,
        };

        const progressIndex = findSectionProgressIndex(batch.sectionProgress, matchOpts);

        if (progressIndex > -1) {
            const currentStatus = batch.sectionProgress[progressIndex].isCompleted;
            batch.sectionProgress[progressIndex].isCompleted = !currentStatus;
            if (!batch.sectionProgress[progressIndex].courseId) {
                batch.sectionProgress[progressIndex].courseId = resolvedCourseId;
            }

            if (!currentStatus) {
                batch.sectionProgress[progressIndex].completedBy = userId;
                batch.sectionProgress[progressIndex].completionTime = new Date();
            } else {
                batch.sectionProgress[progressIndex].completedBy = undefined;
                batch.sectionProgress[progressIndex].completionTime = undefined;
            }
        } else {
            batch.sectionProgress.push({
                courseId: resolvedCourseId,
                moduleIndex,
                sectionIndex,
                isCompleted: true,
                completedBy: userId,
                completionTime: new Date(),
            });
        }

        await batch.save();

        const updatedEntry = batch.sectionProgress.find((p) =>
            matchesSectionProgress(p, matchOpts)
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

    // Multi / single course update — always keep course synced to courses[0]
    let coursesChanged = false;
    const previousCourseIds = getBatchCourseIds(batch);
    if (updates.courses !== undefined || updates.course !== undefined) {
      const courseIds = resolveCourseIdsFromBody(updates);
      if (!courseIds.length) {
        return res.status(400).json({ msg: "At least one course is required" });
      }
      const courseDocs = await Course.find({ _id: { $in: courseIds } });
      if (courseDocs.length !== courseIds.length) {
        return res.status(404).json({ msg: "One or more courses not found" });
      }
      batch.courses = courseIds;
      batch.course = courseIds[0];
      coursesChanged = true;
    }

    await batch.save();

    // Re-enroll students into the updated course list
    if (coursesChanged) {
      await syncBatchStudentsToCourses(batch, previousCourseIds);
    }

    // Sync students to all courses if changed
    if (updates.students) {
      const courseIds = getBatchCourseIds(batch);
      for (const sId of updates.students) {
        const student = await User.findById(sId);
        if (!student) continue;
        await enrollStudentIntoCourses(student, batch._id, courseIds);
      }
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

                const alreadyInBatch = batch.students.some(
                    (id) => String(id) === String(sId)
                );
                if (!alreadyInBatch) {
                    batch.students.push(sId);
                    enrolledCount++;
                }

                const courseIds = getBatchCourseIds(batch);
                await enrollStudentIntoCourses(student, batchId, courseIds);

                await logAuditAction({
                    req,
                    action: "enroll_student",
                    targetType: "Batch",
                    targetId: batchId,
                    details: {
                        batchName: batch.name,
                        studentId: sId,
                        studentEmail: student.email,
                        courseIds,
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