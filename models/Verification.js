const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Verification', verificationSchema);

// #todo
// IS this model needed?
// It is not used in the current codebase, but it might be useful for future email verification features.
// If you plan to implement email verification, this model can be used to store verification tokens
// and their expiration times. If not, you can safely remove it.