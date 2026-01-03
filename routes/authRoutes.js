import express from "express";
import { register, login, forgotPassword, resetPassword } from "../controllers/authController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

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
