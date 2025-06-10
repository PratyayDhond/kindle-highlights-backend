const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

transporter.verify(function(error, success) {
  if (error) {
    console.error('Nodemailer transporter error:', error);
  } else {
    console.log('Nodemailer transporter is ready');
  }
});

module.exports = transporter;