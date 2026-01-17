# User Management & System Utilities Documentation

This module covers User profile management, the Recycle Bin for soft deletions, and Synchronization with the External Zen API.

## Quick Links
- [User Controller](controllers/userController.js)
- [Bin Controller](controllers/binController.js)
- [Sync Controller](controllers/syncController.js)

---

## 1. User Management

### Get User Profile
- **Endpoint**: `GET /api/users/:id`
- **Access**: Private (Admin can view all; Users can view self)

### Update User Profile
- **Endpoint**: `PUT /api/users/:id`
- **Access**: Private
- **Note**: 
    - Admins can update all fields including `name` and `phone`.
    - Verification: `name` and `phone` are restricted for regular users.

### Delete User (Soft Delete)
- **Endpoint**: `DELETE /api/users/:id`
- **Access**: Private (Admin Only)
- **Behavior**: Moves user to Recycle Bin.

---

## 2. Recycle Bin
Items (Courses/Users) deleted via the application are moved here for 15 days before permanent deletion.

### Get Bin Items
- **Endpoint**: `GET /api/bin`
- **Access**: Private (Admin Only)

### Restore Item
- **Endpoint**: `POST /api/bin/:id/restore`
- **Access**: Private (Admin Only)
- **Behavior**: Restores item to its original collection.

### Permanent Delete
- **Endpoint**: `DELETE /api/bin/:id`
- **Access**: Private (Admin Only)

---

## 3. Zen Synchronization
Sync trainers and students from the external Zen API.

### Manual Sync Trigger
- **Endpoint**: `POST /api/sync/manual`
- **Access**: Private (Admin Only)
- **Behavior**: Triggers the sync process for both Instructors and Students.

### Fetch Zen Trainers
- **Endpoint**: `GET /api/sync/trainers`
- **Access**: Private (Admin Only)
- **Behavior**: Returns a raw list of available trainers from Zen (Endpoint: `/api/trainers/progz`).
