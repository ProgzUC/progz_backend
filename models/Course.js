  // server/models/Course.js
 import mongoose from 'mongoose';


  const sectionSchema = new mongoose.Schema({
    sectionName: String,
    learningMaterialNotes: String,
    learningMaterialUrls: [String],
    codeChallengeInstructions: String,
    codeChallengeUrls: [String],
    videoReferences: [String]
  });

   const enrollmentSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    enrolledDate: { type: Date, default: Date.now },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch',default: null}, // Optional, can be null if not enrolled in a batch
    courseCompleted: { type: Boolean, default: false }
  });

  const moduleSchema = new mongoose.Schema({
    title: String,
    sections: [sectionSchema]
  });

  const courseSchema = new mongoose.Schema({
    courseName: String,
    courseId: { type: String, unique: true },
    instructor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    courseDescription: String,
    courseDuration: {
      type:Number,
      required: true
    },
    modules: [moduleSchema],
    enrolledStudents: [enrollmentSchema] 
  },
  {
    timestamps: true
  }
);

  const Course = mongoose.model('Course', courseSchema);
  export default Course;