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

    enrolledCourses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        enrolledAt: { type: Date, default: Date.now },
        batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" }
      }
    ],
  },
  { timestamps: true }
);
userSchema.index({ role: 1 });
export default mongoose.model("User", userSchema);
