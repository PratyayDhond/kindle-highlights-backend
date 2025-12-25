const e = require("express");
const {setBookCount} = require('../progress.js');
const {areHighlightsSimilar, dataToArray, simScoreCount, parseBookNameAndAuthor, parsePageLocationTimestampHighlightType, bookExists, createBook, addUserHighlightInBook} = require('./parseCommons.js');

function parseHighlights(fileContent) {
    const books = [];
    let totalHighlights = 0;
    const note_sep = '==========';
    console.log('[ParseKindleExt] Parsing highlights start');
    try {
        rawData = dataToArray(fileContent);
        if (rawData.length === 0) {
            console.log('[ParseKindleExt] No highlights found');
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
            console.log('[ParseKindleExt] Incorrect file uploaded (unknown type, no location, no page)'); // this is not a valid kindle clippings file
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
            console.log('[ParseKindleExt] Created book', {name: bookName, author});
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
        console.log('[ParseKindleExt] Parsing completed', {books: books.length, totalHighlights});
        let [updatedBooks, updatedTotalHighlights] = removeRedundantHighlights(books);

        let stats = {
            totalBooks: updatedBooks.length,
            totalHighlights: updatedTotalHighlights,
            avgHighlights: updatedTotalHighlights / updatedBooks.length,
            maxHighlights: Math.max(...updatedBooks.map(book => book.highlights.length)),
            updatedAt: new Date()
        }
        return { highlights: books, stats };
    } catch (err) {
        console.error('[ParseKindleExt] parseHighlights failed', { message: err.message, code: err.code, stack: err.stack });
        return { status: 'error', message: 'Parsing failed', statusCode: 500 };
    }
}

function removeRedundantHighlights(books){
    let totalHighlights = 0;
    books.forEach(book => {
        // console.log('Removing redundant highlights for book:', book.name);
        const list = Array.isArray(book.highlights) ? book.highlights.filter(Boolean) : [];
        try {
            book.highlights = purgeOverlappingHighlights(list);
            totalHighlights += book.highlights.length;
        } catch (err) {
            console.error('[ParseKindleExt] removeRedundantHighlights failed for book', { name: book?.name, err: err.message, code: err.code, stack: err.stack });
            book.highlights = list;
        }
    });

    console.log(`Total highlights after removing redundant ones: ${totalHighlights}`);
    console.log(simScoreCount, "similar highlights found");
    return [books, totalHighlights];
}

function purgeOverlappingHighlights(highlights) {
    if (!Array.isArray(highlights) || highlights.length === 0) return [];
    const updatedHighlights = [];


    // sort highlights by location.start here
        highlights.sort((a, b) => {
            const aType = a?.type || '';
            const bType = b?.type || '';
            if (aType !== bType) {
                return aType.localeCompare(bType);
            }

            const aLocStart = a?.location && typeof a.location.start === 'number' ? a.location.start : -1;
            const bLocStart = b?.location && typeof b.location.start === 'number' ? b.location.start : -1;
            if (aLocStart !== bLocStart) {
                return aLocStart - bLocStart;
            }

            const aPageNum = a?.page ? parseInt(a.page, 10) : NaN;
            const bPageNum = b?.page ? parseInt(b.page, 10) : NaN;
            if (!Number.isNaN(aPageNum) && !Number.isNaN(bPageNum) && aPageNum !== bPageNum) {
                // Keep notes before highlights if at the same location
                return aPageNum - bPageNum;
            }

            // If still equal, sort by timestamp
            return new Date(a?.timestamp).getTime() - new Date(b?.timestamp).getTime();
        });

    for (let i = 0; i < highlights.length; i++) {
        const hi = highlights[i];
        if (!hi || !hi.highlight) continue;
        for(let j = 0; j < highlights.length; j++) {
            if(i === j)
                continue;
            const hj = highlights[j];
            if (!hj || !hj.highlight)
                continue;
            if(areHighlightsSimilar(hi.highlight, hj.highlight)) {
                const iTime = new Date(hi.timestamp).getTime();
                const jTime = new Date(hj.timestamp).getTime();
                if(iTime < jTime) {
                    hi.isActive = false;
                    break;
                }
                else {
                    hj.isActive = false;
                    continue;
                }
            }
        }
        if (hi && hi.isActive !== false) {
            hi.isActive = true;
        }
    }

    let locationCounter = 1;

    for (const highlight of highlights) {
        if(!highlight) continue;
        if(highlight.isActive === true) {
            if (!highlight.location) {
                highlight.location = { start: locationCounter, end: -1 };
            } else {
                highlight.location.start = locationCounter;
            }
            delete highlight.isActive;
            updatedHighlights.push(highlight);
            locationCounter++;
        }
    }
    // console.log(locationCounter - 1, "unique highlights retained");
    return updatedHighlights;
}

module.exports = {parseHighlights, purgeOverlappingHighlights}

