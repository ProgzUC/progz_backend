// models/Batch.js
import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
  }],
    trainer: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // or 'Instructor' depending on your setup
    required: true
  }],
  classTiming: {
    type: String, // e.g., "10:00 AM - 12:00 PM"
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
   default: null // Optional, can be set later
  },
  daysOfWeek: {
    type: [String], // e.g., ["Monday", "Wednesday", "Friday"]
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  sectionProgress: [
    {
      moduleIndex: { type: Number, required: true },
      sectionIndex: { type: Number, required: true },
      isCompleted: { type: Boolean, default: false },
      completionTime: { type: Date, default: null }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Batch', batchSchema);
