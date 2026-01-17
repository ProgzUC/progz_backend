# Batch Management Documentation

This module handles Batch creation, scheduling, student enrollment, and trainer assignment.

## Quick Links
- [Batch Controller](controllers/batchController.js)
- [Batch Routes](routes/batchRoutes.js)
- [Batch Model](models/Batch.js)

---

## 1. Batch Operations

### Create Batch
- **Endpoint**: `POST /api/batches`
- **Access**: Private (Admin/Trainer)
- **Body**:
  ```json
  {
    "name": "Jan 2024 Full Stack",
    "course": "COURSE_ID",
    "classTiming": "10 AM - 12 PM",
    "startDate": "2024-01-01",
    "daysOfWeek": ["Monday", "Wednesday", "Friday"]
  }
  ```

### Get All Batches
- **Endpoint**: `GET /api/batches`
- **Access**: Private
- **Response**: List of batches with populated course, student, and trainer details.

### Get Single Batch
- **Endpoint**: `GET /api/batches/:id`
- **Access**: Private

---

## 2. Enrollment Management

### Enroll Student
- **Endpoint**: `POST /api/batches/:id/enroll`
- **Access**: Private (Admin/Trainer)
- **Body**:
  ```json
  {
    "studentId": "USER_ID"
  }
  ```
- **Behavior**: Adds student to batch AND updates student profile's `enrolledCourses`.

### Remove Student
- **Endpoint**: `POST /api/batches/:id/remove-student`
- **Access**: Private (Admin/Trainer)
- **Body**:
  ```json
  {
    "studentId": "USER_ID"
  }
  ```

---

## 3. Trainer & Curriculum Management

### Manage Trainers (Assignment)
- **Endpoint**: `POST /api/batches/:id/trainers`
- **Access**: Private (Admin/Trainer)
- **Body**:
  ```json
  {
    "trainers": [
      {
        "trainer": "USER_ID",
        "assignedModules": [1, 2], // Module Indices
        "fromDate": "2024-01-01",
        "toDate": "2024-02-01",
        "isCurrent": true
      }
    ]
  }
  ```

### Toggle Section Completion
- **Endpoint**: `POST /api/batches/:id/sections/toggle`
- **Access**: Private (Admin/Trainer)
- **Body**:
  ```json
  {
    "moduleIndex": 1,
    "sectionIndex": 0
  }
  ```
- **Behavior**: Toggles `isCompleted`. Records `completedBy` and `completionTime`.
