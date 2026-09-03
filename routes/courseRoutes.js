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
const staffRoles = authorizeRoles("admin", "trainer");

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
    .post(protect, staffRoles, createCourse)
    .get(protect, staffRoles, getAllCourses);

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
    .get(protect, staffRoles, getCourse)
    .put(protect, staffRoles, updateCourse)
    .delete(protect, staffRoles, deleteCourse);

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
router.get("/:id/versions", protect, staffRoles, getCourseVersions);

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
router.post("/:id/rollback/:versionId", protect, staffRoles, rollbackCourse);

router.put("/:id/instructors/add", protect, staffRoles, addInstructor);
router.put("/:id/instructors/remove", protect, staffRoles, removeInstructor);
router.put("/:id/instructors", protect, staffRoles, updateInstructors);

export default router;