/**
 * Helpers for batches that can have one or many courses.
 * Legacy field: batch.course (singular). New field: batch.courses (array).
 */

export const resolveCourseIdsFromBody = (body = {}) => {
  const fromArray = Array.isArray(body.courses)
    ? body.courses.filter(Boolean).map((id) => String(id))
    : [];
  if (fromArray.length) {
    return [...new Set(fromArray)];
  }
  if (body.course) {
    return [String(body.course)];
  }
  return [];
};

export const getBatchCourseIds = (batch) => {
  if (!batch) return [];
  if (Array.isArray(batch.courses) && batch.courses.length) {
    return batch.courses.map((c) => String(c?._id || c));
  }
  if (batch.course) {
    return [String(batch.course._id || batch.course)];
  }
  return [];
};

export const getBatchCourseNames = (batch) => {
  if (!batch) return [];
  if (Array.isArray(batch.courses) && batch.courses.length) {
    const names = batch.courses
      .map((c) => (typeof c === "object" ? c.courseName : null))
      .filter(Boolean);
    if (names.length) return names;
  }
  if (batch.course?.courseName) {
    return [batch.course.courseName];
  }
  return [];
};
