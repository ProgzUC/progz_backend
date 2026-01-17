import mongoose from "mongoose";

// Duplicate schema definitions from Course.js as they are embedded documents in Mongoose
// Ideally these should be shared, but for now we redefine to ensure independence or import them if exported.
// Looking at Course.js, sectionSchema, moduleSchema, enrollmentSchema are local.
// We will copy them to ensure the snapshot is accurate.

const sectionSchema = new mongoose.Schema({
    sectionName: { type: String, trim: true },
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
    },
    enrolledDate: { type: Date },
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Batch",
    },
    courseCompleted: { type: Boolean },
});

const moduleSchema = new mongoose.Schema({
    title: { type: String, trim: true },
    sections: [sectionSchema],
});

const courseVersionSchema = new mongoose.Schema(
    {
        courseRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },
        versionNumber: { type: Number, required: true },
        snapshotDate: { type: Date, default: Date.now },

        // Captured Course Fields
        courseName: { type: String },
        courseId: { type: String },
        instructor: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        courseDescription: String,
        courseDuration: Number,
        modules: [moduleSchema],
        enrolledStudents: [enrollmentSchema],
    },
    {
        timestamps: true,
    }
);

const CourseVersion = mongoose.model("CourseVersion", courseVersionSchema);
export default CourseVersion;
