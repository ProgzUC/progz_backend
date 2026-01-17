import Batch from "../models/Batch.js";
import User from "../models/User.js";
import Course from "../models/Course.js";

// @desc    Create a new batch
// @route   POST /api/batches
// @access  Private (Admin/Trainer)
export const createBatch = async (req, res) => {
    try {
        const { name, course, classTiming, meetLink, startDate, endDate, daysOfWeek } = req.body;

        // Verify course exists
        const courseExists = await Course.findById(course);
        if (!courseExists) {
            return res.status(404).json({ msg: "Course not found" });
        }

        const batch = await Batch.create({
            name,
            course,
            classTiming,
            meetLink,
            startDate,
            endDate,
            daysOfWeek,
        });

        res.status(201).json(batch);
    } catch (error) {
        res.status(500).json({ msg: "Server error", error: error.message });
    }
};

// @desc    Get all batches
// @route   GET /api/batches
// @access  Private
export const getAllBatches = async (req, res) => {
    try {
        const batches = await Batch.find()
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
