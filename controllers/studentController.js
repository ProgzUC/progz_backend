import User from "../models/User.js";
import Course from "../models/Course.js";
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

        const enrolledCourses = (user.enrolledCourses || []).map(ec => ({
            courseId: ec.course?._id,
            courseName: ec.course?.courseName,
            thumbnail: ec.course?.thumbnail || null,
            batchId: ec.batch?._id || null,
            batchName: ec.batch?.name || null,
            enrolledAt: ec.enrolledAt,
            // progress calculation not implemented here (depends on how you track lesson progress)
        }));

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

        // Return course and any enrollment info from the user document
        const user = await User.findById(studentId).lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const course = await Course.findById(courseId).lean();
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const enrollment = (user.enrolledCourses || []).find(ec => String(ec.course) === String(courseId)) || null;

        res.json({ course, enrollment });
    } catch (error) {
        console.error("Get course progress error:", error);
        res.status(500).json({ message: "Failed to fetch course progress" });
    }
}