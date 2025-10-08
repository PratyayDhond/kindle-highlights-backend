const express = require('express');
const router = express.Router();
const User = require('./models/User'); // Adjust path as needed
const authenticate = require('./auth').authenticate; // Assuming you have an authenticate middleware
const { sendEmailWithRetry } = require('./mailer'); // or wherever you put the retry function

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

// Update your newsletter function to use the retry wrapper

async function sendNewsletter() {
    console.log('🚀 Starting newsletter sending process...');
    let newsLetterCount = 0;
    let failedCount = 0;
    let shouldStop = false;
    
    // ... your existing user fetching code ...
    
    console.log(`📬 Found ${users.length} users to send newsletters to`);

    for (const user of users) {
        if (shouldStop) {
            console.log('🛑 Stopping due to authentication/server error');
            break;
        }
        
        try {
            console.log(`📤 Processing newsletter for: ${user.email}`);
            const highlights = await getRandomHighlightsForUser(user);
            
            if (highlights.length === 0) {
                console.log(`⚠️  No highlights found for ${user.email}`);
                user.lastNewsletterSent = new Date();
                await user.save();
                continue;
            }
            
            const { subject, text, html } = newseletterTemplate({ 
                given_name: user.firstName || 'User', 
                highlights 
            });
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject,
                text,
                html
            };
            
            const result = await sendEmailWithRetry(mailOptions, 5);
            
            if (result.success) {
                user.lastNewsletterSent = new Date();
                await user.save();
                newsLetterCount++;
                console.log(`✅ Newsletter sent to ${user.email} (attempt ${result.attempt})`);
            } else {
                console.error(`❌ Failed to send to ${user.email}: ${result.error}`);
                failedCount++;
                
                if (result.shouldStop) {
                    shouldStop = true;
                }
            }
            
            // Longer delay between emails to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds
            
        } catch (error) {
            console.error(`💥 Unexpected error for ${user.email}:`, error);
            failedCount++;
        }
    }
    
    console.log(`📊 Newsletter complete: ${newsLetterCount} sent, ${failedCount} failed`);
}

module.exports = {
  router,
};