# Kindle Highlights Formatter API

A Node.js + Express backend service that allows users to:

## 🛠 Technologies Used

- Node.js
- Express.js
- CORS
- bcrypt (password hashing)
- JWT (authentication)
- Mocha & Supertest (testing)

---

## Current Implementations
- Added user session management
- Added support for `.clippings.txt` parsing
- Deployed to cloud platforms (Render)

## 📌 Future Improvements

- Use a real database (MongoDB/PostgreSQL)
- Add DRAG and DROP functionality for kindle-highlights file.

---

# Kindle Clippings Backend

## Version

**Current Version:** 1.1.0

## Changelog

### 1.0.0
- Initial release
- Google SSO and email/password authentication
- Email verification and welcome mail system
- JWT-based session management (7 days)
- CORS and secure cookie setup for cross-origin frontend

### 1.1.0
- Coin system for users
- File upload and highlight processing with coin deduction
- `/version` API to get backend version
