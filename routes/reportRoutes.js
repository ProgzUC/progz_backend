import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  getOperationalSummary,
  getAttendanceAnalytics,
  getEnrollmentAnalytics,
  getTrainerUtilization,
  getBatchHealthReport,
  exportAttendanceCSV
} from "../controllers/reportController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Operational reports and business analytics
 */

// All report routes require admin privileges
router.use(protect);
router.use(authorizeRoles("admin"));

/**
 * @swagger
 * /admin/reports/operational-summary:
 *   get:
 *     summary: Get executive KPIs and operational summary
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operational summary retrieved
 */
router.get('/operational-summary', getOperationalSummary);

/**
 * @swagger
 * /admin/reports/attendance-analytics:
 *   get:
 *     summary: Get attendance trends, batch comparison, and at-risk students
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attendance analytics retrieved
 */
router.get('/attendance-analytics', getAttendanceAnalytics);

/**
 * @swagger
 * /admin/reports/enrollment-analytics:
 *   get:
 *     summary: Get enrollment trends, course distribution, and capacity metrics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrollment analytics retrieved
 */
router.get('/enrollment-analytics', getEnrollmentAnalytics);

/**
 * @swagger
 * /admin/reports/trainer-utilization:
 *   get:
 *     summary: Get trainer workload and utilization metrics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trainer utilization retrieved
 */
router.get('/trainer-utilization', getTrainerUtilization);

/**
 * @swagger
 * /admin/reports/batch-health:
 *   get:
 *     summary: Get batch lifecycle status and syllabus progress
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Batch health report retrieved
 */
router.get('/batch-health', getBatchHealthReport);

/**
 * @swagger
 * /admin/reports/export/attendance:
 *   get:
 *     summary: Export attendance logs to CSV
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/export/attendance', exportAttendanceCSV);

export default router;
