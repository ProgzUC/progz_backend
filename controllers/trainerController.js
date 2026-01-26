import Batch from "../models/Batch.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { getNextClassDate } from "../utils/getNextClassDate.js";

export const trainerBootstrap = async (req, res) => {
  try {
    const trainerId = req.user.id;

    const trainer = await User.findById(trainerId)
      .select("name email")
      .lean();
    const batches = await Batch.find({ "trainers.trainer": trainerId })
      .populate("course", "courseName courseDuration modules")
      .lean();

    let totalStudents = 0;
    let activeBatches = [];
    let completedBatches = [];
    let upcomingClasses = [];

   batches.forEach(batch => {
  totalStudents += batch.students?.length || 0;

  const course = batch.course;
  if (!course || !course.modules) {
    console.warn("Course not populated for batch:", batch._id);
    return;
  }

  const totalSections = course.modules.reduce(
    (acc, m) => acc + (m.sections?.length || 0),
    0
  );

  const completedSections =
    batch.sectionProgress?.filter(s => s.isCompleted).length || 0;

  const completionPercentage =
    totalSections === 0
      ? 0
      : Math.round((completedSections / totalSections) * 100);

  if (batch.status === "active") {
    // compose human-friendly timing string from classTiming object
    const timingStr = batch.classTiming
      ? `${batch.classTiming.startTime} - ${batch.classTiming.endTime} ${batch.classTiming.timezone || ""}`.trim()
      : null;

    // get trainer-specific assignment data (assignedModules, isCurrent)
    const trainerAssign = batch.trainers?.find(t => String(t.trainer) === String(trainerId)) || null;

    activeBatches.push({
      batchId: batch._id,
      batchName: batch.name,
      courseName: course.courseName,
      duration: course.courseDuration,
      studentsCount: batch.students?.length || 0,
      timing: timingStr,
      startDate: batch.startDate,
      meetLink: batch.meetLink,
      completionPercentage,
      trainerAssignment: trainerAssign
        ? {
            assignedModules: trainerAssign.assignedModules || [],
            isCurrent: !!trainerAssign.isCurrent,
            fromDate: trainerAssign.fromDate || null,
            toDate: trainerAssign.toDate || null,
          }
        : null,
    });

    const nextClassDate = getNextClassDate(batch.daysOfWeek, batch.classTiming);

    if (nextClassDate) {
      upcomingClasses.push({
        batchId: batch._id,
        batchName: batch.name,
        courseName: course.courseName,
        timing: timingStr,
        meetLink: batch.meetLink,
        nextClassAt: nextClassDate,
      });
    }
  }

  if (batch.status === "completed") {
    completedBatches.push({
      batchId: batch._id,
      batchName: batch.name,
      courseName: course.courseName,
      startDate: batch.startDate,
      endDate: batch.endDate
    });
  }
});


    // only 3 upcoming classes
    upcomingClasses.sort(
  (a, b) => new Date(a.nextClassAt) - new Date(b.nextClassAt)
);

upcomingClasses = upcomingClasses.slice(0, 3);


    res.json({
      trainer: {
        id: req.user.id,
        name: trainer.name,
        email: trainer.email
      },
      stats: {
        totalStudents,
        activeBatches: activeBatches.length,
        completedBatches: completedBatches.length
      },
      activeBatches,
      completedBatches,
      upcomingClasses
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Trainer bootstrap failed" });
  }
};

export const getTrainerBatchDetails = async (req, res) => {
  try {
    const { batchId } = req.params;
    const trainerId = req.user.id;

    const batch = await Batch.findOne({
      _id: batchId,
      "trainers.trainer": trainerId,
    })
      .populate("course", "courseName modules")
      .populate("students", "name email")
      .lean();

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const timingStr = batch.classTiming
      ? `${batch.classTiming.startTime} - ${batch.classTiming.endTime} ${batch.classTiming.timezone || ""}`.trim()
      : null;

    const trainerAssign = batch.trainers?.find(t => String(t.trainer) === String(trainerId)) || null;

    res.json({
      batchId: batch._id,
      batchName: batch.name,
      courseName: batch.course.courseName,
      classTiming: batch.classTiming,
      timing: timingStr,
      startDate: batch.startDate,
      students: batch.students,
      curriculum: batch.course.modules,
      sectionProgress: batch.sectionProgress,
      trainerAssignment: trainerAssign
        ? {
            assignedModules: trainerAssign.assignedModules || [],
            isCurrent: !!trainerAssign.isCurrent,
            fromDate: trainerAssign.fromDate || null,
            toDate: trainerAssign.toDate || null,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: "Batch details error" });
  }
};

export const getTrainerCourses = async (req, res) => {
  const trainerId = req.user.id;

  const courses = await Course.find({
    instructor: trainerId,
  })
    .select("courseName modules enrolledStudents")
    .lean();

  res.json(
    courses.map(c => ({
      courseId: c._id,
      courseName: c.courseName,
      totalStudents: c.enrolledStudents.length,
      totalSections: c.modules.reduce((acc, m) => acc + (m.sections?.length || 0), 0),
    }))
  );
};

export const getTrainerprofile = async (req, res) => {
  const trainerId = req.user.id;

  const trainer = await User.findById(trainerId).select("-password").lean();
  res.json(trainer);
};

export const updateTrainerprofile = async (req, res) => {
  try {
    const trainerId = req.user.id;
    const input = req.body || {};

    // Protected fields that should not be updatable by the trainer themself
    const protectedFields = new Set([
      "_id",
      "email",
      "role",
      "resetPasswordToken",
      "resetPasswordExpires",
      "createdAt",
      "updatedAt",
      "__v",
    ]);

    // Build allowed fields dynamically from schema to avoid drifting
    const schemaKeys = Object.keys(User.schema.paths || {});
    const allowedFields = schemaKeys.filter(k => !protectedFields.has(k));

    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        updates[key] = input[key];
      }
    }

    // If password is being updated, hash it
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }

    // If nothing to update, return current profile
    if (Object.keys(updates).length === 0) {
      const current = await User.findById(trainerId).select("-password").lean();
      return res.json(current);
    }

    const trainer = await User.findOneAndUpdate(
      { _id: trainerId },
      { $set: updates },
      { new: true, runValidators: true, context: "query" }
    )
      .select("-password")
      .lean();

    res.json(trainer);
  } catch (err) {
    console.error("updateTrainerprofile error:", err);
    res.status(500).json({ message: "Update failed" });
  }
};

export const toggleSectionCompletion = async (req, res) => {
  try {
    const { batchId, moduleIndex, sectionIndex } = req.body;
    const trainerId = req.user.id;

    // 1️⃣ Find current state
    const batch = await Batch.findOne(
      {
        _id: batchId,
        "trainers.trainer": trainerId,
        "sectionProgress.moduleIndex": moduleIndex,
        "sectionProgress.sectionIndex": sectionIndex,
      },
      {
        "sectionProgress.$": 1, // only matched section
      }
    ).lean();

    if (!batch || !batch.sectionProgress?.length) {
      return res.status(404).json({ message: "Section not found" });
    }

    const isCompleted = batch.sectionProgress[0].isCompleted;

    // 2️⃣ Toggle
    await Batch.updateOne(
      {
        _id: batchId,
        "sectionProgress.moduleIndex": moduleIndex,
        "sectionProgress.sectionIndex": sectionIndex,
      },
      {
        $set: {
          "sectionProgress.$.isCompleted": !isCompleted,
          "sectionProgress.$.completedBy": !isCompleted
            ? trainerId
            : null,
          "sectionProgress.$.completionTime": !isCompleted
            ? new Date()
            : null,
        },
      }
    );

    res.json({
      success: true,
      isCompleted: !isCompleted,
    });
  } catch (err) {
    console.error("Toggle error:", err);
    res.status(500).json({ message: "Toggle failed" });
  }
};
