const e = require("express");


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
    const threshold = process.env.SIMILARITY_THRESHOLD || 0.8;
    if(similarityScore >= threshold) {
        // console.log(`Highlights are similar: ${highlight1} | ${highlight2} | Score: ${similarityScore}`);
        simScoreCount++;
    }
    // Return true if the similarity score is above the threshold
    return similarityScore >= threshold;
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


function dataToArray(data) {
  return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}


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

function parsePageLocationTimestampHighlightType(data) {
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
    
    if( data.search("Your Note on") !== -1 || data.search("Your note on") !== -1) {
        quoteType = 'note';
    }
    else if( data.search("Your Highlight on") !== -1 || data.search("Your highlight on") !== -1) {
        quoteType = 'highlight';
    }
    else if( data.search("Your Bookmark on") !== -1 || data.search("Your bookmark on") !== -1) {
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
        timestamp: timestamp, // To be deprecated when knowledge_begin_date is used globally
        knowledge_begin_date: new Date(timestamp), // Assuming timestamp is in a valid format
        knowledge_end_date: null, // Initially set to null
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

module.exports = {areHighlightsSimilar, getSimilarityScore, parseLocation, dataToArray, parseBookNameAndAuthor, parsePageLocationTimestampHighlightType, bookExists, createBook, addUserHighlightInBook, simScoreCount};