/**
 * Cleanup Script: Remove embedded highlights from Books and drop SoftDeletedBooks
 * 
 * Run this ONLY AFTER verifying the migration was successful!
 * 
 * Run with: node migrations/cleanupOldHighlights.js
 */

require('dotenv').config(); // Loads .env from current working directory (project root)
const mongoose = require('mongoose');

async function cleanup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Verification step
    console.log('\n📊 Verification before cleanup...');
    
    const highlightsCount = await db.collection('highlights').countDocuments();
    const booksWithHighlights = await db.collection('books').countDocuments({ 
      highlights: { $exists: true, $not: { $size: 0 } } 
    });
    const softDeletedCount = await db.collection('softdeletedbooks').countDocuments();

    console.log(`Highlights in new collection: ${highlightsCount}`);
    console.log(`Books with embedded highlights: ${booksWithHighlights}`);
    console.log(`SoftDeletedBooks documents: ${softDeletedCount}`);

    if (highlightsCount === 0) {
      console.log('\n❌ No highlights found in new collection. Run migration first!');
      process.exit(1);
    }

    const answer = await askQuestion('\n⚠️  This will permanently remove embedded highlights from books and drop softdeletedbooks collection.\nType "DELETE" to confirm: ');
    
    if (answer !== 'DELETE') {
      console.log('Cleanup cancelled.');
      process.exit(0);
    }

    // Remove embedded highlights from books
    console.log('\n🗑️  Removing embedded highlights from books...');
    const updateResult = await db.collection('books').updateMany(
      { highlights: { $exists: true } },
      { 
        $unset: { highlights: '' },
        $set: { 
          isActive: true,  // Add new isActive field
          updatedAt: new Date()
        }
      }
    );
    console.log(`✅ Updated ${updateResult.modifiedCount} books`);

    // Drop softdeletedbooks collection
    console.log('\n🗑️  Dropping softdeletedbooks collection...');
    try {
      await db.collection('softdeletedbooks').drop();
      console.log('✅ Dropped softdeletedbooks collection');
    } catch (err) {
      if (err.code === 26) {
        console.log('ℹ️  softdeletedbooks collection does not exist');
      } else {
        throw err;
      }
    }

    // Add isActive index to books
    console.log('\n📇 Adding isActive index to books...');
    await db.collection('books').createIndex({ userId: 1, isActive: 1 });
    console.log('✅ Index created');

    console.log('\n' + '='.repeat(50));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(50));
    console.log('You can now delete models/SoftDeletedBooks.js from your codebase.');

  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

function askQuestion(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

// Run cleanup
cleanup();
