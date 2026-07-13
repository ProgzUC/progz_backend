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

/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: Course creation, editing, versioning and rollback
 */

/**
 * @swagger
 * /courses:
 *   post:
 *     summary: Create a new course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Course created
 *   get:
 *     summary: Get all courses
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of courses
 */
router
    .route("/")
    .post(protect, authorizeRoles("admin", "trainer"), createCourse)
    .get(protect, getAllCourses);

/**
 * @swagger
 * /courses/{id}:
 *   get:
 *     summary: Get a single course by ID
 *     tags: [Courses]
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
 *         description: Course found
 *       404:
 *         description: Course not found
 *   put:
 *     summary: Update course details (creates a version snapshot first)
 *     tags: [Courses]
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
 *         description: Course updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Course not found
 *   delete:
 *     summary: Delete a course
 *     tags: [Courses]
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
 *         description: Course deleted
 */
router
    .route("/:id")
    .get(protect, getCourse)
    .put(protect, authorizeRoles("admin", "trainer"), updateCourse)
    .delete(protect, authorizeRoles("admin", "trainer"), deleteCourse);

/**
 * @swagger
 * /courses/{id}/versions:
 *   get:
 *     summary: List version snapshots for a course
 *     tags: [Courses]
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
 *         description: List of course versions
 */
router.get("/:id/versions", protect, getCourseVersions);

/**
 * @swagger
 * /courses/{id}/rollback/{versionId}:
 *   post:
 *     summary: Rollback a course to a previous version
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course rolled back
 */
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