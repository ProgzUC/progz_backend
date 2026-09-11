import SibApiV3Sdk from "@sendinblue/client";

const sendEmail = async (options) => {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const fromEmail = process.env.FROM_EMAIL?.trim();
    if (!apiKey) {
        throw new Error("BREVO_API_KEY is required to send email.");
    }
    if (!fromEmail) {
        throw new Error("FROM_EMAIL is required to send email.");
    }

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    // Set API key from environment variable
    apiInstance.setApiKey(
        SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
        apiKey
    );

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = {
        name: "Progz Support",
        email: fromEmail,
    };
    sendSmtpEmail.to = [{ email: options.email }];
    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.htmlContent = options.html;

    if (options.message) {
        sendSmtpEmail.textContent = options.message;
    }

    await apiInstance.sendTransacEmail(sendSmtpEmail);
};

export default sendEmail;
