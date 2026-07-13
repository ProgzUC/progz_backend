import express from "express";
import {
    createBatch,
    getAllBatches,
    getBatch,
    enrollStudent,
    removeStudent,
    manageTrainers,
    toggleSectionCompletion,
    deleteBatch,
    updateBatch
} from "../controllers/batchController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Batches
 *   description: Batch creation, enrollment and management
 */

/**
 * @swagger
 * /batches:
 *   post:
 *     summary: Create a new batch
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Batch created
 *   get:
 *     summary: Get all batches
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of batches
 */
router.post("/", protect, authorizeRoles("admin", "trainer"), createBatch);
router.get("/", protect, getAllBatches);

/**
 * @swagger
 * /batches/{id}:
 *   get:
 *     summary: Get a single batch by ID
 *     tags: [Batches]
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
 *         description: Batch found
 *   put:
 *     summary: Update a batch
 *     tags: [Batches]
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
 *         description: Batch updated
 *   delete:
 *     summary: Delete a batch
 *     tags: [Batches]
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
 *         description: Batch deleted
 */
router.get("/:id", protect, getBatch);

/**
 * @swagger
 * /batches/{id}/enroll:
 *   post:
 *     summary: Enroll a student into the batch
 *     tags: [Batches]
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
 *         description: Student enrolled
 */
router.post("/:id/enroll", protect, authorizeRoles("admin", "trainer"), enrollStudent);

/**
 * @swagger
 * /batches/{id}/remove-student:
 *   post:
 *     summary: Remove a student from the batch
 *     tags: [Batches]
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
 *         description: Student removed
 */
router.post("/:id/remove-student", protect, authorizeRoles("admin", "trainer"), removeStudent);

/**
 * @swagger
 * /batches/{id}/trainers:
 *   post:
 *     summary: Manage trainers assigned to the batch
 *     tags: [Batches]
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
 *         description: Trainers updated
 */
router.post("/:id/trainers", protect, authorizeRoles("admin", "trainer"), manageTrainers);

/**
 * @swagger
 * /batches/{id}/sections/toggle:
 *   post:
 *     summary: Toggle a section's completion status for the batch
 *     tags: [Batches]
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
 *         description: Section completion toggled
 */
router.post("/:id/sections/toggle", protect, authorizeRoles("admin", "trainer"), toggleSectionCompletion);
router.delete("/:id", protect, authorizeRoles("admin", "trainer"), deleteBatch);
router.put("/:id", protect, authorizeRoles("admin", "trainer"), updateBatch);

export default router;
