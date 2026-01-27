// models/Batch.js
import mongoose from "mongoose";
const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    trainers: [
      {
        trainer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
          index: true,
        },

        assignedModules: [
          {
            type: Number, // module index
          },
        ],

        fromDate: Date,
        toDate: Date,
        isCurrent: { type: Boolean, default: false },
      },
    ],

    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    classTiming: {
      startTime: { type: String, required: true }, // "10:00"
      endTime: { type: String, required: true },   // "12:00"
      timezone: { type: String, default: "Asia/Kolkata" },
    },

    // classTiming: { type: String, required: true },
    meetLink: String,

    startDate: Date,
    endDate: Date,

    daysOfWeek: {
      type: [String],
      enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    },

    status: {
      type: String,
      enum: ["upcoming", "active", "completed", "cancelled", "on-hold"],
      default: "upcoming",
      index: true,
    },

    sectionProgress: [
      {
        moduleIndex: Number,
        sectionIndex: Number,
        isCompleted: Boolean,
        completedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        completionTime: Date,
      },
    ],
  },
  { timestamps: true }
);
// indexes are already declared on fields (index: true). Avoid duplicate index definitions.

export default mongoose.model("Batch", batchSchema);
