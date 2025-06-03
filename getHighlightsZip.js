const { Worker } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
// const pLimit = require('p-limit');
// const limit = pLimit(3); // Try 2 or 3, adjust as needed

// function runPdfWorker(content, dest) {
//     return new Promise((resolve, reject) => {
//         const worker = new Worker(path.join(__dirname, 'pdfWorker.js'));
//         worker.postMessage({ content, dest });
//         worker.on('message', (msg) => {
//             if (msg.success) resolve(msg.dest);
//             else reject(new Error(msg.error));
//         });
//         worker.on('error', reject);
//         worker.on('exit', (code) => {
//             if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
//         });
//     });
// }

function createMarkdownFiles(highlights) {
    console.timeLog('getHighlightsZip', 'Started createMarkdownFiles');

    const markdownContent = [];
    for (const book of highlights) {
        const name = book.name;
        const author = book.author;

        let content = "# " + name + "\n";
        if (author) content += "~ ***" + author + "***\n";
        content += "---  \n\n\n\n";
        let highlightCount = 0;
        let noteCount = 0;

        book.highlights.forEach((highlight, index) => {
            if (highlight.type !== 'unknown' && highlight.type !== 'bookmark ') {
                if (highlight.type === 'highlight') highlightCount++;
                else if (highlight.type === 'note') noteCount++;

                const quotedHighlight = highlight.highlight
                    .split('\n')
                    .map(line => `> ${line}`)
                    .join('\n');
                content += `${quotedHighlight}\n\n`;

                const label = highlight.type === 'highlight'
                    ? `**Highlight ${highlightCount}**`
                    : `**Note ${noteCount}**`;

                let metadata = `${label}`;
                if (highlight.page !== '') metadata += ` &nbsp;|&nbsp; Page ${highlight.page}`;
                if (highlight.location !== '') metadata += ` &nbsp;|&nbsp; Location ${highlight.location}`;
                metadata += ` &nbsp;|&nbsp; *Added on ${highlight.timestamp}*`;

                content += `${metadata}\n\n&nbsp;\n\n\n`;
            }
        });
        markdownContent.push({ name, content });
        console.log(`Created markdown content for: ${name}`);
        // tasks.push(limit(() => runPdfWorker(content, dest)));
    }

    console.timeLog('getHighlightsZip', 'Finished createMarkdownFiles');
    return markdownContent;
}

async function createPdfsFromMarkdownList(markdownContent) {
    console.timeLog('getHighlightsZip', 'Started createPdfsFromMarkdownList');
    if (!fs.existsSync('./highlights')) fs.mkdirSync('./highlights');

    for (const { name, content } of markdownContent) {
        const dest = `./highlights/${name}.pdf`;
        console.log('Creating PDF for:', name);
        await mdToPdf({ content }, { dest });
    }
    console.timeLog('getHighlightsZip', 'Finished createPdfsFromMarkdownList');
}

async function getHighlightsZip(highlights) {
    console.time('getHighlightsZip');
    const markdownContentList = createMarkdownFiles(highlights);
    await createPdfsFromMarkdownList(markdownContentList);
    // Create a zip file containing all the PDF files
    const zip = require('adm-zip');
    const zipFilePath = './kindle-clippings.zip'; // update this with username-clippings.zip in future for multiple users.
    const zipFile = new zip();
    const files = fs.readdirSync('./highlights');
    files.forEach(file => {
        zipFile.addLocalFile(path.join('./highlights', file));
    });
    zipFile.writeZip(zipFilePath);
    console.log(`Highlights zip created at ${zipFilePath}`);
    
    // delete the individual PDF files
    files.forEach(file => {
        fs.unlinkSync(path.join('./highlights', file));
    });
    console.timeEnd('getHighlightsZip');
    return zipFilePath;
}

module.exports = getHighlightsZip;