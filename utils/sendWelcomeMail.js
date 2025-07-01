const transporter = require('../mailer');
const welcomeUserMailTemplate = require('../mailTemplates/welcomeUser');

async function sendWelcomeMail({ email, given_name }) {
  const { subject, text, html } = welcomeUserMailTemplate({ given_name, email });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    text,
    html
  });
}

module.exports = sendWelcomeMail;