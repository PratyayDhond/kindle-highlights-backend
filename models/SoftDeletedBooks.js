const mongoose = require('mongoose');

const SoftDeletedBooksSchema = new mongoose.Schema({
  originalBookId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Books', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { type: String, required: true },
  author: { type: String  , required: false, default: null }, // Author can be null for custom documents
  deletedHighlights: [{
    originalHighlightId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: true 
    },
    highlight: { type: String, required: true },
    type: { type: String, enum: ['highlight', 'note', 'bookmark'], required: true },
    page: { type: String, required: false, default: '' },
    location: { 
      start: { type: Number, required: true },
      end: { type: Number, required: true }
    },
    timestamp: { type: Date },
    knowledge_begin_date: { type: Date },
    knowledge_end_date: { type: Date },
    deletedAt: { type: Date, default: Date.now },
    deletedBy: { type: String, default: 'user' }, // 'user', 'system', 'admin'
    deletionReason: { type: String, default: 'user_deletion' }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for faster queries
SoftDeletedBooksSchema.index({ originalBookId: 1, userId: 1 });
SoftDeletedBooksSchema.index({ userId: 1 });

module.exports = mongoose.model('SoftDeletedBooks', SoftDeletedBooksSchema);