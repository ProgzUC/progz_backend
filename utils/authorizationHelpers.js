/**
 * Shared authorization helpers for role checks and resource ownership.
 */

export const normalizeRole = (role) => {
  const value = String(role || "").toLowerCase();
  if (value === "instructor") return "trainer";
  return value;
};

export const getUserRole = (req) => normalizeRole(req.user?.role);

export const getUserId = (req) => String(req.user?.id || "");

export const isAdmin = (req) => getUserRole(req) === "admin";

export const isTrainer = (req) => getUserRole(req) === "trainer";

export const isStudent = (req) => getUserRole(req) === "student";

export const isCourseInstructor = (course, userId) => {
  if (!course?.instructor?.length || !userId) return false;
  return course.instructor.some(
    (id) => String(id?._id || id).toString() === String(userId)
  );
};

export const isBatchTrainer = (batch, userId) => {
  if (!batch?.trainers?.length || !userId) return false;
  return batch.trainers.some(
    (entry) => String(entry.trainer?._id || entry.trainer).toString() === String(userId)
  );
};

export const canManageCourse = (req, course) =>
  isAdmin(req) || isCourseInstructor(course, getUserId(req));

export const canManageBatch = (req, batch) =>
  isAdmin(req) || isBatchTrainer(batch, getUserId(req));

export const denyAccess = (res, message = "Access denied") =>
  res.status(403).json({ msg: message, message });
