import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_COOKIE } from "../utils/cookieAuth.js";

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

export const protect = (req, res, next) => {
  try {
    const token = extractAccessToken(req);
    if (!token) return res.status(401).json({ msg: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

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
  const normalizedAllowed = roles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    let userRole = String(req.user?.role || "").toLowerCase();
    if (userRole === "instructor") userRole = "trainer";

    if (!normalizedAllowed.includes(userRole)) {
      console.error(`🔒 Authorize roles failed: user role '${req.user?.role}' not in required roles [${roles.join(", ")}]`);
      return res.status(403).json({ msg: "Access denied" });
    }

    next();
  };
};
