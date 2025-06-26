const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  author: String,
  // highlights: [{
  //   highlight: String,
  //   type: String, // "highlight", "note", "bookmark"
  //   page: String,
  //   // location: { start: Number, end: Number },
  //   location: String,
  //   timestamp: String, // ISO date string,
  //   locStart: Number, // Start location in the book
  //   locEnd: Number // End location in the book
  // }],
  highlights: [{
    highlight: { type: String, required: true}, // Highlight text
    type: { type: String, enum: ['highlight', 'note', 'bookmark'], required: true },
    page: { type: String, required: false, default: '' }, // Page number as a string
    location: { 
      start: {type: Number, required: true}, // Start location in the book
      end: {type: Number, required: true} // End location in the book
    },
    timestamp: { type: Date }, // Store timestamp as a Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Books', BookSchema);

// This model represents a user's highlights in a book.
// It includes the book title, author, and an array of highlights with their details.
// Instead of storing all the books for a user in a single document, let's have multiple documents in the `highlights` collection.
// This allows for better scalability and easier querying of highlights by book or user.
// Also this will allow for fetching only a single book's highlights without loading all books for a user.
