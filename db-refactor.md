# Database Refactoring Plan

**Date:** January 17, 2026  
**Branch:** `feat/db-restructure`

---

## Problem Statement

### Current Schema
```
User (userId)
  └── Books (bookId, userId)
        └── highlights[] (embedded array)
```

### Issues with Current Approach
1. **Cannot do global search** for a user's quotes without fetching all books and all highlights (unnecessary bandwidth and API calls)
2. **Cannot randomly fetch N highlights** for newsletter without creating an entire copy of all user's highlights by fetching all books first
3. **Scaling disaster** — every operation requires loading entire book documents with all embedded highlights

---

## Decisions Made

### 1. Separate Highlights into Own Collection

**New Schema:**
```
User (userId)

Book (bookId, userId)

Highlight (highlightId, bookId, userId)
```

### 2. Keep `userId` in Both Books and Highlights

**Rationale:**
- Enables single-query operations for user-based highlight queries
- Avoids 2-query pattern (fetch bookIds → query highlights with `$in`)
- Better index utilization with compound indexes
- Read performance is critical for newsletter (sent to many users)
- Storage overhead (~12 bytes per highlight) is acceptable trade-off

### 3. Index Strategy

```javascript
// Highlights collection
{ bookId: 1, isActive: 1 }
{ userId: 1, isActive: 1 }

// Books collection  
{ userId: 1, isActive: 1 }
```

### 4. Replace Soft Delete Model with `isActive` Field

**Instead of:** Separate `SoftDeletedBooks` collection  
**Use:** `isActive` boolean field in both Book and Highlight schemas

**Benefits:**
- Simpler schema — no duplicate model definitions
- Atomic operations — no risk of partial failures during move
- Easy restore — just flip the boolean
- Single collection queries — can query active + deleted together if needed

**Additional audit fields:**
```javascript
isActive: { type: Boolean, default: true },
deletedAt: { type: Date, default: null },
deletedBy: { type: String, enum: ['user', 'system', 'admin'], default: null },
deletionReason: { type: String, default: null }
```

### 5. Cascade Soft-Delete for Orphan Prevention

When a book is deleted:
1. **First:** Soft-delete all child highlights (`deletionReason: 'cascade_from_book: ...'`)
2. **Then:** Soft-delete the book itself

When restoring a book:
1. Restore the book
2. Restore highlights that were cascade-deleted with that book

---

## New Schemas

### Book Schema (`models/Books.js`)
```javascript
const BookSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  title: String,
  author: String,
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, enum: ['user', 'system', 'admin'], default: null },
  deletionReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

BookSchema.index({ userId: 1, isActive: 1 });
```

### Highlight Schema (`models/Highlight.js`) — NEW
```javascript
const HighlightSchema = new mongoose.Schema({
  bookId: { type: ObjectId, ref: 'Book', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  highlight: { type: String, required: true },
  type: { type: String, enum: ['highlight', 'note', 'bookmark'], required: true },
  page: { type: String, default: '' },
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

HighlightSchema.index({ bookId: 1, isActive: 1 });
HighlightSchema.index({ userId: 1, isActive: 1 });
HighlightSchema.index({ highlight: 'text' }); // For full-text search
```

---

## Migration Steps

| Step | Action | Status |
|------|--------|--------|
| 1 | Create new `Highlight` model with `isActive` field | ✅ Done |
| 2 | Add `isActive` + audit fields to `Book` schema | ✅ Done |
| 3 | Remove `highlights[]` array from Book schema | ✅ Done |
| 4 | Write migration script to move `book.highlights[]` → `Highlight` collection | ✅ Done |
| 5 | Migrate `SoftDeletedBooks.deletedHighlights[]` → `Highlight` with `isActive: false` | ✅ Done |
| 6 | Migrate `SoftDeletedBooks` metadata → `Book` with `isActive: false` | ✅ Done |
| 7 | Update all queries to filter by `isActive: true` (or add Mongoose middleware) | ✅ Done |
| 8 | Delete `SoftDeletedBooks` model and drop collection | ⏳ After migration |

---

## Files Updated

### Models
- [x] `models/Books.js` — Removed highlights[], added isActive fields + middleware
- [x] `models/Highlight.js` — Created new model
- [ ] `models/SoftDeletedBooks.js` — Delete after running migration

### API Routes / Logic
- [x] `bookHighlights.js` — Updated to query Highlight collection
- [x] `server.js` — Updated saveHighlightsToUserProfile and CRUD operations
- [x] `utils/sendNewsletter.js` — Replaced nested loop with aggregation pipeline

### Utilities
- [x] `utils/softDelete.js` — Created cascade delete utilities

### Migration Scripts
- [x] `migrations/migrateHighlightsToCollection.js` — Migrates existing data
- [x] `migrations/cleanupOldHighlights.js` — Removes old embedded data

---

## Query Pattern Changes

### Before: Get random highlights for newsletter
```javascript
const books = await Books.find({ userId: user._id });
const highlights = [];
books.forEach(book => {
  book.highlights.forEach(h => highlights.push({...h, bookTitle: book.title}));
});
// Manual random selection from highlights array
```

### After: Get random highlights for newsletter
```javascript
const highlights = await Highlight.aggregate([
  { $match: { userId: user._id, isActive: true, type: { $ne: 'note' } } },
  { $sample: { size: 10 } },
  { $lookup: { from: 'books', localField: 'bookId', foreignField: '_id', as: 'book' } },
  { $unwind: '$book' },
  { $project: { highlight: 1, bookTitle: '$book.title', author: '$book.author', ... } }
]);
```

### Before: Get all highlights for a book
```javascript
const book = await Books.findById(bookId);
const highlights = book.highlights;
```

### After: Get all highlights for a book
```javascript
const highlights = await Highlight.find({ bookId, isActive: true });
```

### Before: Global search
```javascript
// Not possible without fetching everything
```

### After: Global search
```javascript
const results = await Highlight.find({
  userId,
  isActive: true,
  $text: { $search: searchTerm }
});
```

---

## Cascade Delete Implementation

```javascript
async function softDeleteBook(bookId, deletedBy = 'user', reason = 'user_deletion') {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const now = new Date();
    
    // Step 1: Soft-delete all highlights for this book
    await Highlight.updateMany(
      { bookId, isActive: true },
      { 
        isActive: false, 
        deletedAt: now, 
        deletedBy, 
        deletionReason: `cascade_from_book: ${reason}` 
      },
      { session }
    );
    
    // Step 2: Soft-delete the book
    await Book.updateOne(
      { _id: bookId, isActive: true },
      { 
        isActive: false, 
        deletedAt: now, 
        deletedBy, 
        deletionReason: reason 
      },
      { session }
    );
    
    await session.commitTransaction();
    return { success: true };
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

---

## Potential Issues to Watch

| Area | Risk | Mitigation |
|------|------|------------|
| Query discipline | Forgetting `isActive: true` filter | Add Mongoose pre-find middleware |
| API response format | Clients expecting `book.highlights[]` | Update frontend, or add adapter layer |
| Highlight IDs | Frontend may reference old `_id` format | Migration preserves original `_id` where possible |
| Transactions | MongoDB transactions require replica set | Ensure production DB supports transactions |
| Migration rollback | Partial migration state | Keep backup, test on staging first |

---

## How to Run Migration

### Step 1: Backup Database
```bash
# Using mongodump
mongodump --uri="your-mongodb-uri" --out=./backup-$(date +%Y%m%d)
```

### Step 2: Run Migration Script
```bash
cd kindle-highlights-backend
node migrations/migrateHighlightsToCollection.js
```

### Step 3: Verify Migration
```javascript
// In MongoDB shell or Compass
db.highlights.countDocuments()
db.highlights.find({ isActive: true }).limit(5)
db.highlights.find({ isActive: false }).limit(5)  // Soft-deleted
```

### Step 4: Deploy Updated Code
Deploy the updated backend with new models and routes.

### Step 5: Cleanup (After Verification)
```bash
node migrations/cleanupOldHighlights.js
```

### Step 6: Remove Old Model
Delete `models/SoftDeletedBooks.js` from codebase.
