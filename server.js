// File: server.js

require('dotenv').config();

const {startCronJob} = require('./cron'); // Import the cron job to keep the server alive
startCronJob(); // Start the cron job when the server starts

const {startNewsletterJob} = require('./cron'); // Import the cron job to send newsletters
startNewsletterJob(); // Start the newsletter cron job when the server starts

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); // npm install uuid
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit'); // Import express-rate-limit

const app = express();
const PORT = process.env.PORT || 3000;
// const SECRET = 'supersecret';
const kindleExtensionParser = require('./parseHighlights/parseKindleExtensionHighlights.js'); // Import the highlight parsing function for Kindle Extension
const parseHighlightsForKindleExtension = kindleExtensionParser.parseHighlights;
const parseHighlights = require('./parseHighlights/parseHighlights.js'); // Import the highlight parsing function
const {setProgress, deleteProgress, getProgress} = require('./progress.js');
const { router: authRoutes, authenticate } = require('./auth.js');
const {router: newsletterRoutes} = require('./newsletter.js'); // Import the newsletter routes
const bookHighlightsRouter = require('./bookHighlights'); // Import the book highlights router
const User = require('./models/User'); // Adjust path as needed
const Book = require('./models/Books'); // Adjust path as needed
const UserStats = require('./models/UserStats'); // Adjust path as needed
const purgeOverlappingHighlightsForKindleExtension = kindleExtensionParser.purgeOverlappingHighlights;
const purgeOverlappingHighlights = parseHighlights.purgeOverlappingHighlights; // Import the function to purge overlapping highlights

const FRONTEND_URL = process.env.FRONTEND_URL; // Default to localhost if not set
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://192.168.1.34:8080', // Replace with your local IP if needed
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
app.use(newsletterRoutes);
app.use(bookHighlightsRouter);
const upload = multer({ dest: 'uploads/' }); // Uploaded files will go here

const KINDLE_FEE_MULTIPLIER = process.env.KINDLE_FEE_MULTIPLIER || 0; // Default to 1 if not set
const PROCESSING_FEE_PER_BOOK = process.env.PROCESSING_FEE_PER_BOOK || 1; // Set your fee
const DOWNLOAD_FEE_FOR_HIGHLIGHTS = process.env.DOWNLOAD_FEE_FOR_HIGHLIGHTS || 1; // Default to 1 if not set
const DOWNLOAD_FEE_FOR_SINGLE_BOOK = process.env.DOWNLOAD_FEE_FOR_SINGLE_BOOK || 3; // Default to 3 if not set
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
  let result = 
    (highlight1.highlight.trim() || '') === (highlight2.highlight.trim() || '') &&
    (highlight1.type.trim() || '') === (highlight2.type.trim() || '') &&
    (highlight1.page.trim() || '') === (highlight2.page.trim() || '') &&
    highlight1.location &&
    highlight2.location &&
    Number(highlight1.location.start) === Number(highlight2.location.start) &&
    Number(highlight1.location.end) === Number(highlight2.location.end)
  
    if(result === true)
      return result;

    // since it is not a match, we check if the new highlight was taken later in time.
    // we are here indicates that location is same, type and page are also same.
    if(highlight1.timestamp && highlight2.timestamp) {
      return new Date(highlight1.timestamp) > new Date(highlight2.timestamp);
    }

    return result;

}

function checkForNewHighlights(highlights, existingHighlightsOnCloud) {
  // If there are more highlights locally than on the cloud, there must be new ones
  if (highlights.length > existingHighlightsOnCloud.length) return true;

  // Sort both arrays for consistent comparison
  highlights.sort((a, b) => a.location.start - b.location.start);
  existingHighlightsOnCloud.sort((a, b) => a.location.start - b.location.start);

  // For each local highlight, check if it exists in the cloud highlights
  for (let i = 0; i < highlights.length; i++) {
    const found = existingHighlightsOnCloud.some(cloudHighlight =>
      compareHighlights(highlights[i], cloudHighlight)
    );
    if (!found) {
      // If any local highlight is not found in the cloud, return true (new highlight present)
        return true;
    }
  }

  // All local highlights are present in the cloud (cloud may have more)
  return false;
}

function checkForNewHighlightsForKindleUpload(highlights, existingHighlightsOnCloud) {
// Assume cloud highlights have already been purged of redundandant highlights, they are therefore on cloud
  for(highlight of highlights) {
    for(cloudHighlight of existingHighlightsOnCloud) {
      if(highlight.highlight === cloudHighlight.highlight) {
        // if highlight is already in cloud, current is redundant
        highlight.isActive = false;
        break;
      }
    }
    // I want to check if highlights has the isActive property, and if it is set to false
    if( highlight.isActive !== false) {
      highlight.isActive = true;
    } 
  }

  // I want to save newHighlights as the highlights with isActive true, but without the isActive field

  let newHighlights = [];
  for(highlight of highlights) {
    if(highlight.isActive === true) {
      delete highlight.isActive;
      newHighlights.push(highlight);
    }
  }
  return newHighlights;
}

async function saveHighlightsToUserProfile(highlights, userId, isKindleUpload = false) {
    const savePromises = [];
    let newHighlights = 0;
    let newBook = 0;
  // We can have better naming i.e. books here 
  // right now highlights is an array of books with highlights inside them.
  // confusing mate.
  for (const highlight of highlights) {

    let book = await Book.findOne({ userId, title: highlight.name, author: highlight.author });
    if (book) {
      let newHighlightsPresent = [];
      if(isKindleUpload) {
        newHighlightsPresent = checkForNewHighlightsForKindleUpload(highlight.highlights, book.highlights);
      }else{
        newHighlightsPresent = checkForNewHighlights(highlight.highlights, book.highlights);

      }

      if(newHighlightsPresent){
        let oldHighlightsCount = book.highlights.length;
        
        let combinedHighlights = [...book.highlights, ...highlight.highlights];
        book.highlights = purgeOverlappingHighlights(combinedHighlights);
        
        newHighlights += book.highlights.length - oldHighlightsCount;
        // console.log('Saving Changes for book:', highlight.name, 'for user:', userId);
        savePromises.push(book.save());
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

        // if(temp.type === 'note')
        //   console.log('Note found:', temp.highlight, 'at', temp.location.start, 'for book:', highlight.name);

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
      newBook += 1;
      newHighlights += bookHighlights.length;
      // #todo
      // figure out why new highlights increase for the same file being reuploaded.
    savePromises.push(book.save());
  }
  await Promise.all(savePromises);
  return [newBook, newHighlights > 0 ? newHighlights : 0];
}

async function updateUserStats(newBook, newHighlights, newMaxHighlights, fallbackStats, userId) {
  try {
    let stats = await UserStats.findOne({ userId });
    
    if(stats){
      stats.totalBooks += Number(newBook || 0);
      stats.totalHighlights += Number(newHighlights || 0);
      stats.avgHighlights = Number((stats.totalHighlights / (stats.totalBooks || 1)).toFixed(2));
      stats.maxHighlights = Number(newMaxHighlights > stats.maxHighlights ? newMaxHighlights : stats.maxHighlights);
      stats.updatedAt = new Date();
      await stats.save();
      return stats;
    }
  
    if(!stats){
      stats = fallbackStats;
    }

    stats = await UserStats.create({
      userId,
      totalBooks: Number(stats.totalBooks) || 0,
      totalHighlights: Number(stats.totalHighlights) || 0,
      avgHighlights: Number(stats.avgHighlights.toFixed(2)) || 0,
      maxHighlights: Number(stats.maxHighlights) || 0,
      updatedAt: new Date()
    });
    console.log('User stats updated:', stats);
    return stats;
  } catch (err) {
    console.error('Error updating user stats:', err);
    return null;
  }
} 

app.post('/get-user-highlights-json', authenticate, upload.single('file'), async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ message: 'User not found' });

  const file = req.file;
  let stats = null;
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

    const highlightsData = parseHighlights.parseHighlights(data);
    const highlights = highlightsData.highlights;
    if(highlightsData.status === 'error') {
      return res.status(highlightsData.statusCode).json({ message: highlightsData.message });
    }
    // console.log(highlights);
    console.log(highlights.length, 'highlights found');
    const uniqueBooks = highlights.length;
    const totalFee = uniqueBooks * PROCESSING_FEE_PER_BOOK * DOWNLOAD_FEE_FOR_HIGHLIGHTS;
    console.log("Total fee for processing:", totalFee, "for", uniqueBooks, "books");
    if (user.coins < totalFee) {
      return res.status(402).json({ message: `Not enough coins. You need ${totalFee} coins for ${uniqueBooks} books.` });
    }

    // WHY IS getHighlights Saving Highlight!? REFACTOR TO DO THIS SEPARATELY
    if(consent === 'true') {
      // Save Books for user's profile
      let [newBook, newHighlights] = await saveHighlightsToUserProfile(highlights, userId);
      let maxHighlights = Math.max(...highlights.map(book => book.highlights.length));

      stats = await updateUserStats(newBook, newHighlights,maxHighlights, data.stats, userId);
      if(stats && stats.updatedAt)
        user.updatedAt = stats.updatedAt; // Update user's last updated time
    }

    user.coins -= totalFee;
    await user.save();
    return res.json({ 
      message: `Highlights processed successfully. Charged ${totalFee} coins for ${uniqueBooks} books.`,
      highlights,
      coins: user.coins,
      stats: stats
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

app.get('/user/book/:bookId', authenticate, async (req, res) => {
  const bookId = req.params.bookId;
  const userId = req.user.userId;
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ message: 'User not found' });
  if(user.coins < DOWNLOAD_FEE_FOR_SINGLE_BOOK) {
    return res.status(402).json({ message: `Not enough coins. You need ${DOWNLOAD_FEE_FOR_SINGLE_BOOK} coins to download this book.` });
  }

  const book = await Book.findOne({ userId, _id: bookId }, 'title author highlights');
  if (!book) {
    return res.status(404).json({ message: 'Book not found' });
  }
  // console.log(book)
  user.coins -= DOWNLOAD_FEE_FOR_SINGLE_BOOK;
  await user.save();
  res.json({ book, coins: user.coins });
});

app.post('/user/upload-highlights-file', authenticate, upload.single('file'), async (req, res) => {
  const userId = req.user.userId;
  const file = req.file;
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ message: 'User not found' });

  if (!file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = path.join(__dirname, file.path);

  fs.readFile(filePath, 'utf8', async (err, data) => {
    // Always delete the uploaded file
    fs.unlink(filePath, () => {});

    if (err) {
      return res.status(500).json({ message: 'Error reading file' });
    }

    const highlightsData = parseHighlights.parseHighlights(data);
    const highlights = highlightsData.highlights;
    if (highlightsData.status === 'error') {
      return res.status(highlightsData.statusCode).json({ message: highlightsData.message });
    }
    console.log(highlights.length, 'highlights found');
    const uniqueBooks = highlights.length;
    const totalFee = uniqueBooks * PROCESSING_FEE_PER_BOOK;
    console.log("Total fee for processing:", totalFee, "for", uniqueBooks, "books");
    if (user.coins < totalFee) {
      return res.status(402).json({ message: `Not enough coins. You need ${totalFee} coins for ${uniqueBooks} books.` });
    }



    // Save Highlights for user's profile
    let [newBook, newHighlights] = await saveHighlightsToUserProfile(highlights, userId);
    let maxHighlights = Math.max(...highlights.map(book => book.highlights.length));
    stats = await updateUserStats(newBook, newHighlights,maxHighlights, highlightsData.stats, userId);
    if(stats && stats.updatedAt)
      user.updatedAt = stats.updatedAt; // Update user's last updated time

    user.coins -= totalFee;
    await user.save();

    return res.json({
      message: 'Highlights uploaded successfully',
      highlights,
      success: true,
      coins: user.coins,
      stats: stats
     });
  });
});

app.get('/user/stats', authenticate, async (req, res) => {
  let stats = await UserStats.findOne({ userId: req.user.userId });
  console.log(stats)
  if (!stats) {
    stats = new UserStats({
      userId: req.user.userId,
      totalBooks: 0,
      totalHighlights: 0,
      avgHighlights: 0,
      medianHighlights: 0,
      maxHighlights: 0,
      updatedAt: new Date()
    });
    await stats.save();
  }
  res.json({ stats });
});

// Generate secret key for authenticated user
app.post('/user/generate-kindle-secret', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Generate a secure random secret key
    const secretKey = crypto.randomBytes(32).toString('hex');
    
    user.kindleSecretKey = secretKey;
    user.kindleSecretKeyCreatedAt = new Date();
    await user.save();

    res.json({ 
      message: 'Secret key generated successfully',
      secretKey: secretKey,
      userId: userId
    });

  } catch (error) {
    console.error('Error generating secret key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get existing secret key for authenticated user
app.get('/user/kindle-secret', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.kindleSecretKey) {
      return res.status(404).json({ message: 'No secret key found. Generate one first.' });
    }

    res.json({ 
      secretKey: user.kindleSecretKey,
      createdAt: user.kindleSecretKeyCreatedAt,
      lastUsed: user.kindleSecretKeyLastUsed
    });

  } catch (error) {
    console.error('Error fetching secret key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Revoke secret key for authenticated user
app.delete('/user/kindle-secret', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    user.kindleSecretKey = null;
    user.kindleSecretKeyCreatedAt = null;
    user.kindleSecretKeyLastUsed = null;
    await user.save();

    res.json({ message: 'Secret key revoked successfully' });

  } catch (error) {
    console.error('Error revoking secret key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() =>  console.log('MongoDB connected!'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

app.listen(PORT, () =>  console.log(`Server running on port ${PORT}`));

// Create a custom rate limiter for Kindle endpoints
const kindleRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests from this IP for Kindle endpoints. Please try again in 10 minutes.',
    retryAfter: '10 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Only apply to Kindle endpoints
  skip: (req) => !req.path.startsWith('/kindle/'),
});

// Custom CORS middleware specifically for Kindle endpoints
const kindleCors = (req, res, next) => {
  if (req.path.startsWith('/kindle/')) {
    // Allow requests from any origin for Kindle endpoints
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
};

// Apply the custom CORS middleware before your existing CORS
app.use(kindleCors);

// Apply rate limiting to all Kindle endpoints
app.use('/kindle', kindleRateLimit);

// #todo
// Uploaded File validation

// #todo
// Implement api calls for accessing user data on frontend
// Display user data on the frontend
// Add search bar on frontend to search for books
// Implement pagination for books and highlights on frontend

// #todo 
// write an api call for uploading a new kindle clippings file and updating the user's profile with the new highlights.without generating highlights zip.

// #todo
// redundancy removal not working for locations with start = 2000 and no end i.e. end = -1, so when there is single start, we still have to check for the overlap.

// #todo
// #for stats : When checking for unique quotes, lets just do a n*n instead of trying to save time using overlapping interval, it isn't saving much since we are sorting anyways.


// #todo
// Write a blog on sort, how sort can end up duplicating and destroying values and how it caused a mess for kindle-clippings

const Books = require('./models/Books');

async function migrateHighlightKnowledgeDates() {
  try {
    console.log('Starting knowledge dates migration for highlights...');
    
    const books = await Books.find({ highlights: { $exists: true, $ne: [] } });
    let totalUpdated = 0;

    for (const book of books) {
      let modified = false;
      
      for (let i = 0; i < book.highlights.length; i++) {
        const highlight = book.highlights[i];
        if (!highlight.knowledge_begin_date) {
          // Use set() to explicitly set the field
          book.highlights[i].set('knowledge_begin_date', highlight.timestamp || new Date());
          book.highlights[i].set('knowledge_end_date', null);
          totalUpdated++;
          modified = true;
        }
      }

      if (modified) {
        book.markModified('highlights');
        await book.save();
      }
    }

    console.log(`Migration completed! Updated ${totalUpdated} highlights across ${books.length} books`);
    return { success: true, totalUpdated, booksProcessed: books.length };
    
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error: error.message };
  }
}

// Add API endpoint to trigger migration (optional)
app.post('/admin/migrate-highlight-knowledge-dates', async (req, res) => {
  const result = await migrateHighlightKnowledgeDates();
  if (result.success) {
    res.json({ 
      message: 'Migration completed successfully', 
      totalUpdated: result.totalUpdated,
      booksProcessed: result.booksProcessed
    });
  } else {
    res.status(500).json({ message: 'Migration failed', error: result.error });
  }
});

// Uncomment this line to run migration on server start (ONE TIME ONLY)
// migrateHighlightKnowledgeDates();



// // Run following command once on deployment to sanitize user highlights to follow updated bitemporal schema
// fetch('http://localhost:3000/admin/migrate-highlight-knowledge-dates', {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json'
//   }
// })
// .then(response => response.json())
// .then(data => console.log('Migration result:', data))
// .catch(error => console.error('Error:', error));


// Ensure when running the command to replace the fetch url with backend url not frontend kindle-clippings.pages.dev
// fetch('https://kindle-highlights-backend.onrender.com/admin/migrate-highlight-knowledge-dates', {
//   method: 'POST',  // Make sure this is POST, not GET
//   headers: {
//     'Content-Type': 'application/json'
//   }
// })
// .then(response => {
//   console.log('Status:', response.status);
//   return response.json();
// })
// .then(data => console.log('Migration result:', data))
// .catch(error => console.error('Error:', error));

const uploadKindle = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    // Only accept .txt files
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'), false);
    }
  }
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'userId', maxCount: 1 },
  { name: 'secretKey', maxCount: 1 }
]);

// New API endpoint for Kindle direct upload
// Currently setting the cost of Direct uploads via Kindle to 0 coins.
// This may be changed in future to a nominal fee if required.
app.post('/kindle/upload-clippings', uploadKindle, async (req, res) => {
  try {
    const { secretKey, userId } = req.body;
    const file = req.files?.file?.[0]; // File is in files.file array

    console.log('Kindle upload attempt - UserId:', userId, 'SecretKey present:', secretKey !== null);

    // Validate required fields
    if (!secretKey || !userId) {
      return res.status(400).json({ 
        message: 'Secret key and user ID are required',
        required: ['secretKey', 'userId']
      });
    }

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Validate user and secret key
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid user ID' });
    }

    if (!user.kindleSecretKey || user.kindleSecretKey !== secretKey) {
      return res.status(401).json({ message: 'Invalid secret key' });
    }

    // Update last used timestamp
    user.kindleSecretKeyLastUsed = new Date();
    await user.save();

    const filePath = path.join(__dirname, file.path);

    fs.readFile(filePath, 'utf8', async (err, data) => {
      // Always delete the uploaded file
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });

      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).json({ message: 'Error reading uploaded file' });
      }

      try {
        // Parse highlights
        const highlightsData = parseHighlightsForKindleExtension(data);
        const highlights = highlightsData.highlights;
        
        if (highlightsData.status === 'error') {
          return res.status(highlightsData.statusCode).json({ 
            message: highlightsData.message 
          });
        }

        console.log(`Kindle upload: ${highlights.length} books found`);
        
        // Calculate processing fee

        const uniqueBooks = highlights.length;
        const totalFee = uniqueBooks * PROCESSING_FEE_PER_BOOK * KINDLE_FEE_MULTIPLIER;

        console.log(`Kindle upload: Total fee ${totalFee} for ${uniqueBooks} books (Kindle Upload Discount Applied).`);
        
        if (user.coins < totalFee) {
          return res.status(402).json({ 
            message: `Insufficient coins. Need ${totalFee} coins for ${uniqueBooks} books. Current balance: ${user.coins}`,
            required: totalFee,
            current: user.coins,
            shortfall: totalFee - user.coins
          });
        }

        const IS_KINDLE_UPLOAD = true;

        // Save highlights to user profile
        const [newBooks, newHighlights] = await saveHighlightsToUserProfile(highlights, userId, IS_KINDLE_UPLOAD);
        const maxHighlights = Math.max(...highlights.map(book => book.highlights.length));
        
        // Update user stats
        const stats = await updateUserStats(newBooks, newHighlights, maxHighlights, highlightsData.stats, userId);
        
        if (stats && stats.updatedAt) {
          user.updatedAt = stats.updatedAt;
        }

        // Charge user
        user.coins -= totalFee;
        await user.save();

        console.log(`Kindle upload successful for user ${userId}: ${newBooks} new books, ${newHighlights} new highlights`);

        return res.json({
          success: true,
          message: `Upload successful! Processed ${uniqueBooks} books. Charged ${totalFee} coins.`,
          summary: {
            totalBooks: uniqueBooks,
            newBooks: newBooks,
            newHighlights: newHighlights,
            coinsCharged: totalFee,
            remainingCoins: user.coins
          },
          stats: stats
        });

      } catch (processingError) {
        console.error('Error processing highlights:', processingError);
        return res.status(500).json({ 
          message: 'Error processing highlights file',
          error: processingError.message 
        });
      }
    });

  } catch (error) {
    console.error('Kindle upload error:', error);
    res.status(500).json({ 
      message: 'Internal server error during upload',
      error: error.message 
    });
  }
});

// Health check endpoint specifically for Kindle
app.get('/kindle/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'kindle-upload',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify secret key without uploading
app.post('/kindle/verify-auth', async (req, res) => {
  try {
    const { secretKey, userId } = req.body;

    if (!secretKey || !userId) {
      return res.status(400).json({ message: 'Secret key and user ID required' });
    }

    const user = await User.findById(userId);
    if (!user || !user.kindleSecretKey || user.kindleSecretKey !== secretKey) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ 
      message: 'Authentication successful',
      user: {
        email: user.email,
        coins: user.coins,
        secretKeyCreated: user.kindleSecretKeyCreatedAt
      }
    });

  } catch (error) {
    console.error('Kindle auth verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

setInterval(() => {
    const memory = process.memoryUsage();
    const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
    
    if (memoryMB > 500) { // Alert if using more than 500MB
        console.warn('🚨 High memory usage:', memoryMB, 'MB');
        
        if (global.gc) {
            console.log('🧹 Running garbage collection...');
            global.gc();
        }
    }
}, 30000); // Check every 30 seconds

// Handle memory pressure
process.on('warning', (warning) => {
    if (warning.name === 'MemoryUsage') {
        console.error('🚨 Memory warning:', warning.message);
    }
});