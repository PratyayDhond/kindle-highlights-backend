const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();

// Replace with your Google Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post('/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ message: 'No token provided' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }
    console.log('Google token verified:', payload);
    // You can now use payload info (email, name, etc.) to create/find user in your DB
    // For now, just return the payload
    res.status(200).json({ message: 'Google token verified', user: payload });
  } catch (error) {
    console.error('Google token verification failed:', error);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

module.exports = router;