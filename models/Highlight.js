const mongoose = require('mongoose');

const HighlightSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  highlight: { type: String, required: true },
  type: { type: String, enum: ['highlight', 'note', 'bookmark'], required: true },
  page: { type: String, required: false, default: '' },
  location: {
    start: { type: Number, required: true },
    end: { type: Number, required: true }
  },
  timestamp: { type: Date },
  knowledge_begin_date: { type: Date, default: null },
  knowledge_end_date: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, enum: ['user', 'system', 'admin'], default: null },
  deletionReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient querying
HighlightSchema.index({ bookId: 1, isActive: 1 });
HighlightSchema.index({ userId: 1, isActive: 1 });
HighlightSchema.index({ highlight: 'text' }); // For full-text search

// Pre-find middleware to automatically filter out soft-deleted highlights
// Use .setOptions({ includeDeleted: true }) to include deleted items
HighlightSchema.pre(/^find/, function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isActive: { $ne: false } });
  }
  next();
});

module.exports = mongoose.model('Highlight', HighlightSchema);
