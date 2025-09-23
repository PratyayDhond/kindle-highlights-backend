const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  googleId: { type: String, default: null }, // For Google SSO users
  coins: {type: Number, default: 0}, // User's coins balance
  passwordHash: { type: String, default: null }, // For email/password users
  verified: { type: Boolean, default: false }, // Email verified
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  verificationToken: { type: String, default: undefined }, // undefined as undefined tokens are ignored during javascript serialisation
  optForNewsletter: { type: Boolean, default: false }, // User opted in for newsletter
  lastNewsletterSent: { type: Date, default: null }, // Last time the newsletter was sent
  kindleSecretKey: { 
    type: String, 
    unique: true, 
    sparse: true // Allow null values but ensure uniqueness when present
  },
  kindleSecretKeyCreatedAt: { type: Date },
  kindleSecretKeyLastUsed: { type: Date },
});

module.exports = mongoose.model('User', userSchema);