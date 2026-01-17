import mongoose from "mongoose";

const pendingUserSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, unique: true, required: true },
        password: { type: String, required: true },
        phone: { type: String, required: true },
        altPhone: String,
        address: String,
        dob: String,
        education: String,
        university: String,
        profession: String,
        employmentStatus: String,
        experience: String,

        source: { type: String, default: "web" },
        zenCourseName: String,
        zenCourseType: String,

        role: {
            type: String,
            enum: ["admin", "trainer", "student"],
            required: true,
        },

        // Additional field to track status if needed, though collection implies pending
        status: {
            type: String,
            default: "pending",
            enum: ["pending", "rejected"], // if rejected, maybe we keep it here or delete? The plan said delete, but 'rejected' status might be useful for history. Stuck to plan: reject deletes it.
        },
    },
    { timestamps: true }
);

export default mongoose.model("PendingUser", pendingUserSchema);
