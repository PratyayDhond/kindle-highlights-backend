const express = require('express');
const router = express.Router();
const Books = require('./models/Books');
const SoftDeletedBooks = require('./models/SoftDeletedBooks'); // Add this import
const mongoose = require('mongoose');

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


    // Find the book
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
        await processOperation(book, operation, results);
      } catch (error) {
        results.failed.push({
          operationId: operation.id,
          highlightId: operation.highlightId,
          error: error.message,
          type: operation.type
        });
      }
    }

    // Save the book with all changes
    await book.save();

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
async function processOperation(book, operation, results) {
  const { id, type, highlightId, originalHighlight, updatedHighlight, timestamp } = operation;

  // Validate operation structure
  if (!id || !type || !highlightId || !originalHighlight) {
    throw new Error('Missing required operation fields');
  }

  if (!['edit', 'delete'].includes(type)) {
    throw new Error('Invalid operation type. Must be "edit" or "delete"');
  }

  // Find the highlight in the book
  const highlightIndex = book.highlights.findIndex(
    highlight => highlight._id.toString() === highlightId
  );

  if (highlightIndex === -1) {
    throw new Error(`Highlight with ID ${highlightId} not found in book`);
  }

  const currentHighlight = book.highlights[highlightIndex];

  // IMPROVED: Only check for conflicts if this is NOT an intentional edit
  // The conflict detection should verify that the current state matches what the user expects
  if (!verifyHighlightMatch(currentHighlight, originalHighlight)) {
    // Check if this is a "stale" edit (user is working with old data)
    throw new Error('Highlight has been modified since you last viewed it. Please refresh Cache and try again.');
  }

  switch (type) {
    case 'edit':
      await processEditOperation(book, highlightIndex, updatedHighlight, operation, results);
      break;
      
    case 'delete':
      await processDeleteOperation(book, highlightIndex, operation, results);
      break;
      
    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
}

// Process delete operation with soft delete
async function processDeleteOperation(book, highlightIndex, operation, results) {
  try {
    const highlightToDelete = book.highlights[highlightIndex];
    const deletionReason = operation.deletionReason || 'user_deletion';
    // Move highlight to SoftDeletedBooks collection
    await moveHighlightToSoftDeleted(book, highlightToDelete, deletionReason);
    
    // Remove the highlight from the array
    book.highlights.splice(highlightIndex, 1);

    results.successful.push({
      operationId: operation.id,
      highlightId: operation.highlightId,
      type: 'delete',
      message: 'Highlight deleted successfully and moved to soft delete collection'
    });

  } catch (error) {
    throw new Error(`Failed to delete highlight: ${error.message}`);
  }
}

// Helper function to move highlight to soft deleted collection
async function moveHighlightToSoftDeleted(book, highlightToDelete, deletionReason) {
  try {
    // Check if SoftDeletedBooks document already exists for this book
    let softDeletedBook = await SoftDeletedBooks.findOne({
      originalBookId: book._id,
      userId: book.userId
    });

    // If no soft deleted book exists, create one
    if (!softDeletedBook) {
      softDeletedBook = new SoftDeletedBooks({
        originalBookId: book._id,
        userId: book.userId,
        title: book.title,
        author: book.author,
        deletedHighlights: []
      });
    }

    // Prepare the deleted highlight data
    const deletedHighlightData = {
      originalHighlightId: highlightToDelete._id,
      highlight: highlightToDelete.highlight,
      type: highlightToDelete.type,
      page: highlightToDelete.page,
      location: {
        start: highlightToDelete.location.start,
        end: highlightToDelete.location.end
      },
      timestamp: highlightToDelete.timestamp,
      knowledge_begin_date: highlightToDelete.knowledge_begin_date,
      knowledge_end_date: highlightToDelete.knowledge_end_date,
      deletedAt: new Date(),
      deletionReason: deletionReason
    };

    // Add the deleted highlight to the soft deleted book
    softDeletedBook.deletedHighlights.push(deletedHighlightData);
    softDeletedBook.updatedAt = new Date();

    // Save the soft deleted book
    await softDeletedBook.save();

    console.log(`Highlight ${highlightToDelete._id} moved to soft delete collection`);

  } catch (error) {
    console.error('Error moving highlight to soft delete collection:', error);
    throw error;
  }
}

// Process edit operation (updated to handle soft delete for original content)
async function processEditOperation(book, highlightIndex, updatedHighlight, operation, results) {
  if (!updatedHighlight) {
    throw new Error('Updated highlight data is required for edit operations');
  }

  const currentHighlight = book.highlights[highlightIndex];
  const deletionReason = 'edit_operation';
  // Store original content in soft delete collection before editing
  await moveHighlightToSoftDeleted(book, currentHighlight, deletionReason);

  // Apply updates to the highlight
  Object.keys(updatedHighlight).forEach(key => {
    if (updatedHighlight[key] !== undefined) {
      if (key === 'location' && typeof updatedHighlight[key] === 'object') {
        // Handle nested location object
        currentHighlight.location = {
          ...currentHighlight.location,
          ...updatedHighlight[key]
        };
      } else {
        currentHighlight[key] = updatedHighlight[key];
      }
    }
  });

    
    results.successful.push({
        operationId: operation.id,
        highlightId: operation.highlightId,
        type: 'edit',
        message: 'Highlight updated successfully, original content preserved in soft delete collection'
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