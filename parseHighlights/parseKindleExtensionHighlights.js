const e = require("express");
const {setBookCount} = require('../progress.js');
const {areHighlightsSimilar, dataToArray, simScoreCount, parseBookNameAndAuthor, parsePageLocationTimestampHighlightType, bookExists, createBook, addUserHighlightInBook} = require('./parseCommons.js');

function parseHighlights(fileContent) {
    const books = [];
    let totalHighlights = 0;
    const note_sep = '==========';
     console.log('Parsing highlights...');
    rawData = dataToArray(fileContent);
    if (rawData.length === 0) {
         console.log('No highlights found.');
        return {status: 'error', message: 'No highlights found.', statusCode: 400};
    }

    var author = '';
    var bookName = '';
    var currentNote = '';
    var page = '';
    var location = {start: undefined, end: undefined};
    var timestamp = '';
    var currentNoteType = '';
    var i = 0;
    var book = {};

    while(rawData[i] === '' || rawData[i].trimRight() === note_sep)
        i++;

    while (i < rawData.length) {

        if( i === rawData.length - 1)
            break;

        var bookNameAndAuthor = rawData[i].trimRight();
        [bookName,author] = parseBookNameAndAuthor(bookNameAndAuthor);

        i++;

        var dataLine2 = rawData[i].trimRight();
        [page, location, timestamp, currentNoteType] = parsePageLocationTimestampHighlightType(dataLine2);
        
        if(currentNoteType === 'unknown' && location.start === -1 && location.end === -1 && page === '') {
            console.log('Incorrect file uploaded'); // this is not a valid kindle clippings file
            // Here we are setting error code to 418 (I'm a teapot) as a playful way to indicate that the file is not a valid Kindle clippings file.
            return {status: 'error', message: 'Incorrect file uploaded. Please upload a valid Kindle clippings file.', statusCode: 418};
        }
        i+= 1; // skip the next line which is a separator
        //  console.log("Current Line:", rawData[i]);
        while( i < rawData.length && rawData[i].trim() !== note_sep){
            currentNote += rawData[i].trim() + '\n';
            i++;
        }
        // remove the last newline character    
        if (currentNote.length > 0 && currentNote[currentNote.length - 1] === '\n') {
            currentNote = currentNote.slice(0, -1);
        }
        
        book = bookExists(books, bookName)
        if(book === -1){
            createBook(books, bookName, author);
            book = bookExists(books, bookName); // confirm the book was created and return book object
        }

        addUserHighlightInBook(books, bookName, author, currentNote, page, location, timestamp, currentNoteType);
        totalHighlights++;
        currentNote = ''
        // Check if the next line is a separator or empty
        while(i < rawData.length && (rawData[i].trimRight() === '' || rawData[i].trimRight() === note_sep)) {
            i++;
        }
    }
    setBookCount(books.length);
    if(books.length === 0 && totalHighlights === 0) {
        return {status: 'error', message: 'Incorrect file uploaded. Please upload a valid Kindle clippings file.', statusCode: 418};
    }
     console.log('Parsing completed. Total books:', books.length);
     console.log('Total highlights:', totalHighlights);
    let [updatedBooks, updatedTotalHighlights] = removeRedundantHighlights(books);

    let stats = {
        totalBooks: updatedBooks.length,
        totalHighlights: updatedTotalHighlights,
        avgHighlights: updatedTotalHighlights / updatedBooks.length,
        maxHighlights: Math.max(...updatedBooks.map(book => book.highlights.length)),
        updatedAt: new Date()
    }
    return { highlights: books, stats };
}

function removeRedundantHighlights(books){
    let totalHighlights = 0;
    books.forEach(book => {
        // console.log('Removing redundant highlights for book:', book.name);
        book.highlights = purgeOverlappingHighlights(book.highlights);
        totalHighlights += book.highlights.length;
    });

    console.log(`Total highlights after removing redundant ones: ${totalHighlights}`);
    console.log(simScoreCount, "similar highlights found");
    return [books, totalHighlights];
}

function purgeOverlappingHighlights(highlights) {
    if (!highlights.length) return [];
    const updatedHighlights = [];


    // sort highlights by location.start here
    highlights.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }

      if (a.location.start !== b.location.start) {
        return a.location.start - b.location.start;
      }

      if (a.page && b.page && parseInt(a.page) !== parseInt(b.page)) {
        // Keep notes before highlights if at the same location
        return parseInt(a.page) - parseInt(b.page);
      }

      // If still equal, sort by timestamp
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    for (let i = 0; i < highlights.length; i++) {
        for(let j = 0; j < highlights.length; j++) {
            if(i === j)
                continue;
            if(areHighlightsSimilar(highlights[i].highlight, highlights[j].highlight)) {
                if(highlights[i].timestamp < highlights[j].timestamp) {
                    highlights[i].isActive = false;
                    break;
                }
                else if(highlights[i].timestamp >= highlights[j].timestamp) {
                    highlights[j].isActive = false;
                    continue;
                }
            }
        }
        highlights[i].isActive = true;
    }

    let locationCounter = 1;

    for(highlight of highlights) {
        if(highlight.isActive === true) {
            highlight.location.start = locationCounter;
            delete highlight.isActive;
            updatedHighlights.push(highlight);
            locationCounter++;
        }
    }
    // console.log(locationCounter - 1, "unique highlights retained");
    return updatedHighlights;
}

module.exports = {parseHighlights, purgeOverlappingHighlights}

