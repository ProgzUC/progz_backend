import express from "express";
import { 
  triggerSync, 
  getZenTrainers,
  getSyncLogs,
  getSyncStatus
} from "../controllers/syncController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Apply protection to all endpoints
router.use(protect);
router.use(authorizeRoles("admin"));

// Sync Action Endpoints
router.post("/manual", triggerSync);
router.get("/trainers", getZenTrainers);

// Sync Telemetry Endpoints
router.get("/logs", getSyncLogs);
router.get("/status", getSyncStatus);

export default router;
