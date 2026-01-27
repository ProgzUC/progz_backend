import Course from "../models/Course.js";
import User from "../models/User.js";
import Batch from "../models/Batch.js";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const getAdminStats = async (req, res) => {
  try {
    const courses = await Course.countDocuments();
    const instructors = await User.countDocuments({ role: 'trainer' });
    const students = await User.countDocuments({ role: 'student' });

    res.json({ courses, instructors, students });
  } catch (err) {
    console.error('getAdminStats error', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

export const getEnrollmentTrends = async (req, res) => {
  try {
    // Look back 12 months
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Aggregate enrolledStudents across courses
    const pipeline = [
      { $unwind: "$enrolledStudents" },
      { $match: { "enrolledStudents.enrolledDate": { $gte: start } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$enrolledStudents.enrolledDate" } },
          value: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ];

    const rows = await Course.aggregate(pipeline);

    // Build month->value map for last 12 months
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push({ key, label: MONTH_NAMES[d.getMonth()], value: 0 });
    }

    const rowMap = {};
    rows.forEach(r => { rowMap[r._id] = r.value; });
    const result = months.map(m => ({ month: m.label, value: rowMap[m.key] || 0 }));

    res.json(result);
  } catch (err) {
    console.error('getEnrollmentTrends error', err);
    res.status(500).json({ message: 'Failed to fetch enrollment trends' });
  }
};

export const getUserDistribution = async (req, res) => {
  try {
    const instructors = await User.countDocuments({ role: 'trainer' });
    const students = await User.countDocuments({ role: 'student' });
    const data = [
      { name: 'Instructors', value: instructors },
      { name: 'Students', value: students }
    ];
    res.json(data);
  } catch (err) {
    console.error('getUserDistribution error', err);
    res.status(500).json({ message: 'Failed to fetch user distribution' });
  }
};

export const getRecentActivity = async (req, res) => {
  try {
    // Recent courses
    const recentCourses = await Course.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate({ path: 'instructor', select: 'name' })
      .lean();

    const courses = await Promise.all(recentCourses.map(async c => {
      // take first 3 enrolled students emails as studentsList
      const studentsList = (c.enrolledStudents || []).slice(0,3).map(es => es.student?.toString() || null).filter(Boolean);
      // try to resolve student emails for clearer display
      const studentDocs = await User.find({ _id: { $in: studentsList } }).select('email').lean();
      const studentsListDisplay = studentDocs.map(s => s.email);

      return {
        id: c._id,
        course: c.courseName,
        instructor: (c.instructor && c.instructor.length) ? c.instructor.map(i=>i.name).join(', ') : undefined,
        date: c.createdAt ? c.createdAt.toISOString().slice(0,10) : null,
        more: Math.max(0, (c.enrolledStudents || []).length - studentsListDisplay.length),
        studentsList: studentsListDisplay,
      };
    }));

    // Recent students (registered)
    const recentStudentsDocs = await User.find({ role: 'student' })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('name email createdAt')
      .lean();

    const students = recentStudentsDocs.map(s => ({ name: s.name, email: s.email, date: s.createdAt ? s.createdAt.toISOString().slice(0,10) : null }));

    res.json({ courses, students });
  } catch (err) {
    console.error('getRecentActivity error', err);
    res.status(500).json({ message: 'Failed to fetch recent activity' });
  }
};

export default {
  getAdminStats,
  getEnrollmentTrends,
  getUserDistribution,
  getRecentActivity,
};
