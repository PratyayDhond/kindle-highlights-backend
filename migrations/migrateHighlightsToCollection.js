/**
 * Migration Script: Move highlights from embedded arrays to separate collection
 * 
 * This script migrates the database from the old schema (highlights embedded in Books)
 * to the new schema (highlights in separate Highlight collection).
 * 
 * Run with: node migrations/migrateHighlightsToCollection.js
 */

require('dotenv').config(); // Loads .env from current working directory (project root)
const mongoose = require('mongoose');

// Old Books model (with embedded highlights)
const OldBookSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  author: String,
  highlights: [{
    highlight: { type: String, required: true },
    type: { type: String, enum: ['highlight', 'note', 'bookmark'], required: true },
    page: { type: String, required: false, default: '' },
    location: { 
      start: { type: Number, required: true },
      end: { type: Number, required: true }
    },
    timestamp: { type: Date },
    knowledge_begin_date: { type: Date, default: null },
    knowledge_end_date: { type: Date, default: null }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// New Highlight model
const HighlightSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  highlight: { type: String, required: true },
  type: { type: String, enum: ['highlight', 'note', 'bookmark'], required: true },
  page: { type: String, required: false, default: '' },
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

// SoftDeletedBooks model for migrating deleted highlights
const SoftDeletedBooksSchema = new mongoose.Schema({
  originalBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Books', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  author: { type: String, required: false, default: null },
  deletedHighlights: [{
    originalHighlightId: { type: mongoose.Schema.Types.ObjectId, required: true },
    highlight: { type: String, required: true },
    type: { type: String, enum: ['highlight', 'note', 'bookmark'], required: true },
    page: { type: String, required: false, default: '' },
    location: { 
      start: { type: Number, required: true },
      end: { type: Number, required: true }
    },
    timestamp: { type: Date },
    knowledge_begin_date: { type: Date },
    knowledge_end_date: { type: Date },
    deletedAt: { type: Date, default: Date.now },
    deletedBy: { type: String, default: 'user' },
    deletionReason: { type: String, default: 'user_deletion' }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Use the same collection name but different schemas
    const OldBook = mongoose.model('OldBooks', OldBookSchema, 'books');
    const Highlight = mongoose.model('Highlight', HighlightSchema, 'highlights');
    const SoftDeletedBooks = mongoose.model('SoftDeletedBooks', SoftDeletedBooksSchema, 'softdeletedbooks');

    // Check if migration already done
    const existingHighlightsCount = await Highlight.countDocuments();
    if (existingHighlightsCount > 0) {
      console.log(`⚠️  Migration may have already been run. Found ${existingHighlightsCount} highlights in collection.`);
      const answer = await askQuestion('Do you want to continue anyway? This may create duplicates. (yes/no): ');
      if (answer.toLowerCase() !== 'yes') {
        console.log('Migration cancelled.');
        process.exit(0);
      }
    }

    console.log('\n📚 Starting migration of active highlights...');
    
    // Get all books with embedded highlights
    const books = await OldBook.find({ highlights: { $exists: true, $not: { $size: 0 } } });
    console.log(`Found ${books.length} books with highlights to migrate`);

    let totalHighlightsMigrated = 0;
    let totalBooksMigrated = 0;

    for (const book of books) {
      if (!book.highlights || book.highlights.length === 0) continue;

      const highlightDocs = book.highlights.map(h => ({
        bookId: book._id,
        userId: book.userId,
        highlight: h.highlight,
        type: h.type,
        page: h.page || '',
        location: {
          start: h.location?.start || 0,
          end: h.location?.end || 0
        },
        timestamp: h.timestamp,
        knowledge_begin_date: h.knowledge_begin_date || h.timestamp || new Date(),
        knowledge_end_date: h.knowledge_end_date || null,
        isActive: true,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt
      }));

      await Highlight.insertMany(highlightDocs);
      totalHighlightsMigrated += highlightDocs.length;
      totalBooksMigrated++;

      if (totalBooksMigrated % 10 === 0) {
        console.log(`  Migrated ${totalBooksMigrated} books, ${totalHighlightsMigrated} highlights...`);
      }
    }

    console.log(`✅ Migrated ${totalHighlightsMigrated} active highlights from ${totalBooksMigrated} books`);

    // Migrate soft-deleted highlights
    console.log('\n🗑️  Starting migration of soft-deleted highlights...');
    
    const softDeletedBooks = await SoftDeletedBooks.find({});
    console.log(`Found ${softDeletedBooks.length} soft-deleted book records`);

    let totalSoftDeletedMigrated = 0;

    for (const sdb of softDeletedBooks) {
      if (!sdb.deletedHighlights || sdb.deletedHighlights.length === 0) continue;

      const softDeletedHighlightDocs = sdb.deletedHighlights.map(h => ({
        bookId: sdb.originalBookId,
        userId: sdb.userId,
        highlight: h.highlight,
        type: h.type,
        page: h.page || '',
        location: {
          start: h.location?.start || 0,
          end: h.location?.end || 0
        },
        timestamp: h.timestamp,
        knowledge_begin_date: h.knowledge_begin_date || h.timestamp || new Date(),
        knowledge_end_date: h.knowledge_end_date || null,
        isActive: false,
        deletedAt: h.deletedAt,
        deletedBy: h.deletedBy || 'user',
        deletionReason: h.deletionReason || 'migrated_from_soft_delete',
        createdAt: sdb.createdAt,
        updatedAt: sdb.updatedAt
      }));

      await Highlight.insertMany(softDeletedHighlightDocs);
      totalSoftDeletedMigrated += softDeletedHighlightDocs.length;
    }

    console.log(`✅ Migrated ${totalSoftDeletedMigrated} soft-deleted highlights`);

    // Create indexes
    console.log('\n📇 Creating indexes...');
    await Highlight.collection.createIndex({ bookId: 1, isActive: 1 });
    await Highlight.collection.createIndex({ userId: 1, isActive: 1 });
    await Highlight.collection.createIndex({ highlight: 'text' });
    console.log('✅ Indexes created');

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total books processed: ${totalBooksMigrated}`);
    console.log(`Active highlights migrated: ${totalHighlightsMigrated}`);
    console.log(`Soft-deleted highlights migrated: ${totalSoftDeletedMigrated}`);
    console.log(`Total highlights in new collection: ${totalHighlightsMigrated + totalSoftDeletedMigrated}`);
    console.log('='.repeat(50));

    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('1. Verify the migration by checking the highlights collection');
    console.log('2. Update your application code to use the new Highlight model');
    console.log('3. Once verified, you can optionally:');
    console.log('   - Remove the highlights array from books collection');
    console.log('   - Drop the softdeletedbooks collection');
    console.log('\nRun verification query:');
    console.log('  db.highlights.countDocuments()');
    console.log('  db.highlights.find().limit(5).pretty()');

  } catch (error) {
    console.error('Migration failed:', error);
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

// Run migration
migrate();
