import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ACCESS_TOKEN_COOKIE } from "../utils/cookieAuth.js";
import { normalizeRole } from "../utils/authorizationHelpers.js";

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
    if (!token) return res.status(401).json({ msg: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id role email name");
    if (!user) {
      return res.status(401).json({ msg: "User not found or deactivated" });
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
      return res.status(401).json({ msg: "Token expired", code: "TOKEN_EXPIRED" });
    }
    res.status(401).json({ msg: "Invalid token" });
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
      return res.status(403).json({ msg: "Access denied" });
    }

    next();
  };
};
