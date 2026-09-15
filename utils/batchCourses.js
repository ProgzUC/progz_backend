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

/** Match section progress for a course (legacy rows without courseId count as primary). */
export const matchesSectionProgress = (
  entry,
  { courseId, moduleIndex, sectionIndex, primaryCourseId }
) => {
  if (!entry) return false;
  if (Number(entry.moduleIndex) !== Number(moduleIndex)) return false;
  if (Number(entry.sectionIndex) !== Number(sectionIndex)) return false;

  const entryCourseId = entry.courseId ? String(entry.courseId) : null;
  const targetCourseId = courseId ? String(courseId) : null;
  const primaryId = primaryCourseId ? String(primaryCourseId) : null;

  if (!targetCourseId) {
    return !entryCourseId || (primaryId && entryCourseId === primaryId);
  }

  if (entryCourseId) {
    return entryCourseId === targetCourseId;
  }

  // Legacy entry without courseId → treat as primary course only
  return primaryId ? targetCourseId === primaryId : true;
};

export const findSectionProgressIndex = (sectionProgress, opts) => {
  if (!Array.isArray(sectionProgress)) return -1;
  return sectionProgress.findIndex((p) => matchesSectionProgress(p, opts));
};

export const filterCompletedForCourse = (sectionProgress, courseId, primaryCourseId) => {
  if (!Array.isArray(sectionProgress)) return [];
  return sectionProgress.filter((sp) => {
    if (!sp?.isCompleted) return false;
    const entryCourseId = sp.courseId ? String(sp.courseId) : null;
    const target = String(courseId);
    const primary = primaryCourseId ? String(primaryCourseId) : null;
    if (entryCourseId) return entryCourseId === target;
    return primary ? target === primary : true;
  });
};
