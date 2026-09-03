# Progz Backend Documentation

Welcome to the Progz Backend API documentation. This project handles course management, user authentication, batch scheduling, and synchronization with external systems.

## 📚 Module Documentation

### [Authentication Flow](AUTH_README.md)
- Registration & Login
- Password Reset

### [User Management & Utilities](USER_README.md)
- User Profiles & Roles
- Recycle Bin (Soft Delete)
- Zen API Synchronization

### [Course Management](COURSE_README.md)
- Course CRUD
- Instructor Assignment
- Versioning & Rollback

### [Batch Management](BATCH_README.md)
- Batch Creation & Scheduling
- Student Enrollment
- Trainer Module Assignment
- Section Completion Tracking

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env` and fill in values (never commit `.env`):
   ```env
   PORT=5002
   MONGO_URI=...
   JWT_SECRET=...
   REFRESH_TOKEN_SECRET=...
   ZEN_API_KEY=...          # Zen sync
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```

3. **Run Server**
   ```bash
   npm run dev
   ```

## 🛠️ Key Validation Scripts
- `verify_batch_flow.js`: Tests batch creation and enrollment.
- `verify_sync.js`: Tests external sync triggers.
- `verify_toggle_flow.js`: Tests section completion toggling.
