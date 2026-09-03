import express from "express";
import {
    createBatch,
    getAllBatches,
    getBatch,
    enrollStudent,
    bulkEnrollStudents,
    removeStudent,
    manageTrainers,
    toggleSectionCompletion,
    deleteBatch,
    updateBatch
} from "../controllers/batchController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();
const staffRoles = authorizeRoles("admin", "trainer");

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
router.post("/", protect, staffRoles, createBatch);
router.get("/", protect, staffRoles, getAllBatches);

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
router.get("/:id", protect, staffRoles, getBatch);

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
router.post("/:id/enroll", protect, staffRoles, enrollStudent);
router.post("/:id/bulk-enroll", protect, staffRoles, bulkEnrollStudents);

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
router.post("/:id/remove-student", protect, staffRoles, removeStudent);

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
router.post("/:id/trainers", protect, staffRoles, manageTrainers);

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
router.post("/:id/sections/toggle", protect, staffRoles, toggleSectionCompletion);
router.delete("/:id", protect, staffRoles, deleteBatch);
router.put("/:id", protect, staffRoles, updateBatch);

export default router;
