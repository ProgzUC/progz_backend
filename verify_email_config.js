import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const testEmail = async () => {
    console.log("Testing SMTP connection...");
    console.log(`Host: ${process.env.SMTP_HOST}`);
    console.log(`Port: ${process.env.SMTP_PORT}`);
    console.log(`User: ${process.env.SMTP_USER}`);
    // Do not log the full password for security, but check if it's loaded
    console.log(`Pass loaded: ${process.env.SMTP_PASS ? "Yes" : "No"}`);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        await transporter.verify();
        console.log("✅ Server is ready to take our messages");

        const info = await transporter.sendMail({
            from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
            to: process.env.SMTP_USER, // Send to self
            subject: "Test Email from Progz",
            text: "If you see this, nodemailer is configured correctly.",
        });

        console.log("✅ Message sent: %s", info.messageId);
    } catch (error) {
        console.error("❌ Error occurred:");
        console.error(error);
    }
};

testEmail();
