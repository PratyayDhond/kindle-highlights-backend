const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');

async function createMarkdownFiles(highlights) {
    var highlightNumberFlag = false;
    for (const book of highlights) {
        const name = book.name;
        const author = book.author;

        var content = "# " + name + "\n";
        if (author) {
            content += "~ ***" + author + "***\n";
        }
        content += "---  \n\n\n\n";
        var highlightCount = 0;
        var noteCount = 0;
        book.highlights.forEach((highlight, index) => {
            // if(highlight.type !== 'unknown' && highlight.type !== 'bookmark '){
            //     // content += `## Highlight ${index + 1}\n`;
            //     if(highlight.type === 'highlight') {
            //         highlightCount++;
            //     } else if(highlight.type === 'note') {
            //         noteCount++;
            //     }
            //     const quotedHighlight = highlight.highlight
            //         .split('\n')
            //         .map(line => `> ${line}`)
            //         .join('\n');
            //     content += `${quotedHighlight}\n\n`;
            //     content += `<p style="line-height: 1;">${highlight.type === 'highlight' ? `Highlight ${highlightCount}` : `Note ${noteCount}`}`
            //     if (highlight.page !== '')
            //         content += `, Page ${highlight.page}`;
            //     if (highlight.location !== '')
            //         content += `, Location: ${highlight.location}`;
            //     content += `, Added on ${highlight.timestamp}`;
            //     content += `</p>\n\n\n\n`;
            // }

            if (highlight.type !== 'unknown' && highlight.type !== 'bookmark ') {
    if (highlight.type === 'highlight') {
        highlightCount++;
    } else if (highlight.type === 'note') {
        noteCount++;
    }

    // Format the quoted text
    const quotedHighlight = highlight.highlight
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');

    // Add the quoted highlight
    content += `${quotedHighlight}\n\n`;

    // Generate metadata line
    const label = highlight.type === 'highlight'
        ? `**Highlight ${highlightCount}**`
        : `**Note ${noteCount}**`;

    let metadata = `${label}`;
    if (highlight.page !== '') {
        metadata += ` &nbsp;|&nbsp; Page ${highlight.page}`;
    }
    if (highlight.location !== '') {
        metadata += ` &nbsp;|&nbsp; Location ${highlight.location}`;
    }
    metadata += ` &nbsp;|&nbsp; *Added on ${highlight.timestamp}*`;

    // Wrap metadata in a paragraph for separation
    content += `${metadata}\n\n---\n\n&nbsp;\n\n\n`;
}

        });

        console.log(content)
        if (!fs.existsSync('./highlights'))
           fs.mkdirSync('./highlights'); // update this to create user specific directories
        await mdToPdf({content: content}, {dest: `./highlights/${name}.pdf`});
    }    
}

function getHighlightsZip(highlights) {
    createMarkdownFiles(highlights)

}

module.exports = getHighlightsZip;