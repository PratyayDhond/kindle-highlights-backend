const transporter = require('../mailer');
const welcomeUserMailTemplate = require('../mailTemplates/welcomeUser');

async function sendWelcomeMail({ email, given_name }) {
  const { subject, text } = welcomeUserMailTemplate({ given_name, email });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    text,
  });
}

module.exports = sendWelcomeMail;