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

        // Use User.enrolledCourses which references Course and Batch
        const user = await User.findById(studentId)
          .populate({ path: 'enrolledCourses.course', select: 'courseName modules thumbnail instructor' })
          .populate({ path: 'enrolledCourses.batch', select: 'name' })
          .lean();

        if (!user) return res.status(404).json({ message: 'User not found' });

        // For each enrolled course, compute progress using Batch.sectionProgress where possible
        const enrolledCourses = [];
        for (const ec of (user.enrolledCourses || [])) {
            const courseDoc = ec.course || null;
            const batchId = ec.batch || null;

            const totalSections = courseDoc?.modules?.reduce((acc, m) => acc + (m.sections?.length || 0), 0) || 0;

            let completedLessons = 0;
            if (batchId) {
                const batch = await Batch.findById(batchId).lean();
                if (batch && Array.isArray(batch.sectionProgress)) {
                    // Count entries where completedBy matches this student
                    completedLessons = batch.sectionProgress.filter(sp => String(sp.completedBy) === String(user._id)).length;
                }
            }

            const progressPercentage = totalSections > 0 ? Math.round((completedLessons / totalSections) * 100) : 0;

            enrolledCourses.push({
                courseId: courseDoc?._id,
                courseName: courseDoc?.courseName,
                thumbnail: courseDoc?.thumbnail || null,
                batchId: batchId || null,
                batchName: ec.batch?.name || null,
                enrolledAt: ec.enrolledAt,
                totalLessons: totalSections,
                completedLessons,
                progressPercentage,
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
            course: { courseId: course._id, courseName: course.courseName },
            enrollment,
            batch: batchInfo,
            progress: {
                totalSections,
                completedSections,
                completionPercentage,
                completedList,
            },
        });
    } catch (error) {
        console.error("Get course progress error:", error);
        res.status(500).json({ message: "Failed to fetch course progress" });
    }
}