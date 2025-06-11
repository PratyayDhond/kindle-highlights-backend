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
    var location = '';
    var timestamp = '';
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
            location += data[i];    
            i++;
        }
    }

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
    const highlightObject = {
        highlight: highlight,
        page: page,
        location: location,
        timestamp: timestamp,
        type: type
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
    var location = '';
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

        // Creating Book if not already exists
        
        book = bookExists(books, bookName)
        if(book === -1){
            createBook(books, bookName, author);
            book = bookExists(books, bookName); // confirm the book was created and return book object
        }

        addUserHighlightInBook(books, bookName, author, currentNote, page, location, timestamp, currentNoteType);

        currentNote = ''
        // Check if the next line is a separator or empty
        while(i < rawData.length && (rawData[i].trimRight() === '' || rawData[i].trimRight() === note_sep)) {
            i++;
        }
    }
    setBookCount(books.length);
     console.log('Parsing completed. Total books:', books.length);
    return books;
}

function dataToArray(data) {
  return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}


module.exports = {parseHighlights}