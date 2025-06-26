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

**Current Version:** 1.2.0

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

### 1.2.0

- Fixed Static Free Signup coins (500 coins) being sent in welcome mail. Now fetching dynamic value from environment variable.
- Added Redundant Highlights removal via overlapping sub-intervals solution.

### 1.2.1

- Updated Rendundancy Removal algorithm to ignore notes, and include all notes in the highlights regardless of the overlap with the highlights for the loc field.
- Fixed Redundancy Removal removing note/highlight if only 1 present in the book. \[Weird Edge case bug I will say]

### 2.0.0
- Added Stats
- Updated Redundancy Removal 
    - to update stats by checking count for newly added books and highlights
    - to fix sort funciton overwriting existing data and causing data deletion and redundant data due to same location sorting
    - Removed novelty privilege from notes, now notes would be compared against each other.
- /auth/me returns user object from jwt token credential

### 2.0.1
- Added payment for downloading single pdf