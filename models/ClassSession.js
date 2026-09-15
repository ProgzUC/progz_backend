import mongoose from "mongoose";

const classSessionSchema = new mongoose.Schema(
    {
        batch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            required: true,
        },

        trainer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        date: {
            type: Date,
            required: true,
            default: () => new Date(),
        },

        startTime: {
            type: Date,
            required: true,
        },

        endTime: {
            type: Date,
            default: null,
        },

        /** When the trainer clicked Join Class / started the session */
        trainerJoinedAt: {
            type: Date,
            default: null,
        },

        attendance: [
            {
                student: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                status: {
                    type: String,
                    enum: ["Present", "Absent", "Late"],
                    default: "Absent",
                },
                /** When the student first clicked Join Class */
                joinedAt: {
                    type: Date,
                    default: null,
                },
            },
        ],

        notes: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

// Indexes for efficient queries
classSessionSchema.index({ batch: 1, date: -1 });
classSessionSchema.index({ trainer: 1, date: -1 });

export default mongoose.model("ClassSession", classSessionSchema);
