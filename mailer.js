const nodemailer = require('nodemailer');

// Create transporter with Render-optimized settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  connectionTimeout: 120000,
  greetingTimeout: 60000,
  socketTimeout: 120000,
  pool: false,
  maxConnections: 1,
  maxMessages: 1,
  tls: {
    rejectUnauthorized: false,
    servername: 'smtp.gmail.com'
  },
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development'
});

// Enhanced verify function with retry logic
async function verifyTransporter() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      await transporter.verify();
      console.log('✅ Nodemailer transporter is ready');
      return true;
    } catch (error) {
      attempts++;
      console.error(`❌ Transporter verification attempt ${attempts} failed:`, error.message);
      
      if (attempts === maxAttempts) {
        console.error('🚨 All transporter verification attempts failed');
        console.log('📧 Email config debug:', {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          userSet: !!process.env.EMAIL_USER,
          userValue: process.env.EMAIL_USER,
          passLength: process.env.EMAIL_PASSWORD?.length || 0
        });
        return false;
      }
      
      console.log(`⏳ Waiting 5s before retry attempt ${attempts + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Add email sending wrapper with retry logic
async function sendEmailWithRetry(mailOptions, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 Email attempt ${attempt}/${maxRetries} to: ${mailOptions.to}`);
      
      if (attempt > 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        console.log(`⏳ Waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully on attempt ${attempt}`);
      return { success: true, result, attempt };
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (error.code === 'EAUTH' || error.message.includes('authentication')) {
        console.error('🚨 Authentication error - stopping retries');
        return { 
          success: false, 
          error: error.message, 
          shouldStop: true,
          attempt 
        };
      }
      
      if (attempt === maxRetries) {
        console.error('🚨 All retry attempts exhausted');
        return { success: false, error: error.message, attempt };
      }
    }
  }
}

// Verify on startup
verifyTransporter();

// Export transporter as default for backward compatibility
module.exports = transporter;
// Also export the retry function
module.exports.sendEmailWithRetry = sendEmailWithRetry;