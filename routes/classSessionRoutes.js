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

console.log("🔧 Loading classSessionRoutes.js");

// Health check route (no auth required)
router.get("/health", (req, res) => {
    res.json({
        message: "Class session routes are working!",
        timestamp: new Date(),
        availableRoutes: [
            "POST /start",
            "PATCH /:id/attendance",
            "PATCH /:id/end",
            "GET /batch/:batchId",
            "GET /student/me",
            "GET /batch/:batchId/report"
        ]
    });
});

// Trainer routes
router.post("/start", protect, authorizeRoles("trainer"), startClass);
router.patch("/:id/attendance", protect, authorizeRoles("trainer"), markAttendance);
router.patch("/:id/end", protect, authorizeRoles("trainer"), endClass);
router.get("/batch/:batchId", protect, authorizeRoles("trainer", "admin"), getClassSessions);

// Student routes
router.get("/student/me", protect, authorizeRoles("student"), getStudentAttendance);

// Admin routes
router.get("/batch/:batchId/report", protect, authorizeRoles("admin", "trainer"), getBatchAttendanceReport);

console.log("✅ Class session routes defined successfully");

export default router;
