import express from "express";
import { triggerSync, getZenTrainers } from "../controllers/syncController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Manual Sync (Admin Only)
router.post("/manual", protect, authorizeRoles("admin"), triggerSync);
router.get("/trainers", protect, authorizeRoles("admin"), getZenTrainers);

export default router;
