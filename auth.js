const express = require('express');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();
const User = require('./models/User'); // Assuming you have a User model defined
const bcrypt = require('bcrypt'); // npm install bcrypt
// Replace with your Google Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// const uri = process.env.MONGODB_URI;

// // User schema
// const userSchema = new mongoose.Schema({
//   email: String,
//   otp: String,
//   otpExpires: Date,
//   // Add other fields as needed
// });
// const User = mongoose.model('User', userSchema);

// // Connect to MongoDB (do this in your main server.js in production)
// mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// // Utility to generate a 6-digit OTP
// function generateOTP() {
//   return Math.floor(100000 + Math.random() * 900000).toString();
// }

// // Setup nodemailer transporter (use your SMTP credentials)
// const transporter = nodemailer.createTransport({
//   service: 'gmail', // or your email provider
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

router.post('/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'No token provided' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ message: 'Invalid Google token' });

    // Extract user info from Google payload
    const { email, given_name, family_name, sub } = payload;
    console.log(email, given_name, family_name, sub);
    // Find or create user
    let user = await User.findOne({ email });
    console.log("User found:", user);
    if (!user) {
      user = await User.create({
        email,
        firstName: given_name,
        lastName: family_name,
        googleId: sub,
        verified: true // Google SSO users are considered verified
      });
      console.log("User created:", user);
    }

    // You may want to generate a session/JWT here for the user
    res.status(200).json({ message: 'Google sign-in successful', user });
  } catch (error) {
    console.error('Google token verification failed:', error);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

router.post('/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Generate OTP and expiry (e.g., 10 minutes from now)
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Save user with OTP
    user = new User({ email, otp, otpExpires });
    await user.save();

    // Send OTP email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Signup OTP',
      text: `Your OTP is: ${otp}`,
    });

    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/auth/signup', async (req, res) => {
  const { email, firstName, lastName, password } = req.body;
  if (!email || !firstName || !lastName || !password)
    return res.status(400).json({ message: 'All fields are required' });

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user as unverified
    user = await User.create({
      email,
      firstName,
      lastName,
      passwordHash,
      verified: false
    });

    // Send verification email with a link or OTP (implement separately)
    
    // await sendVerificationEmail(user);

    res.status(200).json({ message: 'Signup successful, verification email sent' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'email is not registered with us' });
    if (!user.verified) return res.status(403).json({ message: 'Email not verified' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Incorrect Password' });

    // Generate session/JWT here if needed
    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;