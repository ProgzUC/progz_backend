const User = require("../models/User");
const Enrollment = require("../models/Enrollment"); // Adjust path as needed
const bcrypt = require("bcryptjs");

/**
 * @desc    Get student profile
 * @route   GET /api/student/profile
 * @access  Private (Student)
 */
exports.getStudentProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        
        const user = await User.findById(studentId).select("-password");
        
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
};

/**
 * @desc    Update student profile
 * @route   PUT /api/student/profile
 * @access  Private (Student)
 */
exports.updateStudentProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { phone, location, education, jobTitle } = req.body;

        const user = await User.findByIdAndUpdate(
            studentId,
            { phone, location, education, jobTitle },
            { new: true, runValidators: true }
        ).select("-password");

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
};

/**
 * @desc    Change student password
 * @route   POST /api/student/change-password
 * @access  Private (Student)
 */
exports.changePassword = async (req, res) => {
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
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        // Hash and update new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Failed to change password" });
    }
};

/**
 * @desc    Get student's enrolled courses with progress
 * @route   GET /api/student/my-courses
 * @access  Private (Student)
 */
exports.getStudentCourses = async (req, res) => {
    try {
        const studentId = req.user.id;

        const enrollments = await Enrollment.find({ student: studentId })
            .populate("course", "courseName modules image") // Adjust fields as per your Course model
            .populate("batch", "name")
            .lean();

        const enrolledCourses = enrollments.map(enrollment => {
            const course = enrollment.course;
            const modules = course.modules || [];
            
            // Calculate total and completed lessons
            let totalLessons = 0;
            let completedLessons = 0;

            const enrichedModules = modules.map((module, modIdx) => {
                const sections = module.sections || [];
                totalLessons += sections.length;

                const enrichedSections = sections.map((section, secIdx) => {
                    const progress = enrollment.lessonProgress?.find(
                        p => p.moduleIndex === modIdx && p.sectionIndex === secIdx
                    );
                    const isCompleted = progress?.isCompleted || false;
                    if (isCompleted) completedLessons++;

                    return {
                        sectionName: section.sectionName || section.title,
                        isCompleted
                    };
                });

                return {
                    moduleName: module.title || module.moduleName,
                    sections: enrichedSections
                };
            });

            const progressPercentage = totalLessons > 0 
                ? Math.round((completedLessons / totalLessons) * 100) 
                : 0;

            return {
                courseId: course._id,
                courseName: course.courseName,
                courseImage: course.image || "/default-course.jpg",
                instructor: "Instructor Name", // TODO: Get from course instructor field
                category: "Category", // TODO: Get from course category field
                totalLessons,
                completedLessons,
                progressPercentage,
                modules: enrichedModules
            };
        });

        res.json({ enrolledCourses });
    } catch (error) {
        console.error("Get courses error:", error);
        res.status(500).json({ message: "Failed to fetch courses" });
    }
};

/**
 * @desc    Get detailed progress for a specific course
 * @route   GET /api/student/course/:courseId/progress
 * @access  Private (Student)
 */
exports.getCourseProgress = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { courseId } = req.params;

        const enrollment = await Enrollment.findOne({
            student: studentId,
            course: courseId
        }).populate("course").lean();

        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        res.json(enrollment);
    } catch (error) {
        console.error("Get course progress error:", error);
        res.status(500).json({ message: "Failed to fetch course progress" });
    }
};