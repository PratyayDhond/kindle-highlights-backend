// File: server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); // npm install uuid
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;
// const SECRET = 'supersecret';
const parseHighlights = require('./parseHighlights.js'); // Import the highlight parsing function
const getHighlightsZip = require('./getHighlightsZip.js'); // Import the function to create zip from highlights
const {setProgress, deleteProgress, getProgress} = require('./progress.js');
const { router: authRoutes, authenticate } = require('./auth.js');
const User = require('./models/User'); // Adjust path as needed
const Book = require('./models/Books'); // Adjust path as needed

const FRONTEND_URL = process.env.FRONTEND_URL; // Default to localhost if not set
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

// CORS middleware should be first!
app.use(cors({
  origin: function(origin, callback){
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true // Allow cookies to be sent
}));

app.use(bodyParser.json());
app.use(cookieParser());
app.use(authRoutes);

const upload = multer({ dest: 'uploads/' }); // Uploaded files will go here

const PROCESSING_FEE_PER_BOOK = process.env.PROCESSING_FEE_PER_BOOK; // Set your fee

// #todo
// # deal with overloading reuploaded highlights with updateded highlights

// #todo
// update location field for highlights to store start and end locations across the codebase.
// Making this the norm will be helpful overall for future updates.

// #todo 
// nest all the code that makes call to any other function with an await or outside the codebase 
// into a try-catch block to handle errors gracefully.

// currently overwrites highlights for pre-existing books
async function saveHighlightsToUserProfile(highlights, userId) {
  for (const highlight of highlights) {
    // console.log('Processing highlight:', highlight);
    // console.log('User ID:', userId);

      let bookHighlights = [];
      for(const h of highlight.highlights) {
        let temp = {
          highlight : String(h.highlight).trim(), // Ensure highlight is a string
          type : String(h.type).trim(), // "highlight", "note", "bookmark"
          page : String(h.page).trim(), // Ensure page is a string
          location : { start: Number(h.locStart), end: Number(h.locEnd) }, // Store location
          timestamp : String(h.timestamp).trim() // Ensure timestamp is a string
        }

        if(temp.highlight === '') { // this handles deleted notes and highlights as well as bookmarks.
          continue;
        }
        bookHighlights.push(temp);
        // bookHighlights.push({highlight: String(h.highlight).trim(), type: String(h.type).trim(), timestamp: String(h.timestamp).trim()});
      }
    // console.log('highglight:', highlight);
      // console.log('Saving highlights for book:', highlight.name, 'by user:', userId);
      // Create a new book entry if it doesn't exist
      const book = new Book({
        userId,
        title: highlight.name,
        author: highlight.author,
        highlights: bookHighlights, // Store the highlights array
        // highlights: highlight.highlights // Spread operator to add highlights
      });

      // console.log(typeof(bookHighlights[0].timestamp));
      // console.log(book);
      // console.log(book.highlights);
      // console.log(bookHighlights);
      // console.log(highlight.highlights);
      // console.log('bookHighlights:', bookHighlights);
      // console.log('bookHighlights[0]:', bookHighlights[0]);
    await book.save();
  }
}

app.post('/get-user-highlights-json', authenticate, upload.single('file'), async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ message: 'User not found' });

  const file = req.file;
  const consent = req.body.consent; 
   console.log('Data Storage Consent:', consent);
   console.log('Inside get-user-highlights-json');
   console.log('File:', file);
   console.log('File path:', file.path);
   console.log('File originalname:', file.originalname);
  if (!file) return res.status(400).json({ message: 'No file uploaded' });
  const filePath = path.join(__dirname, file.path);

  fs.readFile(filePath, 'utf8', async (err, data) => {
    // Always delete the uploaded file
    fs.unlink(filePath, () => {});

    if (err) {
      return res.status(500).json({ message: 'Error reading file' });
    }

    const highlights = parseHighlights.parseHighlights(data);
    // console.log(highlights);
    console.log(highlights.length, 'highlights found');
    const uniqueBooks = highlights.length;
    const totalFee = uniqueBooks * PROCESSING_FEE_PER_BOOK;
    console.log("Total fee for processing:", totalFee, "for", uniqueBooks, "books");
    if (user.coins < totalFee) {
      return res.status(402).json({ message: `Not enough coins. You need ${totalFee} coins for ${uniqueBooks} books.` });
    }

    if(consent === 'true') {
      // Save Books for user's profile
      await saveHighlightsToUserProfile(highlights, userId);

    }

    user.coins -= totalFee;
    await user.save();
    return res.json({ 
      message: `Highlights processed successfully. Charged ${totalFee} coins for ${uniqueBooks} books.`,
      highlights,
      coins: user.coins
    });
  });
});

app.get('/', (req, res) => {
  res.send('Welcome to the Kindle Highlights API! If you see this, the server is up and running.');
});

app.get('/health-check', (req,res) => {
   console.log('Health check endpoint hit from', req.ip);
  res.status(200).json({ status: 'alive', isHealthy: true });
});

app.get('/coins', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId);
  console.log('Call to /coins endpoint by user:', userId);
  if (!user) return res.status(401).json({ message: 'User not found' });
  res.json({ coins: user.coins });
});

app.get('/version', (req, res) => {
  res.json({ version: process.env.VERSION || 'unknown' });
});

app.get('/user/books', authenticate, async (req, res) => {
  const books = await Book.find({ userId: req.user.userId }, 'title author');
  console.log('Fetched books for user:', req.user.userId);
  console.log('Books:', books);
  res.json({ books });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() =>  console.log('MongoDB connected!'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

app.listen(PORT, () =>  console.log(`Server running on port ${PORT}`));

// #todo
// check for missing dependencies and add them to package.json

// #todo
// add coins to User model and add a route to get coins for a user
// add coins consumption for highlight processing
// coins are a currency for features