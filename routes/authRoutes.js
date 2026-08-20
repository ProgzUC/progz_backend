import express from "express";
import {
  register,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
} from "../controllers/authController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import { loginRateLimit } from "../middlewares/loginRateLimit.js";

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
 *     summary: Log in and receive auth cookies (HTTP-only)
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
 * /auth/refresh:
 *   post:
 *     summary: Rotate refresh token and issue new access token via cookies
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: New access and refresh tokens issued via cookies
 *       401:
 *         description: Invalid or expired refresh token
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out and clear auth cookies
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out successfully
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
router.post("/login", loginRateLimit, login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/me", protect, getMe);

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
