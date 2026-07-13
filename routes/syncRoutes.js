import express from "express";
import { triggerSync, getZenTrainers } from "../controllers/syncController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sync
 *   description: Zen external data sync (Admin only)
 */

/**
 * @swagger
 * /sync/manual:
 *   post:
 *     summary: Trigger a manual sync with the Zen system
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync triggered
 */
// Manual Sync (Admin Only)
router.post("/manual", protect, authorizeRoles("admin"), triggerSync);

/**
 * @swagger
 * /sync/trainers:
 *   get:
 *     summary: Get trainers from the Zen system
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of Zen trainers
 */
router.get("/trainers", protect, authorizeRoles("admin"), getZenTrainers);

export default router;
