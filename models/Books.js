const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  author: String,
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, enum: ['user', 'system', 'admin'], default: null },
  deletionReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient querying
BookSchema.index({ userId: 1, isActive: 1 });

// Pre-find middleware to automatically filter out soft-deleted books
// Use .setOptions({ includeDeleted: true }) to include deleted items
BookSchema.pre(/^find/, function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isActive: { $ne: false } });
  }
  next();
});

module.exports = mongoose.model('Books', BookSchema);

// Highlights are now stored in a separate collection (see models/Highlight.js)
// This allows for:
// - Efficient random sampling for newsletters
// - Global search across all user highlights
// - Better scalability and pagination
// - Independent soft-delete of individual highlights
