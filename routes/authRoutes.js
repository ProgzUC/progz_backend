import express from "express";
import { register, login, forgotPassword, resetPassword } from "../controllers/authController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registration, login and password reset
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       201:
 *         description: User registered
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in and receive access/refresh tokens
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Reset email sent
 */

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using the emailed token
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Password reset
 */

// PUBLIC ROUTES
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// // PROTECTED ADMIN ONLY
// router.get("/admin-dashboard", protect, authorizeRoles("admin"), (req, res) => {
//   res.send("Admin dashboard");
// });

// // TRAINER
// router.get("/trainer-dashboard", protect, authorizeRoles("trainer"), (req, res) => {
//   res.send("Trainer dashboard");
// });

// // STUDENT
// router.get("/student-dashboard", protect, authorizeRoles("student"), (req, res) => {
//   res.send("Student dashboard");
// });

export default router;
