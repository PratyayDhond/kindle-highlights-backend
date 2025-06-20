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

app.post('/get-user-highlights-json', authenticate, upload.single('file'), async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ message: 'User not found' });

  const file = req.file;
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