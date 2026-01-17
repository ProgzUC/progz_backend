import mongoose from "mongoose";

const recycleBinSchema = new mongoose.Schema(
    {
        itemType: {
            type: String,
            required: true,
            enum: ["Course", "User"],
        },
        originalId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        data: {
            type: Object,
            required: true,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        // TTL Index: Expires after 15 days
        expireAt: {
            type: Date,
            default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
            index: { expires: 0 }, // MongoDB removes document when expireAt is reached
        },
        itemRefName: { type: String } // Optional: Store name for easier display in UI
    },
    { timestamps: true }
);

export default mongoose.model("RecycleBin", recycleBinSchema);
