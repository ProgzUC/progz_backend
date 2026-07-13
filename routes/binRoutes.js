import express from "express";
import { getBinItems, restoreItem, permanentlyDeleteItem } from "../controllers/binController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All bin operations restricted to Admin/Trainer
// (Assuming Trainers can restore their own stuff? Requirement didn't specify, sticking to Admin for management mainly, or Admin/Trainer)
// Let's allow Admin for now to be safe, or Admin/Trainer.
router.use(protect);
router.use(authorizeRoles("admin", "trainer"));

/**
 * @swagger
 * tags:
 *   name: Recycle Bin
 *   description: Soft-deleted items management
 */

/**
 * @swagger
 * /bin:
 *   get:
 *     summary: List items in the recycle bin
 *     tags: [Recycle Bin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bin items
 */
router.get("/", getBinItems);

/**
 * @swagger
 * /bin/{id}/restore:
 *   post:
 *     summary: Restore an item from the recycle bin
 *     tags: [Recycle Bin]
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
 *         description: Item restored
 */
router.post("/:id/restore", restoreItem);

/**
 * @swagger
 * /bin/{id}:
 *   delete:
 *     summary: Permanently delete an item from the recycle bin
 *     tags: [Recycle Bin]
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
 *         description: Item permanently deleted
 */
router.delete("/:id", permanentlyDeleteItem);

export default router;
