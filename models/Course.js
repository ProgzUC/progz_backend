// server/models/Course.js
import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema({
  sectionName: { type: String, required: true, trim: true },
  learningMaterialNotes: String,
  learningMaterialUrls: [String],
  codeChallengeInstructions: String,
  codeChallengeUrls: [String],
  videoReferences: [String],
});

const enrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true, // fast lookups by student
  },
  enrolledDate: { type: Date, default: Date.now },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    default: null,
  },
  courseCompleted: { type: Boolean, default: false },
});

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  sections: [sectionSchema],
});

const courseSchema = new mongoose.Schema(
  {
    courseName: { type: String, required: true, trim: true },
    courseId: { type: String, unique: true, required: true },
    instructor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    courseDescription: String,
    courseDuration: {
      type: Number,
      required: true,
    },
    modules: [moduleSchema],
    enrolledStudents: [enrollmentSchema],
  },
  {
    timestamps: true,
  }
);

// Index for trainer dashboards & course listing
courseSchema.index({ instructor: 1 });

const Course = mongoose.model("Course", courseSchema);
export default Course;
