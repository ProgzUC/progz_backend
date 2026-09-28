import User from "../models/User.js";
import Course from "../models/Course.js";
import Batch from "../models/Batch.js";
import bcrypt from "bcryptjs";
import { validatePassword } from "../utils/passwordValidation.js";
import { revokeRefreshToken } from "../utils/refreshTokenStore.js";
import { clearAuthCookies } from "../utils/cookieAuth.js";
import { filterCompletedForCourse } from "../utils/batchCourses.js";
import { isProperlyEnrolled } from "../utils/studentCourseAccess.js";
import { getNextClassDate } from "../utils/getNextClassDate.js";

function plainText(html) {
    if (!html) return "";
    return String(html)
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function formatDurationLabel(hours, months) {
    const parts = [];
    const monthsNum = Number(months);
    if (Number.isFinite(monthsNum) && monthsNum > 0) {
        parts.push(`${monthsNum} month${monthsNum === 1 ? "" : "s"}`);
    }
    const hoursNum = Number(hours);
    if (Number.isFinite(hoursNum) && hoursNum > 0) {
        parts.push(`${hoursNum} hour${hoursNum === 1 ? "" : "s"}`);
    }
    return parts.join(" · ") || "Self-paced";
}

function resolveNextClassAt(batch) {
    const startTime = batch?.classTiming?.startTime;
    const days = Array.isArray(batch?.daysOfWeek) ? batch.daysOfWeek : [];
    if (!startTime || days.length === 0) return null;
    try {
        const next = getNextClassDate(days, batch.classTiming);
        return next ? next.toISOString() : null;
    } catch {
        return null;
    }
}

function pickContinueLesson(modules) {
    let first = null;
    let lastReleased = null;
    (modules || []).forEach((module, moduleIndex) => {
        (module.sections || []).forEach((section, sectionIndex) => {
            const lesson = {
                moduleIndex,
                sectionIndex,
                title: section.sectionName || section.title || "Lesson",
                moduleName: module.moduleName || module.title || "",
            };
            if (!first) first = lesson;
            if (section.isCompleted) lastReleased = lesson;
        });
    });
    return lastReleased || first;
}

function summarizeCatalogCourse(course, enrolledIds) {
    const modules = course.modules || [];
    const lessonCount = modules.reduce((acc, module) => acc + (module.sections?.length || 0), 0);
    const instructors = (course.instructor || [])
        .map((person) => (typeof person === "object" ? person.name : null))
        .filter(Boolean);

    return {
        id: course._id,
        courseId: course._id,
        code: course.courseId,
        title: course.courseName,
        description: plainText(course.courseDescription),
        thumbnail: course.thumbnail?.url || null,
        durationLabel: formatDurationLabel(course.courseDuration, course.courseDurationMonths),
        moduleCount: modules.length,
        lessonCount,
        instructors,
        enrolled: enrolledIds.has(String(course._id)),
    };
}

function pickContinueLearning(enrolledCourses) {
    if (!enrolledCourses.length) return null;
    const incomplete = enrolledCourses.filter((course) => (course.progressPercentage || 0) < 100);
    const pool = incomplete.length ? incomplete : enrolledCourses;
    const withProgress = pool.filter((course) => (course.progressPercentage || 0) > 0);
    const ranked = (withProgress.length ? withProgress : pool).slice().sort((a, b) => {
        const aNext = a.nextClassAt ? new Date(a.nextClassAt).getTime() : Number.POSITIVE_INFINITY;
        const bNext = b.nextClassAt ? new Date(b.nextClassAt).getTime() : Number.POSITIVE_INFINITY;
        if (aNext !== bNext) return aNext - bNext;
        return (b.progressPercentage || 0) - (a.progressPercentage || 0);
    });
    const course = ranked[0];
    return {
        courseId: course.courseId,
        courseName: course.courseName,
        progressPercentage: course.progressPercentage,
        completedLessons: course.completedLessons,
        totalLessons: course.totalLessons,
        batchId: course.batchId,
        batchName: course.batchName,
        lesson: course.continueLesson || null,
        nextClassAt: course.nextClassAt || null,
    };
}

function pickNextClass(enrolledCourses) {
    const upcoming = enrolledCourses
        .filter((course) => course.nextClassAt)
        .slice()
        .sort((a, b) => new Date(a.nextClassAt) - new Date(b.nextClassAt));
    const course = upcoming[0];
    if (!course) return null;
    return {
        courseId: course.courseId,
        courseName: course.courseName,
        batchId: course.batchId,
        batchName: course.batchName,
        nextClassAt: course.nextClassAt,
        classTiming: course.classTiming,
        daysOfWeek: course.daysOfWeek,
        meetLink: course.meetLink,
    };
}

/**
 * @desc    Get student profile
 * @route   GET /api/student/profile
 * @access  Private (Student)
 */
export async function getStudentProfile(req, res) {
    try {
        const studentId = req.user.id;

        const user = await User.findById(studentId).select("-password").lean();

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            profileImage: user.profileImage || "",
            // New fields
            altPhone: user.altPhone || "",
            dob: user.dob || "",
            gender: user.gender || "",
            education: user.education || "",
            university: user.university || "",
            profession: user.profession || "",
            employmentStatus: user.employmentStatus || "",
            experience: user.experience || "",
            skills: user.skills || "",

            // Mapped/Legacy fields if frontend still expects them
            location: user.address || "", // Map address to location
            jobTitle: user.profession || "", // Map profession to jobTitle
            role: user.role
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: "Failed to fetch profile" });
    }
}

/**
 * @desc    Update student profile
 * @route   PUT /api/student/profile
 * @access  Private (Student)
 */
export async function updateStudentProfile(req, res) {
    try {
        const studentId = req.user.id;
        // Accept both new and old field names for compatibility
        const {
            phone, location, education, jobTitle,
            altPhone, dob, gender, university, profession,
            employmentStatus, experience, skills,
            profileImage,
            password,
            newPassword,
            currentPassword,
            confirmPassword,
        } = req.body;

        const nextPassword = newPassword ?? password;
        if (nextPassword != null && String(nextPassword).trim() !== "") {
            if (!currentPassword) {
                return res.status(400).json({
                    message: "Current password is required to set a new password",
                });
            }

            const passwordCheck = validatePassword(nextPassword);
            if (!passwordCheck.ok) {
                return res.status(400).json({ message: passwordCheck.message });
            }

            const existingUser = await User.findById(studentId);
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }

            const isMatch = await bcrypt.compare(currentPassword, existingUser.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Current password is incorrect" });
            }

            existingUser.password = await bcrypt.hash(nextPassword, 10);
            await revokeRefreshToken(existingUser._id);
            await existingUser.save();
            clearAuthCookies(res);
        }

        const updateData = {
            phone,
            education,
            // Map legacy to new schema
            address: location,
            profession: profession || jobTitle,
            // New fields
            altPhone,
            dob,
            gender,
            university,
            employmentStatus,
            experience,
            skills
            , profileImage
        };

        // Remove undefined fields
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const user = await User.findByIdAndUpdate(
            studentId,
            updateData,
            { new: true, runValidators: true }
        ).select("-password").lean();

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            altPhone: user.altPhone,
            dob: user.dob,
            gender: user.gender,
            education: user.education,
            university: user.university,
            profession: user.profession,
            employmentStatus: user.employmentStatus,
            experience: user.experience,
            skills: user.skills,
            profileImage: user.profileImage,

            // Legacy responses
            location: user.address,
            jobTitle: user.profession,
            role: user.role
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
}

/**
 * @desc    Change student password
 * @route   POST /api/student/change-password
 * @access  Private (Student)
 */
export async function changePassword(req, res) {
    try {
        const studentId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const passwordCheck = validatePassword(newPassword);
        if (!passwordCheck.ok) {
            return res.status(400).json({ message: passwordCheck.message });
        }

        const user = await User.findById(studentId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        // Hash and update new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await revokeRefreshToken(user._id);
        await user.save();
        clearAuthCookies(res);

        res.json({
            message: "Password changed successfully. Please log in again.",
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Failed to change password" });
    }
}

/**
 * @desc    Get student's enrolled courses with progress
 * @route   GET /api/student/my-courses
 * @access  Private (Student)
 */
export async function getStudentCourses(req, res) {
    try {
        const studentId = req.user.id;

        const user = await User.findById(studentId)
            .populate({ path: "enrolledCourses.course", select: "courseName modules thumbnail instructor" })
            .populate({ path: "enrolledCourses.batch", select: "name students sectionProgress meetLink classTiming daysOfWeek status course courses" })
            .lean();

        if (!user) return res.status(404).json({ message: "User not found" });

        const enrolledCourses = [];

        for (const ec of user.enrolledCourses || []) {
            if (!ec) continue;
            const courseDoc = ec.course;
            const batch = ec.batch;

            // Skip deleted courses and enrollments that are not on an active batch roster
            if (!courseDoc || !courseDoc._id) continue;
            if (!isProperlyEnrolled(studentId, courseDoc._id, batch)) continue;

            const totalSections =
                courseDoc?.modules?.reduce(
                    (acc, m) => acc + (m.sections?.length || 0),
                    0
                ) || 0;

            let completedList = [];
            if (batch && Array.isArray(batch.sectionProgress)) {
                const primaryCourseId = batch.course?._id || batch.course;
                completedList = filterCompletedForCourse(
                    batch.sectionProgress,
                    courseDoc._id,
                    primaryCourseId
                );
            }

            const completedLessons = completedList.length;
            const progressPercentage =
                totalSections > 0
                    ? Math.round((completedLessons / totalSections) * 100)
                    : 0;

            const modules = (courseDoc?.modules || []).map((module, modIdx) => ({
                moduleName: module.title,
                title: module.title,
                sections: (module.sections || []).map((section, secIdx) => {
                    const isCompleted = completedList.some(
                        c => c.moduleIndex === modIdx && c.sectionIndex === secIdx
                    );

                    return {
                        sectionName: section.sectionName,
                        title: section.sectionName,
                        isCompleted,
                    };
                }),
            }));

            enrolledCourses.push({
                courseId: courseDoc?._id,
                courseName: courseDoc?.courseName,
                thumbnail: courseDoc?.thumbnail || null,
                courseImage: courseDoc?.thumbnail || null,
                batchId: batch?._id || null,
                batchName: batch?.name || null,
                meetLink: batch?.meetLink || null,
                classTiming: batch?.classTiming || null,
                daysOfWeek: batch?.daysOfWeek || [],
                batchStatus: batch?.status || null,
                enrolledAt: ec.enrolledAt,
                totalLessons: totalSections,
                completedLessons,
                progressPercentage,
                nextClassAt: resolveNextClassAt(batch),
                continueLesson: pickContinueLesson(modules),
                modules,
            });
        }

        res.json({
            enrolledCourses,
            continueLearning: pickContinueLearning(enrolledCourses),
            nextClass: pickNextClass(enrolledCourses),
        });
    } catch (error) {
        console.error("Get courses error:", error);
        res.status(500).json({ message: "Failed to fetch courses" });
    }
}


/**
 * @desc    Get detailed progress for a specific course
 * @route   GET /api/student/course/:courseId/progress
 * @access  Private (Student)
 */
export async function getCourseProgress(req, res) {
    try {
        const studentId = req.user.id;
        const { courseId } = req.params;

        // Return course and enrollment + batch-based progress info
        const user = await User.findById(studentId).lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const enrollment = (user.enrolledCourses || []).find(ec => String(ec.course) === String(courseId)) || null;
        const batch = enrollment?.batch
            ? await Batch.findById(enrollment.batch).lean()
            : null;

        if (!isProperlyEnrolled(studentId, courseId, batch)) {
            return res.status(403).json({ message: "You are not enrolled in this course" });
        }

        const course = await Course.findById(courseId).lean();
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Compute totals from course modules
        const totalSections = (course.modules || []).reduce(
            (acc, mod) => acc + (mod.sections?.length || 0),
            0
        );

        // Compute completed sections in the batch for THIS course only
        let completedSections = 0;
        let completedList = [];
        if (batch && Array.isArray(batch.sectionProgress)) {
            const primaryCourseId = batch.course?._id || batch.course;
            completedList = filterCompletedForCourse(
                batch.sectionProgress,
                courseId,
                primaryCourseId
            ).map((sp) => ({
                moduleIndex: sp.moduleIndex,
                sectionIndex: sp.sectionIndex,
                courseId: sp.courseId || primaryCourseId,
                isCompleted: true,
                completionTime: sp.completionTime,
            }));
            completedSections = completedList.length;
        }

        const completionPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

        const batchInfo = batch
            ? {
                batchId: batch._id,
                batchName: batch.name,
                startDate: batch.startDate,
                endDate: batch.endDate,
                status: batch.status,
                classTiming: batch.classTiming,
                meetLink: batch.meetLink,
                daysOfWeek: batch.daysOfWeek,
                nextClassAt: resolveNextClassAt(batch),
            }
            : null;

        res.json({
            course: {
                _id: course._id,
                courseId: course._id,
                courseName: course.courseName,
                thumbnail: course.thumbnail,
                instructor: course.instructor,

                // ADD THIS - Full modules with all section data
                modules: (course.modules || []).map((module, modIdx) => ({
                    moduleName: module.title || module.moduleName,
                    title: module.title || module.moduleName,
                    sections: (module.sections || []).map((section, secIdx) => {
                        // Check if completed
                        const isCompleted = completedList.some(
                            c => c.moduleIndex === modIdx && c.sectionIndex === secIdx
                        );

                        return {
                            sectionName: section.sectionName || section.title,
                            title: section.title || section.sectionName,

                            // Section content - CRITICAL for lesson view
                            learningMaterialNotes: section.learningMaterialNotes || section.notes || "",
                            notes: section.notes || section.learningMaterialNotes || "",
                            learningMaterialFile: section.learningMaterialFile || [],
                            learningMaterialFiles: section.learningMaterialFile || [],

                            codeChallengeInstructions: section.codeChallengeInstructions || "",
                            codeChallengeFile: section.codeChallengeFile || [],
                            codeChallengeFiles: section.codeChallengeFile || [],

                            videos: section.videoReferences || section.videos || [],
                            videoReferences: section.videoReferences || section.videos || [],

                            isCompleted
                        };
                    })
                }))
            },
            enrollment,
            enrollmentDate: enrollment?.enrolledAt,
            batch: batchInfo,
            progress: {
                totalSections,
                completedSections,
                completionPercentage,
                completedList,
            },
            lessonProgress: completedList // Frontend expects this
        });
    } catch (error) {
        console.error("Get course progress error:", error);
        res.status(500).json({ message: "Failed to fetch course progress" });
    }
}

const catalogSelect = "courseName courseId thumbnail courseDescription courseDuration courseDurationMonths modules.title modules.sections.sectionName instructor";

/**
 * @desc    Catalog of academy courses for the logged-in student
 * @route   GET /api/student/catalog
 * @access  Private (Student)
 */
export async function getStudentCatalog(req, res) {
    try {
        const [courses, user] = await Promise.all([
            Course.find({})
                .select(catalogSelect)
                .populate("instructor", "name")
                .sort({ courseName: 1 })
                .lean(),
            User.findById(req.user.id).select("enrolledCourses").lean(),
        ]);

        const batchIds = [...new Set(
            (user?.enrolledCourses || []).map((entry) => entry.batch).filter(Boolean).map(String)
        )];
        const batches = batchIds.length
            ? await Batch.find({ _id: { $in: batchIds } }).select("students course courses").lean()
            : [];
        const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
        const enrolledIds = new Set(
            (user?.enrolledCourses || [])
                .filter((entry) => isProperlyEnrolled(
                    req.user.id,
                    entry.course,
                    batchById.get(String(entry.batch))
                ))
                .map((entry) => String(entry.course))
        );

        res.json({
            courses: courses.map((course) => summarizeCatalogCourse(course, enrolledIds)),
        });
    } catch (error) {
        console.error("Get student catalog error:", error);
        res.status(500).json({ message: "Failed to fetch course catalog" });
    }
}

/**
 * @desc    Public-safe outline for one catalog course
 * @route   GET /api/student/catalog/:courseId
 * @access  Private (Student)
 */
export async function getStudentCatalogCourse(req, res) {
    try {
        const { courseId } = req.params;
        const course = await Course.findById(courseId)
            .select(catalogSelect)
            .populate("instructor", "name")
            .lean();

        if (!course) return res.status(404).json({ message: "Course not found" });

        const user = await User.findById(req.user.id)
            .select("enrolledCourses")
            .lean();
        const enrolledIds = new Set(
            (user?.enrolledCourses || []).map((entry) => String(entry.course))
        );
        const summary = summarizeCatalogCourse(course, enrolledIds);

        const enrollment = (user?.enrolledCourses || []).find(
            (entry) => String(entry.course) === String(course._id)
        ) || null;

        let batch = null;
        if (enrollment?.batch) {
            batch = await Batch.findById(enrollment.batch)
                .select("name students meetLink classTiming daysOfWeek status course courses")
                .lean();
        }
        const properlyEnrolled = isProperlyEnrolled(req.user.id, course._id, batch);
        if (!properlyEnrolled) batch = null;
        summary.enrolled = properlyEnrolled;

        const modules = (course.modules || []).map((module) => ({
            title: module.title,
            lessons: properlyEnrolled
                ? (module.sections || []).map((section) => section.sectionName).filter(Boolean)
                : [],
        }));

        res.json({
            course: {
                ...summary,
                modules,
                batchId: batch?._id || null,
                batchName: batch?.name || null,
                meetLink: batch?.meetLink || null,
                classTiming: batch?.classTiming || null,
                daysOfWeek: batch?.daysOfWeek || [],
                nextClassAt: resolveNextClassAt(batch),
                enrolledAt: enrollment?.enrolledAt || null,
            },
        });
    } catch (error) {
        console.error("Get catalog course error:", error);
        if (error.kind === "ObjectId" || error.name === "CastError") {
            return res.status(404).json({ message: "Course not found" });
        }
        res.status(500).json({ message: "Failed to fetch course" });
    }
}