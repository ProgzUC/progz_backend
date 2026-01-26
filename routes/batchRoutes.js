import express from "express";
import {
    createBatch,
    getAllBatches,
    getBatch,
    enrollStudent,
    removeStudent,
    manageTrainers,
    toggleSectionCompletion,
    deleteBatch
} from "../controllers/batchController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", protect, authorizeRoles("admin", "trainer"), createBatch);
router.get("/", protect, getAllBatches);
router.get("/:id", protect, getBatch);

router.post("/:id/enroll", protect, authorizeRoles("admin", "trainer"), enrollStudent);
router.post("/:id/remove-student", protect, authorizeRoles("admin", "trainer"), removeStudent);
router.post("/:id/trainers", protect, authorizeRoles("admin", "trainer"), manageTrainers);
router.post("/:id/sections/toggle", protect, authorizeRoles("admin", "trainer"), toggleSectionCompletion);
router.delete("/:id", protect, authorizeRoles("admin", "trainer"), deleteBatch);

export default router;
