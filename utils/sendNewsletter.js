const newseletterTemplate = require('../mailTemplates/newsletter');
const transporter = require('../mailer');
const User = require('../models/User.js'); // Adjust path as needed
const Highlight = require('../models/Highlight.js');
const Books = require('../models/Books.js');

const NEWSLETTER_HIGHLIGHTS_COUNT = process.env.NEWSLETTER_HIGHLIGHTS_COUNT || 10; // Default to 10 if not set

async function getRandomHighlightsForUser(user) {
    try {
        // Use aggregation pipeline with $sample for efficient random selection
        const highlights = await Highlight.aggregate([
            { $match: { userId: user._id, isActive: true, type: { $ne: 'note' } } },
            { $sample: { size: parseInt(NEWSLETTER_HIGHLIGHTS_COUNT) } },
            { 
                $lookup: { 
                    from: 'books', 
                    localField: 'bookId', 
                    foreignField: '_id', 
                    as: 'book' 
                } 
            },
            { $unwind: '$book' },
            { 
                $project: { 
                    highlight: 1, 
                    bookTitle: '$book.title', 
                    author: '$book.author',
                    location: 1,
                    timestamp: 1,
                    knowledge_begin_date: 1,
                    knowledge_end_date: 1
                } 
            }
        ]);

        return highlights;
    } catch(err) {
        console.error('Error fetching highlights for user:', err);
        return [];
    }
}

async function sendNewsletter(){
    // console.log('Sending newsletter...');
    let newsLetterCount = 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    let users = [];
    if(process.env.BACKEND_URL === 'http://localhost:3000') {
        users = await User.find({
          optForNewsletter: true,
        });
    }else{ // for deployment check if already sent today, for local development, spam send every minute.
        users = await User.find({
          optForNewsletter: true,
          $or: [
            { lastNewsletterSent: { $lt: startOfToday } },
            { lastNewsletterSent: { $exists: false } },
            { lastNewsletterSent: null }
          ]
        });
    }


    for (const user of users) {
        try{
        console.log("Sending newsletter to:", user.email);
        const highlights = await getRandomHighlightsForUser(user);
            if(highlights.length === 0) {
                console.log(`No highlights found for user ${user.email}. Skipping newsletter.`);
                // Update user's last newsletter sent date to avoid trying again today
                user.lastNewsletterSent = new Date(); // Update last sent date
                continue;
            }
            const { subject, text, html } = newseletterTemplate({ given_name: user.firstName || 'User', highlights });
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: user.email,
                subject,
                text,
                html
            });
            // Update user's newsletter status
            user.lastNewsletterSent = new Date();
            await user.save();
            console.log(`Newsletter sent to ${user.email}`);
            newsLetterCount++;
        }catch(error){
            console.error(`Failed to send newsletter to ${user.email}:`, error);   
        }
    }
    if(newsLetterCount === 0) {
        console.log('No newsletters sent.');
    } else {
        console.log(`${newsLetterCount} newsletters sent successfully!`);
    }
}

module.exports = sendNewsletter;