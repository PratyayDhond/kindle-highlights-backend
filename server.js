// File: server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'supersecret';

app.use(cors());
app.use(bodyParser.json());

const users = {}; // In-memory users store
const userHighlights = {}; // In-memory highlights store

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
app.post('/user-highlights', authenticate, (req, res) => {
  const { highlights } = req.body; // expect array of strings
  if (!Array.isArray(highlights)) return res.status(400).json({ message: 'Invalid highlights format' });
  userHighlights[req.user.username].push(...highlights);
  res.json({ message: 'Highlights saved' });
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
