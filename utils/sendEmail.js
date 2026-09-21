import nodemailer from "nodemailer";

let transporter;

function smtpAuth() {
    const user = process.env.SMTP_USER?.trim();
    // Gmail app passwords are 16 chars; Google shows them with spaces.
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, "") || "";
    return { user, pass };
}

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT) || 587;
    const { user, pass } = smtpAuth();

    if (!host || !user || !pass) {
        throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.");
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user, pass },
    });

    return transporter;
}

export function resetEmailTransporter() {
    transporter = null;
}

const sendEmail = async (options) => {
    const { user } = smtpAuth();
    const fromEmail =
        process.env.SMTP_FROM_EMAIL?.trim() || user;
    const fromName = options.fromName?.trim() || process.env.SMTP_FROM_NAME?.trim() || "ProgZ Academy";

    if (!fromEmail) {
        throw new Error("SMTP_FROM_EMAIL or SMTP_USER is required to send email.");
    }
    if (!options?.email) {
        throw new Error("Recipient email is required.");
    }

    try {
        await getTransporter().sendMail({
            from: { name: fromName, address: fromEmail },
            replyTo: fromEmail,
            to: options.email,
            subject: options.subject,
            text: options.message || undefined,
            html: options.html || undefined,
            envelope: {
                from: user || fromEmail,
                to: options.email,
            },
        });
    } catch (err) {
        if (err.code === "EAUTH" || err.responseCode === 535) {
            resetEmailTransporter();
            throw new Error(
                "Gmail rejected the SMTP login. Create a new App Password for this Gmail account, put it in SMTP_PASS in .env, then restart the backend."
            );
        }
        throw err;
    }
};

export default sendEmail;
