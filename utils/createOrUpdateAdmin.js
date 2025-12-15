import bcrypt from "bcryptjs";
import User from "../models/User.js";

const createOrUpdateAdmin = async () => {
  try {
    const {
      ADMIN_NAME,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      ADMIN_PHONE,
    } = process.env;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.log("⚠️ Admin env not provided, skipping admin setup");
      return;
    }

    const admin = await User.findOne({ role: "admin" });

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    if (admin) {
      // 🔁 UPDATE EXISTING ADMIN
      admin.name = ADMIN_NAME || admin.name;
      admin.email = ADMIN_EMAIL;
      admin.phone = ADMIN_PHONE || admin.phone;
      admin.password = hashedPassword;

      await admin.save();

      console.log("🔁 Admin updated from .env");
    } else {
      // 🆕 CREATE ADMIN
      await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        password: hashedPassword,
        role: "admin",
      });

      console.log("🎉 Admin created from .env");
    }
  } catch (error) {
    console.error("❌ Admin setup failed:", error.message);
  }
};

export default createOrUpdateAdmin;
