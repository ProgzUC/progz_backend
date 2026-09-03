import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  getSystemMetrics,
  getAuditLogs,
  getErrorLogs,
  resolveErrorLog,
  deleteErrorLog,
  getHistoricalMetrics
} from "../controllers/monitoringController.js";

const router = express.Router();

// Apply admin protection to all monitoring endpoints
router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/metrics", getSystemMetrics);
router.get("/audit-logs", getAuditLogs);
router.get("/error-logs", getErrorLogs);
router.put("/error-logs/:id/resolve", resolveErrorLog);
router.delete("/error-logs/:id", deleteErrorLog);
router.get("/historical", getHistoricalMetrics);

export default router;
