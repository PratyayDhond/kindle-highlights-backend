// File: server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'supersecret';
const parseHighlights = require('./parseHighlights.js'); // Import the highlight parsing function
const getHighlightsZip = require('./getHighlightsZip.js'); // Import the function to create zip from highlights
app.use(cors());
app.use(bodyParser.json());

const users = {}; // In-memory users store
const userHighlights = {}; // In-memory highlights store
const upload = multer({ dest: 'uploads/' }); // Uploaded files will go here

// Signup
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(400).json({ message: 'User already exists' });
  const hashed = await bcrypt.hash(password, 10);
  users[username] = { username, password: hashed };
  userHighlights[username] = [];
  res.status(201).json({ message: 'Signup successful' });
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ username }, SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Middleware to verify JWT
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token provided' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// POST /user-highlights
// app.post('/user-highlights', authenticate, (req, res) => {
// enable above post with authentication for deployment  version with login/signup

// write a function to parse the  highlights from the uploaded file


app.post('/user-highlights', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  const filePath = path.join(__dirname, file.path);
  console.log(file)
  console.log('File uploaded:', filePath);
  console.log('File name:', file.originalname);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading uploaded file:', err);
      return res.status(500).json({ message: 'Error reading file' });
    }

    const highlights = parseHighlights.parseHighlights(data); // Call the parsing function
    fs.unlink(filePath, () => {});
    
    highlightsZip = getHighlightsZip(highlights);

    res.json({ message: 'Highlights received and parsed', highlights: highlights });
  });
});


// GET /formatted-highlights
app.get('/formatted-highlights', authenticate, (req, res) => {
  const highlights = userHighlights[req.user.username] || [];
  const formatted = highlights.map((h, i) => `${i + 1}. ${h}`).join('\n');
  const filePath = path.join(__dirname, `${req.user.username}-highlights.zip`);
  fs.writeFileSync(path.join(__dirname, `${req.user.username}.txt`), formatted);
  const archiver = require('archiver');
  const output = fs.createWriteStream(filePath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  archive.file(path.join(__dirname, `${req.user.username}.txt`), { name: 'highlights.txt' });
  archive.finalize();
  output.on('close', () => {
    res.download(filePath, 'highlights.zip', () => {
      fs.unlinkSync(path.join(__dirname, `${req.user.username}.txt`));
      fs.unlinkSync(filePath);
    });
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
