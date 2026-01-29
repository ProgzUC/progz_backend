import { Router } from "express";
const router = Router();
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
    startClass,
    markAttendance,
    endClass,
    getClassSessions,
    getStudentAttendance,
    getBatchAttendanceReport,
} from "../controllers/classSessionController.js";

// Trainer routes
router.post("/start", protect, authorizeRoles("trainer"), startClass);
router.patch("/:id/attendance", protect, authorizeRoles("trainer"), markAttendance);
router.patch("/:id/end", protect, authorizeRoles("trainer"), endClass);
router.get("/batch/:batchId", protect, authorizeRoles("trainer", "admin"), getClassSessions);

// Student routes
router.get("/student/me", protect, authorizeRoles("student"), getStudentAttendance);

// Admin routes
router.get("/batch/:batchId/report", protect, authorizeRoles("admin", "trainer"), getBatchAttendanceReport);

export default router;
