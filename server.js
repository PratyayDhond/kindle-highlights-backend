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
const authRoutes = require('./auth.js');

const FRONTEND_URL = 'https://kindle-clippings.pages.dev'; // Default to localhost if not set
console.log('Frontend URL:', FRONTEND_URL);
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

// CORS middleware should be first!
app.use(cors({
  origin: function(origin, callback){
    console.log('CORS request from origin:', origin);
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


app.post('/user-highlights', upload.single('file'), async (req, res) => {
  const jobId = uuidv4();
  setProgress(jobId, 0); // Initialize progress for this job
  res.json({ jobId }); // Immediately respond with jobId

  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  const filePath = path.join(__dirname, file.path);
  fs.readFile(filePath, 'utf8', async (err, data) => {
    if (err) {
      console.error('Error reading uploaded file:', err);
      return res.status(500).json({ message: 'Error reading file' });
    }

    const highlights = parseHighlights.parseHighlights(data); // Call the parsing function
    fs.unlink(filePath, () => {});
    await getHighlightsZip(highlights, jobId);
    setProgress(jobId, 100); 
  });
});

app.post('/get-user-highlights-json', upload.single('file'), (req, res) => {
  const file = req.file;
   console.log('Inside get-user-highlights-json');
   console.log('File:', file);
   console.log('File path:', file.path);
   console.log('File originalname:', file.originalname);
  if (!file) return res.status(400).json({ message: 'No file uploaded' });
  const filePath = path.join(__dirname, file.path);
   console.log('File uploaded:', filePath);
  var highlights = []
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading uploaded file:', err);
      return res.status(500).json({ message: 'Error reading file' });
    }
    highlights = parseHighlights.parseHighlights(data); // Call the parsing function
     fs.unlink(filePath, () => {});
  //  console.log('Highlights:', highlights);
  return res.json({ message: 'Highlights processed successfully', highlights: highlights });
  });
  
});

app.get('/download-highlights/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const highlightsZipPath = `./${jobId}.zip`; // Assuming the zip is named with jobId
   console.log("Inside download-highlights");
   console.log("Highlights zip path:", highlightsZipPath);
  if (fs.existsSync(highlightsZipPath)) {
     console.log("Inside if condition of download-highlights");
    res.download(highlightsZipPath, `${jobId}.zip`, (err) => {
      if (err) {
        console.error('Error sending zip:', err);
        res.status(500).json({ message: 'Error sending zip file' });
      }
      // Optionally, delete the zip after sending
      fs.unlink(highlightsZipPath, () => {});
    });
  } else {
    res.status(404).json({ message: 'Highlights not found' });
  }
});

app.get('/', (req, res) => {
  res.send('Welcome to the Kindle Highlights API! If you see this, the server is up and running.');
});

app.get('/health-check', (req,res) => {
   console.log('Health check endpoint hit from', req.ip);
  res.status(200).json({ status: 'alive', isHealthy: true });
});

// Progress endpoint
app.get('/progress/:jobId', (req, res) => {
  const allowedOrigins = [
    FRONTEND_URL,
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // res.setHeader('Access-Control-Allow-Credentials', 'true'); // Uncomment if needed

  const jobId = req.params.jobId;
  const interval = setInterval(() => {
    const progress = getProgress(jobId);
    res.write(`data: ${progress}\n\n`);
    if (progress >= 100) {
      clearInterval(interval);
      res.end();
      deleteProgress(jobId);
    }
  }, 500);
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