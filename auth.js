const express = require('express');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const router = express.Router();
const User = require('./models/User'); // Assuming you have a User model defined
const bcrypt = require('bcrypt'); // npm install bcrypt
// Replace with your Google Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

router.post('/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'No token provided', googleId: null });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ message: 'Invalid Google token', googleId: null });

    // Extract user info from Google payload
    const { email, given_name, family_name, sub } = payload;
    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        firstName: given_name,
        lastName: family_name,
        googleId: sub,
        verified: true // Google SSO users are considered verified
      });
    }

    res.status(200).json({ message: 'Google sign-in successful', googleId: user.googleId });
  } catch (error) {
    console.error('Google token verification failed:', error);  
    res.status(401).json({ message: 'Invalid Google token', googleId: null });
  }
});

router.post('/auth/signup', async (req, res) => {
  const { email, firstName, lastName, password } = req.body;
  if (!email || !firstName || !lastName || !password)
    return res.status(400).json({ message: 'All fields are required' });
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
  console.log(email, firstName, lastName, password);

    user = await User.create({
      email,
      firstName,
      lastName,
      passwordHash,
      verified: false,
      verificationToken
    });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${email}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your email',
      text: `Click this link to verify your email: ${verificationUrl}`,
    });

    console.log("Verification link:", verificationUrl);
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
    if (!user) return res.status(401).json({ message: 'Email is not registered' });
    if (!user.verified) return res.status(403).json({ message: 'Email not verified' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Incorrect password' });

    // Generate session/JWT here if needed
    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/auth/verify-email', async (req, res) => {
  const { token, email } = req.body;
  if (!token || !email) return res.status(400).json({ message: 'Invalid link' });
  console.log("Verification token:", token, "Email:", email);
  try {
    const user = await User.findOne({ email, verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;





// #todo
// check why it is taking frontend url for the verification email link since we can directly use the backend url.
