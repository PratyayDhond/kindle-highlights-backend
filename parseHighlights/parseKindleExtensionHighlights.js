const e = require("express");
const {setBookCount} = require('../progress.js');
const {areHighlightsSimilar, dataToArray, simScoreCount, parseBookNameAndAuthor, parsePageLocationTimestampHighlightType, bookExists, createBook, addUserHighlightInBook} = require('./parseCommons.js');

function summarizeHighlight(h) {
    if (!h) return { status: 'nil' };
    const snippet = typeof h.highlight === 'string' ? h.highlight.slice(0, 80) : '';
    const hasSpecialChars = /[^\x00-\x7F]/.test(snippet);
    return {
        status: 'ok',
        type: h.type,
        page: h.page,
        location: h.location,
        timestamp: h.timestamp,
        hasText: !!h.highlight,
        textPreview: snippet,
        hasSpecialChars,
    };
}

function safeStringOp(str) {
    if (!str || typeof str !== 'string') return '';
    try {
        // Normalize unicode and handle potential encoding issues
        return str.normalize ? str.normalize('NFC') : str;
    } catch (e) {
        console.warn('[ParseKindleExt] String normalization failed', { preview: str.slice(0, 40) });
        return str;
    }
}

function parseHighlights(fileContent) {
    const books = [];
    let totalHighlights = 0;
    const note_sep = '==========';
    try {
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
            book = bookExists(books, bookName);
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
    const startTime = Date.now();
    
    books.forEach((book, bookIndex) => {
        const list = Array.isArray(book.highlights) ? book.highlights.filter(Boolean) : [];
        
        try {
            book.highlights = purgeOverlappingHighlights(list);
            totalHighlights += book.highlights.length;
            
            const elapsed = Date.now() - startTime;
            
            // Prevent timeout: if dedup is taking too long, skip remaining books
            if (elapsed > 25000) { // 25 seconds
                console.warn('[ParseKindleExt] Dedup timeout approaching, processing remaining books without dedup');
                // Process remaining books without dedup
                for (let i = bookIndex + 1; i < books.length; i++) {
                    const remaining = Array.isArray(books[i].highlights) ? books[i].highlights.filter(Boolean) : [];
                    books[i].highlights = remaining;
                    totalHighlights += remaining.length;
                }
                return false; // Break forEach
            }
        } catch (err) {
            const sample = list.slice(0, 3).map(summarizeHighlight);
            console.error('[ParseKindleExt] removeRedundantHighlights failed for book', { 
                name: book?.name, 
                err: err.message, 
                code: err.code, 
                stack: err.stack, 
                sample 
            });
            book.highlights = list;
            totalHighlights += list.length;
        }
    });

    console.log(`Total highlights after removing redundant ones: ${totalHighlights}`);
    console.log(simScoreCount, "similar highlights found");
    return [books, totalHighlights];
}

function purgeOverlappingHighlights(highlights) {
    if (!Array.isArray(highlights) || highlights.length === 0) return [];
    
    // Limit processing to prevent memory issues
    if (highlights.length > 1000) {
        console.warn('[ParseKindleExt] Too many highlights to dedupe safely', { count: highlights.length });
        return highlights;
    }
    
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
            try {
                const iHighlight = safeStringOp(hi.highlight);
                const jHighlight = safeStringOp(hj.highlight);
                if(areHighlightsSimilar(iHighlight, jHighlight)) {
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
            } catch (err) {
                console.error('[ParseKindleExt] Similarity check failed', {
                    i, j,
                    iPreview: hi.highlight?.slice(0, 40),
                    jPreview: hj.highlight?.slice(0, 40),
                    err: err.message,
                    stack: err.stack
                });
                // Skip this comparison and continue
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

