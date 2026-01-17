import express from "express";
import { getBinItems, restoreItem, permanentlyDeleteItem } from "../controllers/binController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All bin operations restricted to Admin/Trainer
// (Assuming Trainers can restore their own stuff? Requirement didn't specify, sticking to Admin for management mainly, or Admin/Trainer)
// Let's allow Admin for now to be safe, or Admin/Trainer.
router.use(protect);
router.use(authorizeRoles("admin", "trainer"));

router.get("/", getBinItems);
router.post("/:id/restore", restoreItem);
router.delete("/:id", permanentlyDeleteItem);

export default router;
