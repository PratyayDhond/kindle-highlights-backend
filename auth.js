const express = require('express');
const transporter = require('./mailer'); // or '../mailer' based on location
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const router = express.Router();
const User = require('./models/User'); // Assuming you have a User model defined
const bcrypt = require('bcrypt'); // npm install bcrypt
const sendWelcomeMail = require('./utils/sendWelcomeMail');
const jwt = require('jsonwebtoken');

// Replace with your Google Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Set in .env

// currently only supports gmail.com emails
// Add support for other email providers
const cleanEmail = (email) => {
  const [username, domain] = email.split("@");
  if (domain && domain.toLowerCase() === "gmail.com") {
    const cleanedUsername = username.split("+")[0].replace(/\./g, "");
    return `${cleanedUsername}@${domain}`;
  }
  return email;
};

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
    const cleanedEmail = cleanEmail(email);
    if (!cleanedEmail) return res.status(400).json({ message: 'Invalid email', googleId: null });

    console.log("Google user info:", { email, given_name, family_name, sub });
    console.log("Cleaned email:", cleanedEmail);
    // Find or create user
    let user = await User.findOne({ email: cleanedEmail });
    const newUser = !user;
    if (!user) {
      user = await User.create({
        email: cleanedEmail,
        firstName: given_name,
        lastName: family_name,
        googleId: sub,
        verified: true // Google SSO users are considered verified
      });
    }

    // Code to add option for user to use Google SSO instead of normal signup/login
    // if(user && user.googleId !== sub) {
      // user.googleId = sub; // Update Google ID if it has changed
      // await user.save();
    // }

    if(user && user.googleId === null)
      res.status(400).json({ message: 'Google SSO not enabled for this user', googleId: null });
    else{
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        sameSite: 'lax'
      });
      // why use res.cookie?
      // To set a cookie in the user's browser with the JWT token for authentication without requiring the user to log in again on subsequent requests.
      // This allows the server to recognize the user in future requests and maintain their session.
      // This is particularly useful for Single Sign-On (SSO) scenarios like Google login, where the user is authenticated via Google and the server needs to maintain that session.


      if(newUser) {
        await sendWelcomeMail({ given_name, email: cleanedEmail });
        res.status(201).json({ message: 'Google login successful, user created', user, googleId: sub });
      }
      else
        res.status(200).json({ message: 'Google login successful', user, googleId: sub });
    }
  } catch (error) {
    console.error('Google token verification failed:', error);  
    res.status(401).json({ message: 'Invalid Google token', googleId: null });
  }
});

router.post('/auth/signup', async (req, res) => {
  const { email, firstName, lastName, password } = req.body;
  if (!email || !firstName || !lastName || !password)
    return res.status(400).json({ message: 'All fields are required' });
  let cleanedEmail = cleanEmail(email);
  if (!cleanedEmail) return res.status(400).json({ message: 'Invalid email' });
  try {
    let user = await User.findOne({ email: cleanedEmail });
    console.log("User found:", user);
    if (user) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    console.log(email, firstName, lastName, password);
    
    user = await User.create({
      email: cleanedEmail,
      firstName,
      lastName,
      passwordHash,
      verified: false,
      verificationToken
    });
    console.log("User created:", user);
    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${cleanedEmail}`;
    console.log("Verification URL:", verificationUrl);
    console.log("Sending verification email to:", cleanedEmail);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: cleanedEmail,
      subject: 'Verify your email',
      text: `Click this link to verify your email: ${verificationUrl}`,
    });
    console.log("Verification email sent to:", cleanedEmail);
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
  let cleanedEmail = cleanEmail(email);
  if (!cleanedEmail) return res.status(400).json({ message: 'Invalid email' });
  console.log("Login attempt for email:", cleanedEmail);
  try {
    const user = await User.findOne({ email: cleanedEmail });
    if (!user) return res.status(401).json({ message: 'Email is not registered' });
    if (!user.verified) return res.status(403).json({ message: 'Email is not verified' });
    if(!user.passwordHash) return res.status(403).json({ message: 'Password is not set for this user' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Incorrect password' });

    // Generate session/JWT here if needed
    console.log("User logged in:", user);
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      sameSite: 'lax'
    });

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

    // Send welcome email after successful verification
    await sendWelcomeMail({ given_name: user.firstName, email: user.email });

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out' });
});

function authenticate(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

router.get('/protected', authenticate, (req, res) => {
  res.json({ message: 'You are authenticated', user: req.user });
});

router.get('/auth/me', authenticate, (req, res) => {
  // req.user is set by the authenticate middleware
  res.status(200).json({ user: req.user });
});

module.exports = router;





// #todo
// check why it is taking frontend url for the verification email link since we can directly use the backend url.
