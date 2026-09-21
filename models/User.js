import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    phone: String,
    altPhone: String,
    address: String,
    dob: String,
    gender: String,
    education: String,
    university: String,
    profession: String,
    employmentStatus: String,
    experience: String,
  profileImage: String,

    source: { type: String, default: "web" },
    zenCourseName: String,
    zenCourseType: String,
    skills: String,

    role: {
      type: String,
      enum: ["admin", "trainer", "student"],
      required: true,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    refreshTokenHash: String,
    refreshTokenExpires: Date,

    enrolledCourses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        enrolledAt: { type: Date, default: Date.now },
        batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" }
      }
    ],

    notificationPrefs: {
      inAppEnabled: { type: Boolean, default: true },
      emailEnabled: { type: Boolean, default: true },
      approvalAlerts: { type: Boolean, default: true },
      batchAssignment: { type: Boolean, default: true },
      classReminders: { type: Boolean, default: true },
      attendanceWarnings: { type: Boolean, default: true },
      adminEvents: { type: Boolean, default: true },
      emailDigest: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);
userSchema.index({ role: 1 });
export default mongoose.model("User", userSchema);
