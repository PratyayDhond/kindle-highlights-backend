const express = require('express');
const router = express.Router();
const Books = require('./models/Books');
const Highlight = require('./models/Highlight');
const { softDeleteHighlight } = require('./utils/softDelete');
const { authenticate } = require('./auth');
const mongoose = require('mongoose');

/**
 * Search quotes/highlights for a user
 * GET /user/highlights/search?q=searchQuery&limit=20&offset=0
 * 
 * Supports:
 * - Full-text search with relevancy scoring
 * - Fuzzy matching via regex fallback
 * - Pagination with limit/offset
 */
router.get('/user/highlights/search', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { q: searchQuery, limit = 20, offset = 0 } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // 1-100
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    // First, try MongoDB text search (uses the text index, sorted by relevancy)
    let highlights = await Highlight.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isActive: { $ne: false },
          $text: { $search: searchQuery }
        }
      },
      {
        // Add text score for relevancy sorting
        $addFields: { score: { $meta: 'textScore' } }
      },
      {
        // Sort by relevancy (highest score first)
        $sort: { score: -1 }
      },
      {
        $skip: offsetNum
      },
      {
        $limit: limitNum
      },
      {
        // Lookup book details
        $lookup: {
          from: 'books',
          localField: 'bookId',
          foreignField: '_id',
          as: 'book'
        }
      },
      {
        $unwind: { path: '$book', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 1,
          highlight: 1,
          type: 1,
          page: 1,
          location: 1,
          timestamp: 1,
          score: 1,
          bookId: 1,
          bookTitle: '$book.title',
          bookAuthor: '$book.author'
        }
      }
    ]);

    // If text search returns no results, fall back to regex (fuzzy) search
    if (highlights.length === 0) {
      // Escape special regex characters and create case-insensitive pattern
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      highlights = await Highlight.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            isActive: { $ne: false },
            highlight: { $regex: escapedQuery, $options: 'i' }
          }
        },
        {
          $skip: offsetNum
        },
        {
          $limit: limitNum
        },
        {
          $lookup: {
            from: 'books',
            localField: 'bookId',
            foreignField: '_id',
            as: 'book'
          }
        },
        {
          $unwind: { path: '$book', preserveNullAndEmptyArrays: true }
        },
        {
          $project: {
            _id: 1,
            highlight: 1,
            type: 1,
            page: 1,
            location: 1,
            timestamp: 1,
            bookId: 1,
            bookTitle: '$book.title',
            bookAuthor: '$book.author'
          }
        }
      ]);
    }

    // Get total count for pagination info
    const totalCount = await Highlight.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isActive: { $ne: false },
      $or: [
        { $text: { $search: searchQuery } },
        { highlight: { $regex: searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      ]
    }).catch(() => highlights.length); // Fallback if $text fails in count

    res.json({
      highlights,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + highlights.length < totalCount
      },
      searchQuery
    });

  } catch (error) {
    console.error('Quote search error:', error);
    res.status(500).json({ message: 'Error searching highlights', error: error.message });
  }
});

// Batch update highlights for a specific book
router.post('/user/book/:bookId/batch-update', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { operations } = req.body; // Array of StagedOperation objects

    // Validate bookId
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book ID' });
    }
    
    // console.log(bookId);
    // console.log(operations);

    // Validate operations array


    // Find the book (to verify it exists)
    const book = await Books.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Track operation results
    const results = {
      successful: [],
      failed: [],
      totalOperations: operations.length
    };

    // Process each operation
    for (const operation of operations) {
      try {
        await processOperation(bookId, operation, results);
      } catch (error) {
        results.failed.push({
          operationId: operation.id,
          highlightId: operation.highlightId,
          error: error.message,
          type: operation.type
        });
      }
    }

    // Return results
    res.status(200).json({
      message: 'Batch update completed',
      results: {
        ...results,
        successCount: results.successful.length,
        failureCount: results.failed.length
      }
    });

  } catch (error) {
    console.error('Batch update error:', error);
    res.status(500).json({ 
      message: 'Internal server error during batch update',
      error: error.message 
    });
  }
});

// Helper function to process individual operations
async function processOperation(bookId, operation, results) {
  const { id, type, highlightId, originalHighlight, updatedHighlight, timestamp } = operation;

  // Validate operation structure
  if (!id || !type || !highlightId || !originalHighlight) {
    throw new Error('Missing required operation fields');
  }

  if (!['edit', 'delete'].includes(type)) {
    throw new Error('Invalid operation type. Must be "edit" or "delete"');
  }

  // Find the highlight in the Highlight collection
  const currentHighlight = await Highlight.findById(highlightId);

  if (!currentHighlight) {
    throw new Error(`Highlight with ID ${highlightId} not found`);
  }

  // Verify the highlight belongs to this book
  if (currentHighlight.bookId.toString() !== bookId.toString()) {
    throw new Error(`Highlight ${highlightId} does not belong to book ${bookId}`);
  }

  // IMPROVED: Only check for conflicts if this is NOT an intentional edit
  // The conflict detection should verify that the current state matches what the user expects
  if (!verifyHighlightMatch(currentHighlight, originalHighlight)) {
    // Check if this is a "stale" edit (user is working with old data)
    throw new Error('Highlight has been modified since you last viewed it. Please refresh Cache and try again.');
  }

  switch (type) {
    case 'edit':
      await processEditOperation(currentHighlight, updatedHighlight, operation, results);
      break;
      
    case 'delete':
      await processDeleteOperation(currentHighlight, operation, results);
      break;
      
    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
}

// Process delete operation with soft delete
async function processDeleteOperation(highlight, operation, results) {
  try {
    const deletionReason = operation.deletionReason || 'user_deletion';
    
    // Use soft delete utility
    await softDeleteHighlight(highlight._id, 'user', deletionReason);

    results.successful.push({
      operationId: operation.id,
      highlightId: operation.highlightId,
      type: 'delete',
      message: 'Highlight soft-deleted successfully'
    });

  } catch (error) {
    throw new Error(`Failed to delete highlight: ${error.message}`);
  }
}

// Process edit operation (store original in soft delete before editing)
async function processEditOperation(highlight, updatedHighlight, operation, results) {
  if (!updatedHighlight) {
    throw new Error('Updated highlight data is required for edit operations');
  }

  // Apply updates to the highlight
  Object.keys(updatedHighlight).forEach(key => {
    if (updatedHighlight[key] !== undefined) {
      if (key === 'location' && typeof updatedHighlight[key] === 'object') {
        // Handle nested location object
        highlight.location = {
          ...highlight.location.toObject(),
          ...updatedHighlight[key]
        };
      } else {
        highlight[key] = updatedHighlight[key];
      }
    }
  });

  highlight.updatedAt = new Date();
  await highlight.save();
    
  results.successful.push({
    operationId: operation.id,
    highlightId: operation.highlightId,
    type: 'edit',
    message: 'Highlight updated successfully'
  });
}

function verifyHighlightMatch(currentHighlight, originalHighlight) {
  // Only check core content that shouldn't change unexpectedly
  const keyFields = ['highlight', 'type'];
  
  for (const field of keyFields) {
    if (currentHighlight[field] !== originalHighlight[field]) {
      return false;
    }
  }

  // Compare location if it exists (location shouldn't change unexpectedly)
  if (originalHighlight.location) {
    if (!currentHighlight.location ||
        currentHighlight.location.start !== originalHighlight.location.start ||
        currentHighlight.location.end !== originalHighlight.location.end) {
      return false;
    }
  }

  return true;
}

// Validation middleware for batch operations
function validateBatchOperations(req, res, next) {
    const { operations } = req.body;
  
    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ message: 'Operations must be an array' });
    }

    if (operations.length === 0) {
        return res.status(400).json({ message: 'Operations array is required and must not be empty' });
    }

  // Validate each operation
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const errors = [];

    if (!operation.id) errors.push('id is required');
    if (!operation.type) errors.push('type is required');
    if (!operation.highlightId) errors.push('highlightId is required');
    if (!operation.originalHighlight) errors.push('originalHighlight is required');
    if (!operation.timestamp) errors.push('timestamp is required');

    if (operation.type === 'edit' && !operation.updatedHighlight) {
      errors.push('updatedHighlight is required for edit operations');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: `Invalid operation at index ${i}`,
        errors: errors
      });
    }
  }

  next();
}

// Apply validation middleware to the route
router.post('/user/book/:bookId/batch-update', validateBatchOperations);

module.exports = router;