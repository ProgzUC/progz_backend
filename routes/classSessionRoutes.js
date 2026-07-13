import { Router } from "express";
const router = Router();
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
    startClass,
    markAttendance,
    endClass,
    getClassSessions,
    getStudentAttendance,
    getBatchAttendanceReport,
} from "../controllers/classSessionController.js";

console.log("🔧 Loading classSessionRoutes.js");

/**
 * @swagger
 * tags:
 *   name: Class Sessions
 *   description: Live class sessions, attendance and reporting
 */

/**
 * @swagger
 * /class-session/health:
 *   get:
 *     summary: Health check for class session routes
 *     tags: [Class Sessions]
 *     security: []
 *     responses:
 *       200:
 *         description: Routes are working
 */
// Health check route (no auth required)
router.get("/health", (req, res) => {
    res.json({
        message: "Class session routes are working!",
        timestamp: new Date(),
        availableRoutes: [
            "POST /start",
            "PATCH /:id/attendance",
            "PATCH /:id/end",
            "GET /batch/:batchId",
            "GET /student/me",
            "GET /batch/:batchId/report"
        ]
    });
});

/**
 * @swagger
 * /class-session/start:
 *   post:
 *     summary: Start a live class session
 *     tags: [Class Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Class session started
 */
router.post("/start", protect, authorizeRoles("trainer"), startClass);

/**
 * @swagger
 * /class-session/{id}/attendance:
 *   patch:
 *     summary: Mark attendance for a class session
 *     tags: [Class Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attendance marked
 */
router.patch("/:id/attendance", protect, authorizeRoles("trainer"), markAttendance);

/**
 * @swagger
 * /class-session/{id}/end:
 *   patch:
 *     summary: End a live class session
 *     tags: [Class Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Class session ended
 */
router.patch("/:id/end", protect, authorizeRoles("trainer"), endClass);

/**
 * @swagger
 * /class-session/batch/{batchId}:
 *   get:
 *     summary: Get class sessions for a batch
 *     tags: [Class Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of class sessions
 */
router.get("/batch/:batchId", protect, authorizeRoles("trainer", "admin"), getClassSessions);

/**
 * @swagger
 * /class-session/student/me:
 *   get:
 *     summary: Get the logged-in student's attendance
 *     tags: [Class Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Attendance retrieved
 */
router.get("/student/me", protect, authorizeRoles("student"), getStudentAttendance);

/**
 * @swagger
 * /class-session/batch/{batchId}/report:
 *   get:
 *     summary: Get an attendance report for a batch
 *     tags: [Class Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attendance report retrieved
 */
router.get("/batch/:batchId/report", protect, authorizeRoles("admin", "trainer"), getBatchAttendanceReport);

console.log("✅ Class session routes defined successfully");

export default router;
