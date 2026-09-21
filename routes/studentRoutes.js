import { Router } from "express";
const router = Router();
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import { getStudentProfile, updateStudentProfile, changePassword, getStudentCourses, getCourseProgress } from "../controllers/studentController.js";
import { listPortalAnnouncements } from "../controllers/announcementController.js";
import { submissionRateLimit } from "../middlewares/rateLimit.js";
import { validate, changePasswordSchema } from "../middlewares/validate.js";

/**
 * @swagger
 * tags:
 *   name: Student
 *   description: Student profile and course progress
 */

/**
 * @swagger
 * /student/profile:
 *   get:
 *     summary: Get the logged-in student's profile
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
 *   put:
 *     summary: Update the logged-in student's profile
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated
 */
// Profile routes
router.get("/profile", protect, authorizeRoles("student"), getStudentProfile);
router.put(
  "/profile",
  protect,
  authorizeRoles("student"),
  submissionRateLimit,
  updateStudentProfile
);

/**
 * @swagger
 * /student/change-password:
 *   post:
 *     summary: Change the logged-in student's password
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password changed
 */
router.post(
  "/change-password",
  protect,
  authorizeRoles("student"),
  submissionRateLimit,
  validate(changePasswordSchema),
  changePassword
);

/**
 * @swagger
 * /student/my-courses:
 *   get:
 *     summary: Get courses the logged-in student is enrolled in
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrolled courses
 */
// Course routes
router.get("/my-courses", protect, authorizeRoles("student"), getStudentCourses);

/**
 * @swagger
 * /student/course/{courseId}/progress:
 *   get:
 *     summary: Get the student's progress in a course
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Progress retrieved
 */
router.get("/course/:courseId/progress", protect, authorizeRoles("student"), getCourseProgress);
router.get("/announcements", protect, authorizeRoles("student"), listPortalAnnouncements);

export default router;