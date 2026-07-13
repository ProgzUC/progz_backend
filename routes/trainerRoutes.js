import express from "express";
import { authorizeRoles, protect } from "../middlewares/authMiddleware.js";
import { trainerBootstrap, getTrainerBatchDetails, toggleSectionCompletion, getTrainerCourses, getTrainerprofile, updateTrainerprofile } from "../controllers/trainerController.js";


const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Trainer
 *   description: Trainer dashboard, batches, courses and profile
 */

/**
 * @swagger
 * /trainer/trainer-summary:
 *   get:
 *     summary: Get the logged-in trainer's dashboard summary
 *     tags: [Trainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary retrieved
 */
router.get("/trainer-summary", protect, authorizeRoles("trainer"), trainerBootstrap);

/**
 * @swagger
 * /trainer/trainer-batch-details/{batchId}:
 *   get:
 *     summary: Get batch details for the trainer
 *     tags: [Trainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Batch details retrieved
 */
router.get("/trainer-batch-details/:batchId", protect, authorizeRoles("trainer"), getTrainerBatchDetails);

/**
 * @swagger
 * /trainer/trainer-section-complete:
 *   post:
 *     summary: Toggle a section's completion status
 *     tags: [Trainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Section completion toggled
 */
router.post("/trainer-section-complete", protect, authorizeRoles("trainer"), toggleSectionCompletion);

/**
 * @swagger
 * /trainer/trainer-courses:
 *   get:
 *     summary: Get courses assigned to the trainer
 *     tags: [Trainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trainer courses
 */
router.get("/trainer-courses", protect, authorizeRoles("trainer"), getTrainerCourses);

/**
 * @swagger
 * /trainer/trainer-profile:
 *   get:
 *     summary: Get the logged-in trainer's profile
 *     tags: [Trainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
 *   put:
 *     summary: Update the logged-in trainer's profile
 *     tags: [Trainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.get("/trainer-profile", protect, authorizeRoles("trainer"), getTrainerprofile);
router.put("/trainer-profile", protect, authorizeRoles("trainer"), updateTrainerprofile);

export default router; 

/*
router.get("/bootstrap", auth, isTrainer, trainerBootstrap);
router.get("/batch/:batchId", auth, isTrainer, getTrainerBatchDetails);
router.post("/batch/section/complete", auth, isTrainer, markSectionComplete);
router.get("/my-courses", auth, isTrainer, getTrainerCourses);
router.get("/profile", auth, isTrainer, getTrainerProfile);
router.put("/profile", auth, isTrainer, updateTrainerProfile);

*/