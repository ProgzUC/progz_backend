import Course from "../models/Course.js";
import CourseVersion from "../models/CourseVersion.js";
import RecycleBin from "../models/RecycleBin.js";

// @desc    Create a new course
// @route   POST /api/courses
// @access  Private (Trainer/Admin)
export const createCourse = async (req, res) => {
  try {
    const { courseName, courseDescription, courseDuration, modules, thumbnail } = req.body;

    // Generate courseId from courseName
    // slugify: lowercase, replace non-alphanumeric with hyphen, trim hyphens
    let baseId = courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!baseId) baseId = 'course';

    // Add unique suffix
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const courseId = `${baseId}-${uniqueSuffix}`;

    // Assign currect user as instructor if not provided (or push to array)
    // Assuming single instructor for now based on request context, but model supports array.
    // We will initialize with the current user.
    const instructor = [req.user.id];

    const course = await Course.create({
      courseName,
      courseId,
      instructor,
      courseDescription,
      courseDuration,
      modules,
      thumbnail
    });

    res.status(201).json(course);
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find({})
      .populate("instructor", "name email")
      .lean();
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get single course by ID
// @route   GET /api/courses/:id
// @access  Private
export const getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("instructor", "name email")
      .populate("enrolledStudents.student", "name email")
      .lean();

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Course not found" });
    }
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Trainer/Admin)
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Optional: Check if the user is the instructor or admin
    // For now, assuming authorized roles from middleware are sufficient

    // Move to Recycle Bin
    await RecycleBin.create({
      itemType: "Course",
      originalId: course._id,
      data: course.toObject(),
      deletedBy: req.user.id,
      itemRefName: course.courseName
    });

    await course.deleteOne();

    res.json({ message: "Course moved to recycle bin" });
  } catch (error) {
    console.error("Error deleting course:", error);
    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Course not found" });
    }
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Add instructor to course
// @route   PUT /api/courses/:id/instructors/add
// @access  Private (Admin/Trainer)
export const addInstructor = async (req, res) => {
  try {
    const { instructorId } = req.body;

    if (!instructorId) {
      return res.status(400).json({ message: "Instructor ID is required" });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.instructor.includes(instructorId)) {
      return res.status(400).json({ message: "Instructor already added" });
    }

    course.instructor.push(instructorId);
    await course.save();

    res.json(course);
  } catch (error) {
    console.error("Error adding instructor:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Remove instructor from course
// @route   PUT /api/courses/:id/instructors/remove
// @access  Private (Admin/Trainer)
export const removeInstructor = async (req, res) => {
  try {
    const { instructorId } = req.body;

    if (!instructorId) {
      return res.status(400).json({ message: "Instructor ID is required" });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.instructor = course.instructor.filter(
      (id) => id.toString() !== instructorId
    );
    await course.save();

    res.json(course);
  } catch (error) {
    console.error("Error removing instructor:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update (replace) instructors for a course
// @route   PUT /api/courses/:id/instructors
// @access  Private (Admin/Trainer)
export const updateInstructors = async (req, res) => {
  try {
    const { instructorIds } = req.body; // Expecting an array of IDs

    if (!Array.isArray(instructorIds)) {
      return res.status(400).json({ message: "instructorIds must be an array" });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.instructor = instructorIds;
    await course.save();

    res.json(course);
  } catch (error) {
    console.error("Error updating instructors:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update course details (creates version snapshot)
// @route   PUT /api/courses/:id
// @access  Private (Admin/Trainer)
export const updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const updates = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 1. Create Snapshot of CURRENT state before update
    // Find latest version number
    const lastVersion = await CourseVersion.findOne({ courseRef: courseId })
      .sort({ versionNumber: -1 })
      .select("versionNumber");

    const newVersionNum = lastVersion ? lastVersion.versionNumber + 1 : 1;

    await CourseVersion.create({
      courseRef: course._id,
      versionNumber: newVersionNum,
      snapshotDate: new Date(),

      courseName: course.courseName,
      courseId: course.courseId,
      instructor: course.instructor,
      courseDescription: course.courseDescription,
      courseDuration: course.courseDuration,
      modules: course.modules,
      enrolledStudents: course.enrolledStudents,
    });

    // 2. Apply Updates
    // Allow updating all fields except _id and enrolledStudents (usually handled separately)
    // However, for simplicity allowing top-level fields.

    if (updates.courseName) course.courseName = updates.courseName;
    if (updates.courseId) course.courseId = updates.courseId;
    if (updates.courseDescription) course.courseDescription = updates.courseDescription;
    if (updates.courseDuration) course.courseDuration = updates.courseDuration;
    if (updates.modules) course.modules = updates.modules;

    // Instructors handled via separate endpoint or here? 
    // Requirement said "Edit a course". We'll support generic updates here.
    if (updates.instructor) course.instructor = updates.instructor;

    await course.save();

    res.json(course);
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

// @desc    Get all versions of a course
// @route   GET /api/courses/:id/versions
// @access  Private
export const getCourseVersions = async (req, res) => {
  try {
    const versions = await CourseVersion.find({ courseRef: req.params.id })
      .sort({ versionNumber: -1 })
      .select("versionNumber snapshotDate courseName"); // Basic info list

    res.json(versions);
  } catch (error) {
    console.error("Error fetching versions:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Rollback course to a specific version
// @route   POST /api/courses/:id/rollback/:versionId
// @access  Private (Admin/Trainer)
// versionId here refers to the _id of the CourseVersion document
export const rollbackCourse = async (req, res) => {
  try {
    const { id, versionId } = req.params;

    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const targetVersion = await CourseVersion.findById(versionId);
    if (!targetVersion) return res.status(404).json({ message: "Version not found" });

    if (targetVersion.courseRef.toString() !== id) {
      return res.status(400).json({ message: "Version does not belong to this course" });
    }

    // Optional: Save current state as NEW version before rolling back?
    // User requested: "there should be options to roll back".
    // Usually rollback is a destructive action to current state, OR it is a new state that matches old state.
    // Let's do the safe thing: Snapshot CURRENT state before overwriting, so we can "undo" the rollback.

    const lastVersion = await CourseVersion.findOne({ courseRef: id })
      .sort({ versionNumber: -1 })
      .select("versionNumber");
    const newVersionNum = lastVersion ? lastVersion.versionNumber + 1 : 1;

    await CourseVersion.create({
      courseRef: course._id,
      versionNumber: newVersionNum,
      snapshotDate: new Date(),
      courseName: course.courseName,
      courseId: course.courseId,
      instructor: course.instructor,
      courseDescription: course.courseDescription,
      courseDuration: course.courseDuration,
      modules: course.modules,
      enrolledStudents: course.enrolledStudents,
    });

    // Restore fields
    course.courseName = targetVersion.courseName;
    course.courseId = targetVersion.courseId;
    course.instructor = targetVersion.instructor;
    course.courseDescription = targetVersion.courseDescription;
    course.courseDuration = targetVersion.courseDuration;
    course.modules = targetVersion.modules;
    // enrolledStudents usually shouldn't be rolled back as it implies data loss of enrollments? 
    // But requirement implies "editing course content". 
    // I will NOT rollback enrolledStudents unless explicitly desired, as that messes up student records.
    // Keeping enrolledStudents as is from CURRENT course.

    await course.save();

    res.json({ message: "Course rolled back successfully", course });

  } catch (error) {
    console.error("Rollback error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
