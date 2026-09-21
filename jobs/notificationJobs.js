import Batch from "../models/Batch.js";
import ClassSession from "../models/ClassSession.js";
import PendingUser from "../models/PendingUser.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import {
  NOTIFICATION_TYPES,
  dispatch,
  notifyAdminsQuiet,
  notifyQuiet,
} from "../services/notificationService.js";

const ATTENDANCE_THRESHOLD = Number(process.env.ATTENDANCE_WARNING_THRESHOLD || 75);
const MIN_SESSIONS = Number(process.env.ATTENDANCE_WARNING_MIN_SESSIONS || 3);
const REMINDER_LEAD_MINUTES = Number(process.env.CLASS_REMINDER_LEAD_MINUTES || 30);

const zonedParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone || "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
};

const isoWeekKey = (date, timeZone) => {
  const parts = zonedParts(date, timeZone);
  const local = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  const dayNum = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(local.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((local - yearStart) / 86400000 + 1) / 7);
  return `${local.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const parseHm = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

const minutesUntilClass = (batch, now = new Date()) => {
  const days = batch.daysOfWeek || [];
  if (!days.length) return null;
  const tz = batch.classTiming?.timezone || "Asia/Kolkata";
  const start = parseHm(batch.classTiming?.startTime);
  if (!start) return null;

  const parts = zonedParts(now, tz);
  if (!days.includes(parts.weekday)) return null;

  const nowMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const classMinutes = start.hour * 60 + start.minute;
  return classMinutes - nowMinutes;
};

const batchMemberIds = (batch) => {
  const studentIds = (batch.students || []).map((s) => s._id || s);
  const trainerIds = (batch.trainers || [])
    .map((t) => t.trainer?._id || t.trainer)
    .filter(Boolean);
  return [...new Set([...studentIds, ...trainerIds].map(String))];
};

export const runClassReminders = async () => {
  const batches = await Batch.find({
    status: { $in: ["upcoming", "active"] },
    daysOfWeek: { $exists: true, $ne: [] },
    "classTiming.startTime": { $exists: true, $ne: "" },
  })
    .select("name students trainers classTiming daysOfWeek meetLink status")
    .lean();

  let sent = 0;
  for (const batch of batches) {
    const remaining = minutesUntilClass(batch);
    if (remaining == null || remaining <= 0 || remaining > REMINDER_LEAD_MINUTES) continue;

    const tz = batch.classTiming?.timezone || "Asia/Kolkata";
    const parts = zonedParts(new Date(), tz);
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    const userIds = batchMemberIds(batch);
    if (!userIds.length) continue;

    const timing = `${batch.classTiming.startTime}${batch.classTiming.endTime ? `–${batch.classTiming.endTime}` : ""}`;
    const meet = batch.meetLink ? ` Join: ${batch.meetLink}` : "";

    await dispatch({
      userIds,
      type: NOTIFICATION_TYPES.CLASS_REMINDER,
      title: `${batch.name} starts soon`,
      body: `Class begins at ${timing} today.${meet}`,
      link: batch.meetLink || "",
      metadata: {
        batchId: String(batch._id),
        startTime: batch.classTiming.startTime,
        dateKey,
      },
      dedupKey: `class_reminder:${batch._id}:${dateKey}`,
    });
    sent += 1;
  }

  if (sent) logger.info(`Class reminders dispatched for ${sent} batch(es)`);
  return { batchesNotified: sent };
};

const attendanceStatsForStudents = async (studentIds) => {
  const ids = [...new Set(studentIds.map(String).filter(Boolean))];
  if (!ids.length) return [];

  const sessions = await ClassSession.find({
    "attendance.student": { $in: ids },
    endTime: { $ne: null },
  })
    .select("batch attendance")
    .populate("batch", "name")
    .lean();

  const stats = new Map();
  for (const id of ids) {
    stats.set(id, { total: 0, present: 0, late: 0, absent: 0, batchName: "", batchId: "" });
  }

  for (const session of sessions) {
    for (const entry of session.attendance || []) {
      const id = String(entry.student);
      const row = stats.get(id);
      if (!row) continue;
      row.total += 1;
      if (entry.status === "Present") row.present += 1;
      else if (entry.status === "Late") row.late += 1;
      else row.absent += 1;
      if (session.batch) {
        row.batchName = session.batch.name || row.batchName;
        row.batchId = String(session.batch._id || session.batch);
      }
    }
  }

  return ids.map((id) => {
    const row = stats.get(id);
    const attended = row.present + row.late;
    const percentage = row.total > 0 ? Math.round((attended / row.total) * 100) : 100;
    return { studentId: id, ...row, percentage };
  });
};

export const warnAtRiskStudents = async (studentIds, { force = false } = {}) => {
  const stats = await attendanceStatsForStudents(studentIds);
  const atRisk = stats.filter(
    (s) => s.total >= MIN_SESSIONS && s.percentage < ATTENDANCE_THRESHOLD
  );
  if (!atRisk.length) return { warned: 0 };

  const weekKey = isoWeekKey(new Date(), "Asia/Kolkata");
  for (const row of atRisk) {
    await dispatch({
      userIds: [row.studentId],
      type: NOTIFICATION_TYPES.ATTENDANCE_WARNING,
      title: "Your attendance needs attention",
      body: `Your attendance is ${row.percentage}%${row.batchName ? ` in ${row.batchName}` : ""}. Please join upcoming classes to stay on track.`,
      link: "/student-dashboard/my-attendance",
      metadata: {
        percentage: row.percentage,
        total: row.total,
        batchId: row.batchId,
        batchName: row.batchName,
      },
      dedupKey: force ? null : `attendance_warning:${row.studentId}:${weekKey}`,
    });
  }
  return { warned: atRisk.length, atRisk };
};

export const runAttendanceWarnings = async () => {
  const students = await User.find({ role: "student" }).select("_id").lean();
  const result = await warnAtRiskStudents(students.map((s) => s._id));

  const byBatch = new Map();
  for (const row of result.atRisk || []) {
    if (!row.batchId) continue;
    if (!byBatch.has(row.batchId)) {
      byBatch.set(row.batchId, { name: row.batchName, count: 0 });
    }
    byBatch.get(row.batchId).count += 1;
  }

  const dayKey = zonedParts(new Date(), "Asia/Kolkata");
  const dateKey = `${dayKey.year}-${dayKey.month}-${dayKey.day}`;

  for (const [batchId, info] of byBatch.entries()) {
    const batch = await Batch.findById(batchId).select("trainers name").lean();
    const trainerIds = (batch?.trainers || [])
      .map((t) => t.trainer)
      .filter(Boolean);
    notifyQuiet({
      userIds: trainerIds,
      type: NOTIFICATION_TYPES.ADMIN_EVENT,
      title: `Attendance alert in ${info.name}`,
      body: `${info.count} student${info.count === 1 ? " is" : "s are"} below ${ATTENDANCE_THRESHOLD}% attendance.`,
      link: "/trainer-dashboard",
      metadata: { batchId, count: info.count },
      channels: ["in_app"],
      dedupKey: `attendance_batch:${batchId}:${dateKey}`,
    });
  }

  if (result.warned) {
    notifyAdminsQuiet({
      type: NOTIFICATION_TYPES.ADMIN_EVENT,
      title: "Students below attendance threshold",
      body: `${result.warned} student${result.warned === 1 ? " is" : "s are"} under ${ATTENDANCE_THRESHOLD}% attendance this week.`,
      link: "/admin/reports/attendance",
      channels: ["in_app"],
      dedupKey: `attendance_admin:${dateKey}`,
    });
    logger.info(`Attendance warnings sent to ${result.warned} student(s)`);
  }

  return result;
};

export const runWeeklyAdminDigest = async () => {
  const parts = zonedParts(new Date(), "Asia/Kolkata");
  if (parts.weekday !== "Monday") return { skipped: true };

  const [pending, students] = await Promise.all([
    PendingUser.countDocuments(),
    User.find({ role: "student" }).select("_id").lean(),
  ]);
  const atRisk = await attendanceStatsForStudents(students.map((s) => s._id));
  const atRiskCount = atRisk.filter(
    (s) => s.total >= MIN_SESSIONS && s.percentage < ATTENDANCE_THRESHOLD
  ).length;

  const todayName = parts.weekday;
  const classesToday = await Batch.countDocuments({
    status: { $in: ["upcoming", "active"] },
    daysOfWeek: todayName,
  });

  notifyAdminsQuiet({
    type: NOTIFICATION_TYPES.ADMIN_EVENT,
    title: "Weekly academy digest",
    body: `${pending} pending approval${pending === 1 ? "" : "s"}, ${atRiskCount} student${atRiskCount === 1 ? "" : "s"} below attendance, ${classesToday} class batch${classesToday === 1 ? "" : "es"} meet today.`,
    link: "/admin/overview",
    metadata: { pending, atRiskCount, classesToday },
    dedupKey: `admin_digest:${parts.year}-${parts.month}-${parts.day}`,
    emailPrefKey: "emailDigest",
  });

  return { pending, atRiskCount, classesToday };
};

export { isoWeekKey, minutesUntilClass };
