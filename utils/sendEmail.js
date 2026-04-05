import SibApiV3Sdk from "@sendinblue/client";

const sendEmail = async (options) => {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    // Set API key from environment variable
    apiInstance.setApiKey(
        SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
        process.env.BREVO_API_KEY
    );

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = {
        name: "Progz Support",
        email: process.env.FROM_EMAIL,
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
