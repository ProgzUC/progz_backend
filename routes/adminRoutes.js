import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  getAdminStats,
  getEnrollmentTrends,
  getUserDistribution,
  getRecentActivity,
} from "../controllers/adminController.js";

const router = express.Router();

router.get('/stats', protect, authorizeRoles('admin'), getAdminStats);
router.get('/enrollment-trends', protect, authorizeRoles('admin'), getEnrollmentTrends);
router.get('/user-distribution', protect, authorizeRoles('admin'), getUserDistribution);
router.get('/recent-activity', protect, authorizeRoles('admin'), getRecentActivity);

export default router;
