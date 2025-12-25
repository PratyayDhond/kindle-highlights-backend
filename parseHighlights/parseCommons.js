const e = require("express");


var simScoreCount = 0;

function areHighlightsSimilar(highlight1, highlight2) {
    try {
        if (!highlight1 || !highlight2) return false;
        
        // Normalize strings to handle Unicode consistently
        const h1 = typeof highlight1 === 'string' && highlight1.normalize ? highlight1.normalize('NFC') : highlight1;
        const h2 = typeof highlight2 === 'string' && highlight2.normalize ? highlight2.normalize('NFC') : highlight2;
        
        if (h1.trim() === '' && h2.trim() === '') return true;
        if (h1 === h2) return true;

        if (h1.includes(h2) || h2.includes(h1))
            return true;

        const similarityScore = getSimilarityScore(h1, h2);

        const threshold = process.env.SIMILARITY_THRESHOLD || 0.7;
        if(similarityScore >= threshold) {
            // console.log(`Highlights are similar: ${h1} | ${h2} | Score: ${similarityScore}`);
            simScoreCount++;
        }
        return similarityScore >= threshold;
    } catch (err) {
        console.error('[parseCommons] areHighlightsSimilar failed', {
            err: err.message,
            h1Preview: highlight1?.slice(0, 40),
            h2Preview: highlight2?.slice(0, 40)
        });
        // On error, treat as not similar
        return false;
    }
}

// a function to return similarity scores between two texts
function getSimilarityScore(text1, text2){
    try {
        if (!text1 || !text2) return 0;
        const set1 = new Set(text1.toLowerCase().split(/\s+/));
        const set2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        if (union.size === 0) return 0;
        return intersection.size / union.size;
    } catch (err) {
        console.error('[parseCommons] getSimilarityScore failed', {
            err: err.message,
            t1Preview: text1?.slice(0, 30),
            t2Preview: text2?.slice(0, 30)
        });
        return 0;
    }
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
  try {
    if (!data || typeof data !== 'string') {
      console.error('[parseCommons] dataToArray received invalid data', { type: typeof data });
      return [];
    }
    // Normalize Unicode before splitting to handle special characters consistently
    const normalized = data.normalize ? data.normalize('NFC') : data;
    return normalized.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (err) {
    console.error('[parseCommons] dataToArray failed', { 
      err: err.message, 
      dataPreview: data?.slice(0, 100) 
    });
    // Fallback: try without normalization
    try {
      return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    } catch {
      return [];
    }
  }
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