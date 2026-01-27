import { Router } from "express";
const router = Router();
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import { getStudentProfile, updateStudentProfile, changePassword, getStudentCourses, getCourseProgress } from "../controllers/studentController.js";

// Profile routes
router.get("/profile", protect, authorizeRoles("student"), getStudentProfile);
router.put("/profile", protect, authorizeRoles("student"), updateStudentProfile);
router.post("/change-password", protect, authorizeRoles("student"), changePassword);

// Course routes
router.get("/my-courses", protect, authorizeRoles("student"), getStudentCourses);
router.get("/course/:courseId/progress", protect, authorizeRoles("student"), getCourseProgress);

export default router;