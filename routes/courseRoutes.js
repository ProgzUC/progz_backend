import express from "express";
import {
    createCourse,
    getAllCourses,
    getCourse,
    deleteCourse,
    addInstructor,
    removeInstructor,
    updateInstructors,
    updateCourse,
    getCourseVersions,
    rollbackCourse,
} from "../controllers/courseController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

router
    .route("/")
    .post(protect, authorizeRoles("admin", "trainer"), createCourse)
    .get(protect, getAllCourses);

router
    .route("/:id")
    .get(protect, getCourse)
    .put(protect, authorizeRoles("admin", "trainer"), updateCourse)
    .delete(protect, authorizeRoles("admin", "trainer"), deleteCourse);

router.get("/:id/versions", protect, getCourseVersions);
router.post("/:id/rollback/:versionId", protect, authorizeRoles("admin", "trainer"), rollbackCourse);

router.put(
    "/:id/instructors/add",
    protect,
    authorizeRoles("admin", "trainer"),
    addInstructor
);
router.put(
    "/:id/instructors/remove",
    protect,
    authorizeRoles("admin", "trainer"),
    removeInstructor
);
router.put(
    "/:id/instructors",
    protect,
    authorizeRoles("admin", "trainer"),
    updateInstructors
);

export default router;