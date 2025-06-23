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
const {setProgress, deleteProgress, getProgress} = require('./progress.js');
const { router: authRoutes, authenticate } = require('./auth.js');
const User = require('./models/User'); // Adjust path as needed
const Book = require('./models/Books'); // Adjust path as needed
const purgeOverlappingHighlights = parseHighlights.purgeOverlappingHighlights; // Import the function to purge overlapping highlights

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

function compareHighlights(highlight1, highlight2) {
  return highlight1.highlight === highlight2.highlight &&
         highlight1.type === highlight2.type &&
         highlight1.page === highlight2.page &&
         highlight1.location.start === highlight2.location.start &&
         highlight1.location.end === highlight2.location.end;

  // if(!result) {
  //   console.log(highlight1)
  //   console.log(highlight2)
  // } else {
  //   // console.log('Highlights do not match:', highlight1.highlight, highlight2.highlight);
  // }

  // return result;
}

function checkForNewHighlights(highlights, existingHighlightsOnCloud) {
  if(highlights.length !== existingHighlightsOnCloud.length) 
    return true; 

  highlights.sort((a, b) => a.location.start - b.location.start);
  existingHighlightsOnCloud.sort((a, b) => a.location.start - b.location.start);

  // #todo iplement an algorithm to check whether the highlights uploaded are already present on cloud highlights or not.

  for( let i = 0; i < highlights.length; i++) {
    if(!compareHighlights(highlights[i], existingHighlightsOnCloud[i])) {
      return true;
    }
  } 

  return false;
}

async function saveHighlightsToUserProfile(highlights, userId) {
    const savePromises = [];

  for (const highlight of highlights) {

    let book = await Book.findOne({ userId, title: highlight.name, author: highlight.author });
    if (book) {
      let newHighlightsPresent = checkForNewHighlights(highlight.highlights, book.highlights);
      // console.log('new highlights present:', newHighlightsPresent, 'for book:', highlight.name, 'for user:', userId);

      if(newHighlightsPresent){
        let combinedHighlights = [...book.highlights, ...highlight.highlights];
        book.highlights = purgeOverlappingHighlights(combinedHighlights);
        console.log('Saving Changes for book:', highlight.name, 'for user:', userId);
        savePromises.push(book.save());
      }else{
        // console.log('No changes in highlights for book:', highlight.name, 'for user:', userId);
      }
      continue;
    }

    let bookHighlights = [];

    for(const h of highlight.highlights) {
        // I want to check if the book already exists for the user
        // If it does, I want to update the highlights for that book
        // If it doesn't, I want to create a new book with the highlights


        let temp = {
          highlight : String(h.highlight).trim(), // Ensure highlight is a string
          type : String(h.type).trim(), // "highlight", "note", "bookmark"
          page : String(h.page).trim(), // Ensure page is a string
          location : { start: Number(h.location.start), end: Number(h.location.end) }, // Store location
          timestamp : String(h.timestamp).trim() // Ensure timestamp is a string
        }

        if(temp.highlight === '') { // this handles deleted notes and highlights as well as bookmarks.
          continue;
        }
        bookHighlights.push(temp);
        // bookHighlights.push({highlight: String(h.highlight).trim(), type: String(h.type).trim(), timestamp: String(h.timestamp).trim()});
      }
      // Create a new book entry if it doesn't exist
      book = new Book({
        userId,
        title: highlight.name,
        author: highlight.author,
        highlights: bookHighlights, // Store the highlights array
        // highlights: highlight.highlights // Spread operator to add highlights
      });

    savePromises.push(book.save());
  }
  await Promise.all(savePromises);
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
    if(highlights.status === 'error') {

      return res.status(highlights.statusCode).json({ message: highlights.message });
    }
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
  console.log('Total books found:', books.length);
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
// Uploaded File validation

// #todo
// Implement api calls for accessing user data on frontend
// Display user data on the frontend
// Add search bar on frontend to search for books
// Implement pagination for books and highlights on frontend
