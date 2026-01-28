import User from "../models/User.js";
import Course from "../models/Course.js";
import Batch from "../models/Batch.js";
import bcrypt from "bcryptjs";

/**
 * @desc    Get student profile
 * @route   GET /api/student/profile
 * @access  Private (Student)
 */
export async function getStudentProfile(req, res) {
    try {
        const studentId = req.user.id;

        const user = await User.findById(studentId).select("-password").lean();

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            location: user.location || "",
            education: user.education || "",
            jobTitle: user.jobTitle || "",
            role: user.role
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: "Failed to fetch profile" });
    }
}

/**
 * @desc    Update student profile
 * @route   PUT /api/student/profile
 * @access  Private (Student)
 */
export async function updateStudentProfile(req, res) {
    try {
        const studentId = req.user.id;
        const { phone, location, education, jobTitle } = req.body;

        const user = await User.findByIdAndUpdate(
            studentId,
            { phone, location, education, jobTitle },
            { new: true, runValidators: true }
        ).select("-password").lean();

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            name: user.name,
            email: user.email,
            phone: user.phone,
            location: user.location,
            education: user.education,
            jobTitle: user.jobTitle,
            role: user.role
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
}

/**
 * @desc    Change student password
 * @route   POST /api/student/change-password
 * @access  Private (Student)
 */
export async function changePassword(req, res) {
    try {
        const studentId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const user = await User.findById(studentId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isMatch = await compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        // Hash and update new password
        const salt = await genSalt(10);
        user.password = await hash(newPassword, salt);
        await user.save();

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Failed to change password" });
    }
}

/**
 * @desc    Get student's enrolled courses with progress
 * @route   GET /api/student/my-courses
 * @access  Private (Student)
 */
export async function getStudentCourses(req, res) {
  try {
    const studentId = req.user.id;

    const user = await User.findById(studentId)
      .populate({ path: "enrolledCourses.course", select: "courseName modules thumbnail instructor" })
      .populate({ path: "enrolledCourses.batch", select: "name sectionProgress" })
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    const enrolledCourses = [];

    for (const ec of user.enrolledCourses || []) {
      const courseDoc = ec.course;
      const batch = ec.batch;

      const totalSections =
        courseDoc?.modules?.reduce(
          (acc, m) => acc + (m.sections?.length || 0),
          0
        ) || 0;

      let completedList = [];
      if (batch && Array.isArray(batch.sectionProgress)) {
        completedList = batch.sectionProgress.filter(
          sp =>
            sp.isCompleted &&
            String(sp.completedBy) === String(user._id)
        );
      }

      const completedLessons = completedList.length;
      const progressPercentage =
        totalSections > 0
          ? Math.round((completedLessons / totalSections) * 100)
          : 0;

      enrolledCourses.push({
        courseId: courseDoc?._id,
        courseName: courseDoc?.courseName,
        thumbnail: courseDoc?.thumbnail || null,
        instructor: courseDoc?.instructor || "Instructor Name",
        category: "Development",
        courseImage: courseDoc?.thumbnail || null,
        batchId: batch?._id || null,
        batchName: batch?.name || null,
        enrolledAt: ec.enrolledAt,
        totalLessons: totalSections,
        completedLessons,
        progressPercentage,

        modules: (courseDoc?.modules || []).map((module, modIdx) => ({
          moduleName: module.title,
          title: module.title,
          sections: (module.sections || []).map((section, secIdx) => {
            const isCompleted = completedList.some(
              c => c.moduleIndex === modIdx && c.sectionIndex === secIdx
            );

            return {
              sectionName: section.sectionName,
              title: section.sectionName,
              isCompleted,
            };
          }),
        })),
      });
    }

    res.json({ enrolledCourses });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
}


/**
 * @desc    Get detailed progress for a specific course
 * @route   GET /api/student/course/:courseId/progress
 * @access  Private (Student)
 */
export async function getCourseProgress(req, res) {
    try {
        const studentId = req.user.id;
        const { courseId } = req.params;

        // Return course and enrollment + batch-based progress info
        const user = await User.findById(studentId).lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const course = await Course.findById(courseId).lean();
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Find user's enrollment for this course (may contain batch reference)
        const enrollment = (user.enrolledCourses || []).find(ec => String(ec.course) === String(courseId)) || null;

        // Determine the batch to use for progress (prefer enrollment.batch)
        let batch = null;
        if (enrollment && enrollment.batch) {
            batch = await Batch.findById(enrollment.batch).lean();
        } else {
            // fallback: find any batch for this course that includes the student
            batch = await Batch.findOne({ course: courseId, students: studentId }).lean();
        }

        // Compute totals from course modules
        const totalSections = (course.modules || []).reduce(
            (acc, mod) => acc + (mod.sections?.length || 0),
            0
        );

        // Compute completed sections by this student within the batch
        let completedSections = 0;
        let completedList = [];
        if (batch && Array.isArray(batch.sectionProgress)) {
            completedList = batch.sectionProgress
                .filter(sp => sp.isCompleted && String(sp.completedBy) === String(studentId))
                .map(sp => ({ moduleIndex: sp.moduleIndex, sectionIndex: sp.sectionIndex, completionTime: sp.completionTime }));
            completedSections = completedList.length;
        }

        const completionPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

        const batchInfo = batch
            ? {
                batchId: batch._id,
                batchName: batch.name,
                startDate: batch.startDate,
                endDate: batch.endDate,
                status: batch.status,
                classTiming: batch.classTiming,
                meetLink: batch.meetLink,
                daysOfWeek: batch.daysOfWeek,
            }
            : null;

        res.json({
            course: {
                _id: course._id,
                courseId: course._id,
                courseName: course.courseName,
                thumbnail: course.thumbnail,
                instructor: course.instructor,

                // ADD THIS - Full modules with all section data
                modules: (course.modules || []).map((module, modIdx) => ({
                    moduleName: module.title || module.moduleName,
                    title: module.title || module.moduleName,
                    sections: (module.sections || []).map((section, secIdx) => {
                        // Check if completed
                        const isCompleted = completedList.some(
                            c => c.moduleIndex === modIdx && c.sectionIndex === secIdx
                        );

                        return {
                            sectionName: section.sectionName || section.title,
                            title: section.title || section.sectionName,

                            // Section content - CRITICAL for lesson view
                            learningMaterialNotes: section.learningMaterialNotes || section.notes || "",
                            notes: section.notes || section.learningMaterialNotes || "",
                            learningMaterialFile: section.learningMaterialFile || [],
                            learningMaterialFiles: section.learningMaterialFile || [],

                            codeChallengeInstructions: section.codeChallengeInstructions || "",
                            codeChallengeFile: section.codeChallengeFile || [],
                            codeChallengeFiles: section.codeChallengeFile || [],

                            videos: section.videoReferences || section.videos || [],
                            videoReferences: section.videoReferences || section.videos || [],

                            isCompleted
                        };
                    })
                }))
            },
            enrollment,
            enrollmentDate: enrollment?.enrolledAt,
            batch: batchInfo,
            progress: {
                totalSections,
                completedSections,
                completionPercentage,
                completedList,
            },
            lessonProgress: completedList // Frontend expects this
        });
    } catch (error) {
        console.error("Get course progress error:", error);
        res.status(500).json({ message: "Failed to fetch course progress" });
    }
}