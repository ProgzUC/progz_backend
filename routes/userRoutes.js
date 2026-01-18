import express from "express";
import { registerUser, approveUser, getAllPendingUsers, rejectUser, deleteUser, updateUser, getUser, getAllUsers } from "../controllers/userController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public route to register (creates a pending request)
router.post("/register", registerUser);

// Admin-protected routes
router.post("/approve/:id", protect, authorizeRoles("admin"), approveUser);
router.get("/pending", protect, authorizeRoles("admin"), getAllPendingUsers);
router.delete("/pending/:id", protect, authorizeRoles("admin"), rejectUser);

// Admin: Get all users
router.get("/allUsers", protect, authorizeRoles("admin"), getAllUsers);

// Admin: Delete user (Soft delete)
router.delete("/:id", protect, authorizeRoles("admin"), deleteUser);

// Update user (Self or Admin)
router.put("/:id", protect, updateUser);

// Get user details (Self or Admin)
router.get("/:id", protect, getUser);

export default router;
