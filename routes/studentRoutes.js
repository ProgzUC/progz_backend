const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const {
    getStudentProfile,
    updateStudentProfile,
    changePassword,
    getStudentCourses,
    getCourseProgress
} = require("../controllers/studentController");

// Profile routes
router.get("/profile", protect, authorizeRoles("student"), getStudentProfile);
router.put("/profile", protect, authorizeRoles("student"), updateStudentProfile);
router.post("/change-password", protect, authorizeRoles("student"), changePassword);

// Course routes
router.get("/my-courses", protect, authorizeRoles("student"), getStudentCourses);
router.get("/course/:courseId/progress", protect, authorizeRoles("student"), getCourseProgress);

module.exports = router;