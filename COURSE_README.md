# Course Module Documentation

This document outlines the flows and API endpoints for the Course Management module, including Course CRUD, Instructor Management, and Course Versioning/Rollback.

## Quick Links
- [Course Controller](../controllers/courseController.js)
- [Course Routes](../routes/courseRoutes.js)
- [Course Model](../models/Course.js)
- [Course Version Model](../models/CourseVersion.js)

---

## 1. Course Management (CRUD)

### Create a Course
- **Description**: Create a new course. The creator is automatically added as an instructor.
- **Endpoint**: `POST /api/courses`
- **Access**: Private (Admin, Trainer)
- **Body**:
  ```json
  {
    "courseName": "Advanced Node.js",
    "courseId": "NODE_ADV_01",
    "courseDescription": "Deep dive into Node.js internals.",
    "courseDuration": 40,
    "modules": [
        { "title": "Event Loop", "sections": [] }
    ]
  }
  ```

### Get All Courses
- **Description**: Retrieve a list of all courses.
- **Endpoint**: `GET /api/courses`
- **Access**: Private

### Get Single Course
- **Description**: Retrieve detailed information for a specific course.
- **Endpoint**: `GET /api/courses/:id`
- **Access**: Private

### Delete Course
- **Description**: Permanently remove a course.
- **Endpoint**: `DELETE /api/courses/:id`
- **Access**: Private (Admin, Trainer)

---

## 2. Instructor Management

Manage the list of instructors assigned to a specific course.

### Add Instructor
- **Description**: Add an existing user (trainer) to the course's instructor list.
- **Endpoint**: `PUT /api/courses/:id/instructors/add`
- **Access**: Private (Admin, Trainer)
- **Body**:
  ```json
  {
    "instructorId": "65abcdef1234567890abcdef"
  }
  ```

### Remove Instructor
- **Description**: Remove a trainer from the course.
- **Endpoint**: `PUT /api/courses/:id/instructors/remove`
- **Access**: Private (Admin, Trainer)
- **Body**:
  ```json
  {
    "instructorId": "65abcdef1234567890abcdef"
  }
  ```

### Update (Replace) Instructors
- **Description**: Replace the entire list of instructors.
- **Endpoint**: `PUT /api/courses/:id/instructors`
- **Access**: Private (Admin, Trainer)
- **Body**:
  ```json
  {
    "instructorIds": ["id1", "id2"]
  }
  ```

---

## 3. Versioning & Rollback

The system automatically maintains version history whenever a course is updated.

### Update Course (with Auto-Versioning)
- **Description**: Update course details. 
  - **Behavior**: Before applying updates, the *current* state of the course is saved as a new `CourseVersion`.
- **Endpoint**: `PUT /api/courses/:id`
- **Access**: Private (Admin, Trainer)
- **Body** (Partial updates supported):
  ```json
  {
    "courseName": "Advanced Node.js - Updated v2",
    "courseDescription": "New description..."
  }
  ```

### Get Version History
- **Description**: List all past versions of a course.
- **Endpoint**: `GET /api/courses/:id/versions`
- **Access**: Private
- **Response**: List of versions with `versionNumber`, `snapshotDate`, and basic info.

### Rollback Course
- **Description**: Restore the course to a previous version state.
  - **Behavior**: The current state is preserved as a new version before rolling back (safety mechanism). Then, the course data is overwritten with the data from the selected version.
- **Endpoint**: `POST /api/courses/:id/rollback/:versionId`
- **Access**: Private (Admin, Trainer)
- **Note**: `versionId` is the `_id` of the `CourseVersion` document, NOT the `versionNumber`.

---

## Data Models

### Course (Current State)
Stored in `courses` collection. Represents the live version of the course used by students and the application.

### CourseVersion (History)
Stored in `courseversions` collection. Immutable snapshots containing:
- `courseRef`: Link to original course.
- `versionNumber`: Incremental version ID (1, 2, 3...).
- `snapshotDate`: Timestamp of creation.
- `...CourseFields`: Full copy of course data at that point in time.
