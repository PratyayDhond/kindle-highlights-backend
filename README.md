# Kindle Highlights Formatter API

A Node.js + Express backend service that allows users to:

- Sign up and log in securely
- Upload Kindle `clippings.txt` highlights
- Download formatted highlights as a ZIP file

Built for integration with a frontend interface.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/kindle-highlights-backend.git
cd kindle-highlights-backend
```

### 2. Install Dependencies

```bash
npm install
```

---

## ▶️ Running the Server

Start the Express server on port 3000:

```bash
npm start
```

> By default, the server runs at: `http://localhost:3000`

---

## 🧪 Running Tests

This project uses [Mocha](https://mochajs.org/) and [Supertest](https://github.com/ladjs/supertest) for API testing.

### To run the test suite:

```bash
npm test
```

Make sure your `package.json` includes this in the `scripts` section:

```json
"scripts": {
  "start": "node server.js",
  "test": "mocha"
}
```

---

## 📦 API Endpoints

### 🔐 POST `/signup`
Registers a new user.

**Body:**
```json
{
  "username": "yourname",
  "password": "yourpassword"
}
```

---

### 🔐 POST `/login`
Authenticates user and returns a JWT token.

**Body:**
```json
{
  "username": "yourname",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "token": "your.jwt.token"
}
```

---

### 📥 POST `/user-highlights`
Uploads an array of highlights.

**Headers:**
```
Authorization: Bearer <JWT Token>
```

**Body:**
```json
{
  "highlights": ["Highlight 1", "Highlight 2"]
}
```

---

### 📤 GET `/formatted-highlights`
Returns a ZIP file containing formatted highlights.

**Headers:**
```
Authorization: Bearer <JWT Token>
```

**Response:**
Downloads `highlights.zip`

---

## 📁 Project Structure

```
├── server.js              # Main application file
├── test/
│   └── api.test.js        # Test cases using Mocha + Supertest
├── package.json
├── README.md
```

---

## 🛠 Technologies Used

- Node.js
- Express.js
- CORS
- bcrypt (password hashing)
- JWT (authentication)
- Archiver (for zip file creation)
- Mocha & Supertest (testing)

---

## 📌 Future Improvements

- Use a real database (MongoDB/PostgreSQL)
- Add user session management
- Add support for `.clippings.txt` parsing
- Deploy to cloud platforms (Railway, Render, etc.)

---

## 📃 License

MIT License
