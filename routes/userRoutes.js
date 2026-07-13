import express from "express";
import { registerUser, adminCreateUser, approveUser, getAllPendingUsers, rejectUser, deleteUser, updateUser, getUser, getAllUsers } from "../controllers/userController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User registration, approval and management
 */

/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Register (creates a pending approval request)
 *     tags: [Users]
 *     security: []
 *     responses:
 *       201:
 *         description: Registration request created
 */
// Public route to register (creates a pending request)
router.post("/register", registerUser);

/**
 * @swagger
 * /users/admin-create:
 *   post:
 *     summary: Admin directly creates a user (no approval needed)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: User created
 */
// Admin-protected routes
router.post("/admin-create", protect, authorizeRoles("admin"), adminCreateUser);

/**
 * @swagger
 * /users/approve/{id}:
 *   post:
 *     summary: Approve a pending user registration
 *     tags: [Users]
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
 *         description: User approved
 */
router.post("/approve/:id", protect, authorizeRoles("admin"), approveUser);

/**
 * @swagger
 * /users/pending:
 *   get:
 *     summary: Get all pending user registrations
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending users
 */
router.get("/pending", protect, authorizeRoles("admin"), getAllPendingUsers);

/**
 * @swagger
 * /users/pending/{id}:
 *   delete:
 *     summary: Reject a pending user registration
 *     tags: [Users]
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
 *         description: User rejected
 */
router.delete("/pending/:id", protect, authorizeRoles("admin"), rejectUser);

/**
 * @swagger
 * /users/allUsers:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 */
// Admin: Get all users
router.get("/allUsers", protect, authorizeRoles("admin"), getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Soft-delete a user
 *     tags: [Users]
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
 *         description: User deleted
 *   put:
 *     summary: Update a user (self or admin)
 *     tags: [Users]
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
 *         description: User updated
 *   get:
 *     summary: Get user details (self or admin)
 *     tags: [Users]
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
 *         description: User details retrieved
 */
// Admin: Delete user (Soft delete)
router.delete("/:id", protect, authorizeRoles("admin"), deleteUser);

// Update user (Self or Admin)
router.put("/:id", protect, updateUser);

// Get user details (Self or Admin)
router.get("/:id", protect, getUser);

export default router;
