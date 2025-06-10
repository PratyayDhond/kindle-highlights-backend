const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookTitle: String,
  author: String,
  highlights: [{
    highlight: String,
    type: String, // "highlight", "note", "bookmark"
    page: String,
    location: String,
    timestamp: Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Highlight', highlightSchema);