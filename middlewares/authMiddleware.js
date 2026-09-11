import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ACCESS_TOKEN_COOKIE } from "../utils/cookieAuth.js";
import { normalizeRole } from "../utils/authorizationHelpers.js";
import { sendError } from "../utils/apiError.js";

const extractAccessToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token && token !== "null" && token !== "undefined") {
      return token;
    }
  }
  return req.cookies?.[ACCESS_TOKEN_COOKIE] || null;
};

export const protect = async (req, res, next) => {
  try {
    const token = extractAccessToken(req);
    if (!token) return sendError(res, 401, "No token provided", { code: "NO_TOKEN" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id role email name");
    if (!user) {
      return sendError(res, 401, "User not found or deactivated", { code: "USER_NOT_FOUND" });
    }

    // Prefer live DB role over JWT claim (handles demotion / role change)
    req.user = {
      id: user._id.toString(),
      role: normalizeRole(user.role),
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    console.error("🔒 Auth protect error:", error.name, error.message);
    if (error.name === "TokenExpiredError") {
      return sendError(res, 401, "Token expired", { code: "TOKEN_EXPIRED" });
    }
    return sendError(res, 401, "Invalid token", { code: "INVALID_TOKEN" });
  }
};

export const authorizeRoles = (...roles) => {
  const normalizedAllowed = roles.map((r) => normalizeRole(r));
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);

    if (!normalizedAllowed.includes(userRole)) {
      console.error(
        `🔒 Authorize roles failed: user role '${req.user?.role}' not in required roles [${roles.join(", ")}]`
      );
      return sendError(res, 403, "Access denied", { code: "FORBIDDEN" });
    }

    next();
  };
};
