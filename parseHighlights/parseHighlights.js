const e = require("express");
const {setBookCount} = require('../progress.js');
const {parseBookNameAndAuthor, dataToArray, areHighlightsSimilar, simScoreCount, parsePageLocationTimestampHighlightType, bookExists, createBook, addUserHighlightInBook} = require('./parseCommons.js');


function parseHighlights(fileContent) {
    const books = [];
    let totalHighlights = 0;
    const note_sep = '==========';
    rawData = dataToArray(fileContent);
    if (rawData.length === 0) {
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

        // timestamp and location data
        var dataLine2 = rawData[i].trimRight();
        [page, location, timestamp, currentNoteType] = parsePageLocationTimestampHighlightType(dataLine2);

        if(currentNoteType === 'unknown' && location.start === -1 && location.end === -1) {
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
    // console.log('Parsing completed. Total books:', books.length);
    // console.log('Total highlights:', totalHighlights);
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
    const startTime = Date.now();
    
    books.forEach((book, bookIndex) => {
        const list = Array.isArray(book.highlights) ? book.highlights : [];
        
        // Skip deduplication for books with too many highlights to prevent timeout
        if (list.length > 500) {
            console.warn('[ParseHighlights] Skipping dedup for large book', { count: list.length });
            book.highlights = list;
            totalHighlights += list.length;
            return;
        }
        
        try {
            book.highlights = purgeOverlappingHighlightsBrute(list, book.name);
            totalHighlights += book.highlights.length;
            
            const elapsed = Date.now() - startTime;
            
            // Prevent timeout: if dedup is taking too long, skip remaining books
            if (elapsed > 25000) { // 25 seconds
                console.warn('[ParseHighlights] Dedup timeout approaching, processing remaining books without dedup');
                // Process remaining books without dedup
                for (let i = bookIndex + 1; i < books.length; i++) {
                    const remaining = Array.isArray(books[i].highlights) ? books[i].highlights : [];
                    books[i].highlights = remaining;
                    totalHighlights += remaining.length;
                }
                return false; // Break forEach
            }
        } catch (err) {
            console.error('[ParseHighlights] removeRedundantHighlights failed for book', { 
                name: book?.name, 
                err: err.message, 
                code: err.code, 
                stack: err.stack 
            });
            book.highlights = list;
            totalHighlights += list.length;
        }
    });

    return [books, totalHighlights];
}

function purgeOverlappingHighlightsBrute(highlights, bookName){
    // Here, we are getting highlights for a book, so we compare the highlight with each of the other existing highlight
    // if highlights are similar we keep the latest one with us
    if (!Array.isArray(highlights) || highlights.length === 0) return [];
    
    console.log('[ParseHighlights] Purging overlapping highlights', { book: bookName, count: highlights.length });
    
    // Limit processing to prevent memory issues
    if (highlights.length > 1000) {
        console.warn('[ParseHighlights] Too many highlights to dedupe safely', { book: bookName, count: highlights.length });
        return highlights;
    }
    for(let i = 0; i < highlights.length; i++){
        for(let j = 0; j < highlights.length; j++){
            if(i === j)
                continue;
            if(highlights[j].isDuplicate)
                continue;

            if(areHighlightsSimilar(highlights[i].highlight, highlights[j].highlight)){
                const iTime = new Date(highlights[i].timestamp).getTime();
                const jTime = new Date(highlights[j].timestamp).getTime();
                const iValid = Number.isFinite(iTime);
                const jValid = Number.isFinite(jTime);
                if (iValid && jValid) {
                    if (iTime > jTime) {
                        highlights[j].isDuplicate = true;
                    } else {
                        highlights[i].isDuplicate = true;
                        break;
                    }
                } else if (iValid && !jValid) {
                    // Prefer the one with a valid timestamp
                    highlights[j].isDuplicate = true;
                } else if (!iValid && jValid) {
                    highlights[i].isDuplicate = true;
                    break;
                } else {
                    // Neither has a valid timestamp; prefer the longer text, else keep first
                    const iLen = (highlights[i].highlight || '').length;
                    const jLen = (highlights[j].highlight || '').length;
                    if (iLen >= jLen) {
                        highlights[j].isDuplicate = true;
                    } else {
                        highlights[i].isDuplicate = true;
                        break;
                    }
                }
            }
        }
    }

    let updatedHighlights = []
    for(const highlight of highlights){
        if(!highlight.isDuplicate)
            updatedHighlights.push(highlight);
    }

    return updatedHighlights;
}



function purgeOverlappingHighlights(highlights) {
    if (!highlights.length) return [];
    const updatedHighlights = [];


    // sort highlights by location.start here
    highlights.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }

      if (a.location.start !== -1 && a.location.start !== b.location.start) {
        return a.location.start - b.location.start;
      }
      // Keep notes before highlights if at the same location

      // If still equal, sort by timestamp
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    let current = highlights[0];

    // for the edge case that the user has only one highlight in a book.
    // If this is not done we will end up getting an empty pdf with book name and author but no highlights.
    // if(highlights.length === 1) {
    //     updatedHighlights.push(current);
    // }

    for (let i = 1; i < highlights.length; i++) {
        const next = highlights[i];


        let currentStart = current.location.start;
        let currentEnd = current.location.end === -1 ? current.location.start : current.location.end;
        let nextStart = next.location.start;
        let nextEnd = next.location.end === -1 ? next.location.start : next.location.end

        // here we do not need to check for similarity score
        // As the start and end are same and not just overlapping, they are the same highlights redone over a span of time.n
        if(currentStart === nextStart && currentEnd === nextEnd && current.type === next.type) {
            let currentTime = new Date(current.timestamp).getTime();
            let nextTime = new Date(next.timestamp).getTime();
            if (nextTime >= currentTime) {
                // If next highlight is more recent, update current and forget about it ;)
                current = next;
            }
            continue;
        }

        // if they overlap and are of the same type
        if (currentEnd >= nextStart && current.type === next.type && areHighlightsSimilar(current.highlight, next.highlight)) {
            // Overlapping or touching intervals, keep the latest one out of the two
            let currentTime = new Date(current.timestamp).getTime();
            let nextTime = new Date(next.timestamp).getTime();
            if (nextTime >= currentTime ) {
                // If next highlight is more recent, update current and forget about it ;)
                current = next;
            }
            // current.locEnd = Math.max(current.locEnd, next.locEnd);
        } else {
            // No overlap, push the current highlight and move to the next
            updatedHighlights.push(current);
            current = next;
        }

    }
    // compare the current and next one last time

    // updatedHighlights.push(highlights[highlights.length - 1]);
    updatedHighlights.push(current);
    return updatedHighlights;
}


module.exports = {parseHighlights, purgeOverlappingHighlights, purgeOverlappingHighlightsBrute}

