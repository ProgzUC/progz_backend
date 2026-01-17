# Authentication Module Documentation

This module handles user registration, login, and password management.

## Quick Links
- [Auth Controller](controllers/authController.js)
- [Auth Routes](routes/authRoutes.js)

---

## 1. Registration
- **Description**: Register a new user (Student/Trainer/Admin).
- **Endpoint**: `POST /api/auth/register`
- **Access**: Public
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "student" // optional, defaults to student
  }
  ```

## 2. Login
- **Description**: Authenticate user and receive JWT token.
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Response**:
  ```json
  {
    "accessToken": "eyJhbG...",
    "user": { ... }
  }
  ```

## 3. Password Management

### Forgot Password
- **Description**: Request a password reset link (sends email).
- **Endpoint**: `POST /api/auth/forgot-password`
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "john@example.com"
  }
  ```

### Reset Password
- **Description**: Reset password using the token received in email.
- **Endpoint**: `POST /api/auth/reset-password/:token`
- **Access**: Public
- **Body**:
  ```json
  {
    "password": "newpassword123"
  }
  ```
