const newseletterTemplate = require('../mailTemplates/newsletter');
const transporter = require('../mailer');
const User = require('../models/User.js'); // Adjust path as needed
const Books = require('../models/Books.js'); // Adjust path as needed

const NEWSLETTER_HIGHLIGHTS_COUNT = process.env.NEWSLETTER_HIGHLIGHTS_COUNT || 10; // Default to 10 if not set

async function getRandomHighlightsForUser(user) {
    const highlightsForNewsletter = []
    try{

        const books = await Books.find({ userId: user._id });
        if (!books || books.length === 0) {
            return [];
        }

        const highlights = []

        books.forEach(book => {
            if (book.highlights && book.highlights.length > 0) {
                book.highlights.forEach(highlight => {
                    if(highlight.type === 'note')
                        return; // Skip notes, only include highlights
                    highlights.push({
                        highlight: highlight.highlight,
                        bookTitle: book.title,
                        author: book.author,
                        location: highlight.location,
                        timestamp: highlight.timestamp,
                        knowledge_begin_date: highlight.knowledge_begin_date,
                        knowledge_end_date: highlight.knowledge_end_date
                    });
                });
            }
        });

        for (let i = 0; i < Math.min(NEWSLETTER_HIGHLIGHTS_COUNT, highlights.length); i++) {
            const randomIndex = Math.floor(Math.random() * highlights.length);
            if(highlightsForNewsletter.includes(highlights[randomIndex])) {
                i--; // If the highlight is already included, decrement i to try again
                continue;
            }
            highlightsForNewsletter.push(highlights[randomIndex]);
        }

        highlights.length = 0
    }catch(err) {
        console.error('Error fetching highlights for user:', err);
        return [];
    }
    return highlightsForNewsletter;
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