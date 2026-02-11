import mongoose from "mongoose";

const pendingUserSchema = new mongoose.Schema(
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
        // Additional field to track status if needed, though collection implies pending
        status: {
            type: String,
            default: "pending",
            enum: ["pending", "rejected"],
        },

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

export default mongoose.model("PendingUser", pendingUserSchema);
