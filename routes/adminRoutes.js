import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  getAdminStats,
  getEnrollmentTrends,
  getUserDistribution,
  getRecentActivity,
} from "../controllers/adminController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin dashboard statistics
 */

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Get overall admin dashboard stats
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved
 */

/**
 * @swagger
 * /admin/enrollment-trends:
 *   get:
 *     summary: Get enrollment trends over time
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrollment trends retrieved
 */

/**
 * @swagger
 * /admin/user-distribution:
 *   get:
 *     summary: Get user distribution by role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User distribution retrieved
 */

/**
 * @swagger
 * /admin/recent-activity:
 *   get:
 *     summary: Get recent platform activity
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent activity retrieved
 */
router.get('/stats', protect, authorizeRoles('admin'), getAdminStats);
router.get('/enrollment-trends', protect, authorizeRoles('admin'), getEnrollmentTrends);
router.get('/user-distribution', protect, authorizeRoles('admin'), getUserDistribution);
router.get('/recent-activity', protect, authorizeRoles('admin'), getRecentActivity);

export default router;
