import Course from "../models/Course.js";
import User from "../models/User.js";
import Batch from "../models/Batch.js";
import PendingUser from "../models/PendingUser.js";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseYmd(value) {
  if (!value || typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateRange(query = {}) {
  const startRaw = parseYmd(query.startDate);
  const endRaw = parseYmd(query.endDate);
  const start = startRaw
    ? new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate(), 0, 0, 0, 0)
    : null;
  const end = endRaw
    ? new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate(), 23, 59, 59, 999)
    : null;
  return { start, end };
}

function createdAtRange(start, end) {
  if (!start && !end) return {};
  const createdAt = {};
  if (start) createdAt.$gte = start;
  if (end) createdAt.$lte = end;
  return { createdAt };
}

export const getAdminStats = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const range = createdAtRange(start, end);

    const [courses, instructors, students, batches, pending] = await Promise.all([
      Course.countDocuments(range),
      User.countDocuments({ role: "trainer", ...range }),
      User.countDocuments({ role: "student", ...range }),
      Batch.countDocuments(range),
      PendingUser.countDocuments(range),
    ]);

    res.json({
      courses,
      instructors,
      students,
      batches,
      totalBatches: batches,
      pendingApprovals: pending,
      pending,
      totalUsers: instructors + students,
      range: {
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("getAdminStats error", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

export const getEnrollmentTrends = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query);

    // Week mode: daily enrollments for the selected week
    if (start && end) {
      const pipeline = [
        { $unwind: "$enrolledStudents" },
        {
          $match: {
            "enrolledStudents.enrolledDate": { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$enrolledStudents.enrolledDate",
                timezone: "Asia/Kolkata",
              },
            },
            value: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const rows = await Course.aggregate(pipeline);
      const rowMap = {};
      rows.forEach((r) => {
        rowMap[r._id] = r.value;
      });

      const result = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = toYmd(cursor);
        result.push({
          month: `${DAY_NAMES[cursor.getDay()]} ${cursor.getDate()}`,
          value: rowMap[key] || 0,
          date: key,
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      return res.json(result);
    }

    // Default: last 12 months
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const pipeline = [
      { $unwind: "$enrolledStudents" },
      { $match: { "enrolledStudents.enrolledDate": { $gte: monthStart } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$enrolledStudents.enrolledDate",
            },
          },
          value: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await Course.aggregate(pipeline);
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: MONTH_NAMES[d.getMonth()], value: 0 });
    }

    const rowMap = {};
    rows.forEach((r) => {
      rowMap[r._id] = r.value;
    });
    const result = months.map((m) => ({ month: m.label, value: rowMap[m.key] || 0 }));

    res.json(result);
  } catch (err) {
    console.error("getEnrollmentTrends error", err);
    res.status(500).json({ message: "Failed to fetch enrollment trends" });
  }
};

export const getUserDistribution = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const range = createdAtRange(start, end);

    const instructors = await User.countDocuments({ role: "trainer", ...range });
    const students = await User.countDocuments({ role: "student", ...range });
    const data = [
      { name: "Instructors", value: instructors },
      { name: "Students", value: students },
    ];
    res.json(data);
  } catch (err) {
    console.error("getUserDistribution error", err);
    res.status(500).json({ message: "Failed to fetch user distribution" });
  }
};

export const getRecentActivity = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const range = createdAtRange(start, end);

    const recentCourses = await Course.find(range)
      .sort({ createdAt: -1 })
      .limit(6)
      .populate({ path: "instructor", select: "name" })
      .lean();

    const courses = await Promise.all(
      recentCourses.map(async (c) => {
        const studentsList = (c.enrolledStudents || [])
          .slice(0, 3)
          .map((es) => es.student?.toString() || null)
          .filter(Boolean);
        const studentDocs = await User.find({ _id: { $in: studentsList } })
          .select("email")
          .lean();
        const studentsListDisplay = studentDocs.map((s) => s.email);

        return {
          id: c._id,
          course: c.courseName,
          instructor:
            c.instructor && c.instructor.length
              ? c.instructor.map((i) => i.name).join(", ")
              : undefined,
          date: c.createdAt ? c.createdAt.toISOString().slice(0, 10) : null,
          more: Math.max(0, (c.enrolledStudents || []).length - studentsListDisplay.length),
          studentsList: studentsListDisplay,
        };
      })
    );

    const recentStudentsDocs = await User.find({ role: "student", ...range })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("name email createdAt")
      .lean();

    const students = recentStudentsDocs.map((s) => ({
      name: s.name,
      email: s.email,
      date: s.createdAt ? s.createdAt.toISOString().slice(0, 10) : null,
    }));

    res.json({ courses, students });
  } catch (err) {
    console.error("getRecentActivity error", err);
    res.status(500).json({ message: "Failed to fetch recent activity" });
  }
};

export const sendAnnouncementEmail = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const academy = String(req.body?.academyName || "ProgZ").trim() || "ProgZ";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (!title) {
      return res.status(400).json({ message: "Announcement title is required" });
    }

    const sendEmail = (await import("../utils/sendEmail.js")).default;
    const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeBody = (body || "No additional details.")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    await sendEmail({
      email,
      subject: `${academy}: ${title}`,
      message: `${academy} Announcement\n\n${title}\n\n${body || ""}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b">${academy} Announcement</p>
          <h2 style="margin:0 0 12px;font-size:20px">${safeTitle}</h2>
          <p style="margin:0;color:#334155">${safeBody}</p>
        </div>
      `,
    });

    return res.json({ message: "Announcement email sent", email });
  } catch (err) {
    console.error("sendAnnouncementEmail error", err);
    return res.status(500).json({
      message: err.message || "Failed to send announcement email",
    });
  }
};

export default {
  getAdminStats,
  getEnrollmentTrends,
  getUserDistribution,
  getRecentActivity,
  sendAnnouncementEmail,
};
