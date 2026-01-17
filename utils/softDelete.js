const Book = require('../models/Books');
const Highlight = require('../models/Highlight');

/**
 * Soft delete a book and all its highlights (cascade delete)
 * @param {string} bookId - The ID of the book to delete
 * @param {string} deletedBy - Who deleted it: 'user', 'system', or 'admin'
 * @param {string} reason - The reason for deletion
 * @returns {Promise<{success: boolean, highlightsDeleted: number}>}
 */
async function softDeleteBook(bookId, deletedBy = 'user', reason = 'user_deletion') {
  const now = new Date();

  // Step 1: Soft-delete all highlights for this book
  const highlightResult = await Highlight.updateMany(
    { bookId, isActive: true },
    {
      isActive: false,
      deletedAt: now,
      deletedBy,
      deletionReason: `cascade_from_book: ${reason}`
    }
  );

  // Step 2: Soft-delete the book
  await Book.updateOne(
    { _id: bookId, isActive: true },
    {
      isActive: false,
      deletedAt: now,
      deletedBy,
      deletionReason: reason
    }
  );

  return { success: true, highlightsDeleted: highlightResult.modifiedCount };
}

/**
 * Restore a soft-deleted book and its cascade-deleted highlights
 * @param {string} bookId - The ID of the book to restore
 * @returns {Promise<{success: boolean, highlightsRestored: number}>}
 */
async function restoreBook(bookId) {
  // Restore the book
  await Book.updateOne(
    { _id: bookId, isActive: false },
    {
      isActive: true,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null
    }
  );

  // Restore highlights that were cascade-deleted with this book
  const highlightResult = await Highlight.updateMany(
    {
      bookId,
      isActive: false,
      deletionReason: { $regex: /^cascade_from_book/ }
    },
    {
      isActive: true,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null
    }
  );

  return { success: true, highlightsRestored: highlightResult.modifiedCount };
}

/**
 * Soft delete a single highlight
 * @param {string} highlightId - The ID of the highlight to delete
 * @param {string} deletedBy - Who deleted it: 'user', 'system', or 'admin'
 * @param {string} reason - The reason for deletion
 * @returns {Promise<{success: boolean}>}
 */
async function softDeleteHighlight(highlightId, deletedBy = 'user', reason = 'user_deletion') {
  await Highlight.updateOne(
    { _id: highlightId, isActive: true },
    {
      isActive: false,
      deletedAt: new Date(),
      deletedBy,
      deletionReason: reason
    }
  );
  return { success: true };
}

/**
 * Restore a soft-deleted highlight
 * @param {string} highlightId - The ID of the highlight to restore
 * @returns {Promise<{success: boolean}>}
 */
async function restoreHighlight(highlightId) {
  await Highlight.updateOne(
    { _id: highlightId, isActive: false },
    {
      isActive: true,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null
    }
  );
  return { success: true };
}

/**
 * Permanently delete soft-deleted items older than specified days
 * Use with caution - this is irreversible
 * @param {number} daysOld - Delete items soft-deleted more than this many days ago
 * @returns {Promise<{booksDeleted: number, highlightsDeleted: number}>}
 */
// BEWARE : USE WITH CAUTION
async function permanentlyDeleteOldSoftDeletes(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const bookResult = await Book.deleteMany({
    isActive: false,
    deletedAt: { $lt: cutoffDate }
  });

  const highlightResult = await Highlight.deleteMany({
    isActive: false,
    deletedAt: { $lt: cutoffDate }
  });

  return {
    booksDeleted: bookResult.deletedCount,
    highlightsDeleted: highlightResult.deletedCount
  };
}

module.exports = {
  softDeleteBook,
  restoreBook,
  softDeleteHighlight,
  restoreHighlight,
};
