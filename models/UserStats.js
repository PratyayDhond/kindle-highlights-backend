const mongoose = require('mongoose');

const UserStatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  totalBooks: { type: Number, default: 0 },
  totalHighlights: { type: Number, default: 0 },
  avgHighlights: { type: Number, default: 0 },
//   medianHighlights: { type: Number, default: 0 },
  maxHighlights: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserStats', UserStatsSchema);