const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  googleId: { type: String, default: null }, // For Google SSO users
  passwordHash: { type: String, default: null }, // For email/password users
  verified: { type: Boolean, default: false }, // Email verified
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);