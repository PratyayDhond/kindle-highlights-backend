
const express = require('express');
const router = express.Router();
const User = require('./models/User'); // Adjust path as needed
const authenticate = require('./auth').authenticate; // Assuming you have an authenticate middleware

router.post('/newsletter/subscribe', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const consent = req.body.consent;
    if (!consent || consent !== true) {
        console.error("User consent not provided for newsletter subscription for user ID:", userId);
        return res.status(400).json({ message: 'User consent not provided for newsletter subscription.' });
    }

    const user = await User.findById(userId);
    if (!user) {
        console.error("User not found for ID:", userId, " while subscribing to newsletter");
        return res.status(404).json({ message: 'User not found' });
    }

    if(user.optForNewsletter) {
        console.error("User already subscribed to newsletter for ID:", userId);
        return res.status(400).json({ message: 'User already subscribed to newsletter' });
    }
    user.optForNewsletter = true;
    await user.save();
    console.log(`User with ID: ${userId} subscribed to the newsletter`);
    res.status(200).json({ message: 'Subscribed to newsletter successfully' });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/newsletter/unsubscribe', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const consent = req.body.consent;
    if (!consent || consent !== true) {
        console.error("User consent not provided for newsletter unsubscription for user ID:", userId);
        return res.status(400).json({ message: 'User consent not provided for newsletter unsubscription.' });
    }

    const user = await User.findById(userId);
    if (!user) {
        console.error("User not found for ID:", userId, " while unsubscribing from newsletter");
        return res.status(404).json({ message: 'User not found' });
    }

    if(user.optForNewsletter === false) {
        console.error("User already unsubscribed from newsletter for ID:", userId);
        return res.status(400).json({ message: 'User already unsubscribed from newsletter' });
    }

    user.optForNewsletter = false;
    await user.save();
    res.status(200).json({ message: 'Unsubscribed from newsletter successfully' });
  } catch (error) {
    console.error('Error unsubscribing from newsletter:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = {
  router,
};