const e = require("express");
const {setBookCount} = require('./progress.js');

function parseBookNameAndAuthor(bookNameAndAuthor) {
    var bookName = '';
    var author = '';

    var j = bookNameAndAuthor.length - 1;
    if( bookNameAndAuthor[j] === ')') {
        while( j >= 0 && bookNameAndAuthor[j] !== '(') {
            j--;
        }
        if( j < 0) {
             console.log('Error: No opening parenthesis found in book name and author.');
            return {status: 'error', message: 'No opening parenthesis found in book name and author.', statusCode: 400, bookName: bookNameAndAuthor, author: ''};   
        }
        bookName = bookNameAndAuthor.substring(0, j).trim();
        author = bookNameAndAuthor.substring(j + 1, bookNameAndAuthor.length - 1).trim();
    }
    else {
        bookName = bookNameAndAuthor.trim();
        author = '';
    }

    return [bookName.trim(),author.trim()];
}

function parsePageLocationTimestamp(data) {
    var page = '';
    var location = {start: -1, end: -1};
    var timestamp = '';
    var locationString = '';
    var quoteType = '';

    data = data.trimRight();
    const pageExists = data.search("page")
    // search is case-sensitive, so it will only match "page" and "Location" exactly as they are written

    if (pageExists !== -1){
        let i = pageExists + 5; // 5 is the length of "page "
        while (i < data.length && data[i] !== ' ') {
            page += data[i];
            i++;
        }
    }
    const locationExists = data.search("Location")
    if (locationExists !== -1){
        let i = locationExists + 9; // 9 is the length of "location "
        while (i < data.length && data[i] !== ' ') {
            locationString += data[i];    
            i++;
        }
    }
    location = parseLocation(locationString);

    const timestampExists = data.search("Added on")
    if (timestampExists !== -1){
        let i = timestampExists + 9; // 9 is the length of "Added on "
        while (i < data.length && data[i] !== '\n') {
            timestamp += data[i];
            i++;
        }
    }
    
    if( data.search("Your Note on") !== -1) {
        quoteType = 'note';
    }
    else if( data.search("Your Highlight on") !== -1) {
        quoteType = 'highlight';
    }
    else if( data.search("Your Bookmark on") !== -1) {
        quoteType = 'bookmark';
    }
    else {
        quoteType = 'unknown';
    }

    return [page, location, timestamp, quoteType];
}

function bookExists(books, bookName) {
    for (var i = 0; i < books.length; i++) {
        if (books[i].name === bookName) {
            return books[i];
        }
    }
    return -1;
}

function createBook(books, bookName, author) {
    var book = {
        name: bookName,
        author: author,
        highlights: []
    };
    books.push(book);
}

function addUserHighlightInBook(books, bookname, author, highlight, page, location, timestamp, type) {    
    
    if(highlight === '')
        return;

    const highlightObject = {
        highlight: highlight,
        page: page,
        location: location,
        timestamp: timestamp,
        type: type,
        // locStart: locObj.start,
        // locEnd: locObj.end
    };

    for (var i = 0; i < books.length; i++) {
        if (books[i].name === bookname && books[i].author === author) {
            books[i].highlights.push(highlightObject);
            return;
        }
    }
}

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

        // timestamp and location data
        var dataLine2 = rawData[i].trimRight();
        [page, location, timestamp, currentNoteType] = parsePageLocationTimestamp(dataLine2);

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

function dataToArray(data) {
  return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

// a function to return similarity scores between two texts
function getSimilarityScore(text1, text2){
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
}


function parseLocation(location) {
    if (!location) return { start: -1, end: -1 };
    if (typeof location === 'number') return { start: location, end: location };
    const parts = location.split('-').map(x => parseInt(x.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        if(parts[0] === parts[1])
            return { start: parts[0], end: -1 };
        return { start: parts[0], end: parts[1] };
    }
    if (parts.length === 1 && !isNaN(parts[0])) {
        return { start: parts[0], end: -1 }; // end is -1 if only start is provided
    }
    console.error(`Invalid location format: ${location}`);
    return { start: -1, end: -1 };
}

var simScoreCount = 0;

function areHighlightsSimilar(highlight1, highlight2) {
    // Check if both highlights are empty or undefined
    if (!highlight1 || !highlight2) return false;
    if (highlight1.trim() === '' && highlight2.trim() === '') return true;
    // Check if both highlights are exactly the same
    if (highlight1 === highlight2) return true;

    // check if one of the highlights is a substring of the other
    if (highlight1.includes(highlight2) || highlight2.includes(highlight1))
        return true;

    // Calculate similarity score
    const similarityScore = getSimilarityScore(highlight1, highlight2);
    // Define a threshold for similarity (e.g., 0.8 means 80% similarity)
    const threshold = process.env.SIMILARITY_THRESHOLD || 0.7;
    if(similarityScore >= threshold) {
        console.log(`Highlights are similar: ${highlight1} | ${highlight2} | Score: ${similarityScore}`);
        simScoreCount++;
    }
    // Return true if the similarity score is above the threshold
    return similarityScore >= threshold;
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

        // if(current.type === 'note'){
        //     updatedHighlights.push(current);
        //     current = next;
        //     continue;
        // }

        let currentStart = current.location.start;
        let currentEnd = current.location.end === -1 ? current.location.start : current.location.end;
        let nextStart = next.location.start;
        let nextEnd = next.location.end === -1 ? next.location.start : next.location.end

        // here we do not need to check for similarity score
        // As the start and end are same and not just overlapping, they are the same highlights redone over a span of time.
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

function removeRedundantHighlights(books){
    let totalHighlights = 0;
    books.forEach(book => {
        book.highlights = purgeOverlappingHighlights(book.highlights);
        totalHighlights += book.highlights.length;
    });

    // for(let i = 0; i < books.length; i++) {
    //     books[i].highlights = purgeOverlappingHighlights(books[i].highlights);
    //     totalHighlights += books[i].highlights.length;
    // }

    console.log(`Total highlights after removing redundant ones: ${totalHighlights}`);
    console.log(simScoreCount, "similar highlights found");
    return [books, totalHighlights];
}

module.exports = {parseHighlights, purgeOverlappingHighlights}

