# Class Session & Attendance API

This document outlines the Class Session and Attendance tracking API endpoints.

## Model: ClassSession

```javascript
{
  _id: ObjectId,
  batch: ObjectId (ref: Batch),
  trainer: ObjectId (ref: User),
  date: Date,
  startTime: Date,
  endTime: Date,
  attendance: [
    {
      student: ObjectId (ref: User),
      status: "Present" | "Absent" | "Late"
    }
  ],
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Endpoints

### 1. Start Class Session

**POST** `/api/class-session/start`

**Auth**: Trainer only

**Body**:
```json
{
  "batchId": "507f1f77bcf86cd799439011"
}
```

**Response**:
```json
{
  "_id": "507f1f77bcf86cd799439022",
  "batch": { "_id": "...", "name": "FSD Morning Batch" },
  "trainer": { "_id": "...", "name": "John Doe", "email": "..." },
  "date": "2026-01-29T10:00:00.000Z",
  "startTime": "2026-01-29T10:02:15.123Z",
  "endTime": null,
  "attendance": [
    {
      "student": { "_id": "...", "name": "Alice", "email": "..." },
      "status": "Absent"
    }
  ],
  "notes": "",
  "createdAt": "2026-01-29T10:02:15.123Z",
  "updatedAt": "2026-01-29T10:02:15.123Z"
}
```

---

### 2. Mark Attendance

**PATCH** `/api/class-session/:id/attendance`

**Auth**: Trainer only (must be the session owner)

**Body**:
```json
{
  "attendance": [
    { "studentId": "507f1f77bcf86cd799439033", "status": "Present" },
    { "studentId": "507f1f77bcf86cd799439034", "status": "Late" }
  ]
}
```

**Response**: Updated session object

---

### 3. End Class Session

**PATCH** `/api/class-session/:id/end`

**Auth**: Trainer only (must be the session owner)

**Body**:
```json
{
  "notes": "Covered React hooks and state management. Homework: Build todo app."
}
```

**Response**:
```json
{
  "_id": "507f1f77bcf86cd799439022",
  "endTime": "2026-01-29T11:30:45.789Z",
  "duration": "88 minutes",
  ...
}
```

---

### 4. Get Class Sessions for Batch

**GET** `/api/class-session/batch/:batchId?startDate=2026-01-01&endDate=2026-01-31`

**Auth**: Trainer or Admin

**Query Params** (optional):
- `startDate`: Filter sessions from this date
- `endDate`: Filter sessions until this date

**Response**:
```json
{
  "sessions": [
    {
      "_id": "...",
      "date": "2026-01-29T10:00:00.000Z",
      "startTime": "...",
      "endTime": "...",
      "duration": "88 minutes",
      "trainer": { "name": "John Doe" },
      "attendanceSummary": {
        "present": 18,
        "absent": 2,
        "late": 1,
        "total": 21
      },
      "notes": "..."
    }
  ]
}
```

---

### 5. Get Student Attendance History

**GET** `/api/class-session/student/me`

**Auth**: Student only

**Response**:
```json
{
  "attendanceHistory": [
    {
      "sessionId": "...",
      "date": "2026-01-29T10:00:00.000Z",
      "batchName": "FSD Morning Batch",
      "trainerName": "John Doe",
      "status": "Present",
      "duration": "88 minutes",
      "notes": "..."
    }
  ],
  "summary": {
    "totalSessions": 45,
    "present": 40,
    "late": 3,
    "absent": 2,
    "attendancePercentage": 96
  }
}
```

---

### 6. Get Batch Attendance Report

**GET** `/api/class-session/batch/:batchId/report`

**Auth**: Admin or Trainer

**Response**:
```json
{
  "batchName": "FSD Morning Batch",
  "totalSessions": 45,
  "studentReports": [
    {
      "studentId": "...",
      "studentName": "Alice Johnson",
      "studentEmail": "alice@example.com",
      "present": 40,
      "late": 3,
      "absent": 2,
      "totalSessions": 45,
      "attendancePercentage": 96
    }
  ]
}
```

---

## Business Logic

### Starting a Class
1. Validates batch exists
2. Checks trainer is assigned to batch
3. Ensures no other active session for the batch
4. Creates session with all students marked "Absent"
5. Sets startTime to current time

### Marking Attendance
- Trainer can update status of any student
- Valid statuses: "Present", "Absent", "Late"
- Can be called multiple times during session

### Ending a Class
- Sets endTime to current time
- Calculates duration
- Saves optional notes
- Session becomes read-only

### Attendance Calculation
- **Percentage** = (Present + Late) / Total Sessions × 100
- Used for student progress tracking
- Included in reports

---

## Error Handling

Common error responses:

```json
{
  "message": "Batch not found"
}
```

```json
{
  "message": "You are not assigned to this batch"
}
```

```json
{
  "message": "There is already an active class session for this batch"
}
```

```json
{
  "message": "Class session already ended"
}
```

---

## Integration Example

```javascript
// Start class
const session = await startClass(batchId);

// Mark attendance
await markAttendance(session._id, [
  { studentId: "...", status: "Present" }
]);

// End class
await endClass(session._id, "Covered topics X, Y, Z");
```
