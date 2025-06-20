const { Worker } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const {setProgress, getBookCount, getProgress} = require('./progress.js');

function createMarkdownFiles(highlights, jobId) {
    console.timeLog('getHighlightsZip', 'Started createMarkdownFiles');

    const totalProgessForThisModule = 15
    const bookCount = getBookCount();
    const progressPerBook = totalProgessForThisModule / bookCount;
     console.log(`Progress per book: ${progressPerBook}`);
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
        setProgress(jobId, getProgress(jobId) + progressPerBook);
         console.log(`CURRENT PROGRESS: ${getProgress(jobId)}`);        
         console.log(`Created markdown content for: ${name}`);
        // tasks.push(limit(() => runPdfWorker(content, dest)));
    }

    console.timeLog('getHighlightsZip', 'Finished createMarkdownFiles');
    return markdownContent;
}

async function createPdfsFromMarkdownList(markdownContent, jobId) {
    console.timeLog('getHighlightsZip', 'Started createPdfsFromMarkdownList');

    const totalProgessForThisModule = 70
    const bookCount = getBookCount();
    const progressPerBook = totalProgessForThisModule / bookCount;
     console.log(`Progress per book: ${progressPerBook}`);

    if (!fs.existsSync('./highlights')) fs.mkdirSync('./highlights');

    for (const { name, content } of markdownContent) {
        const dest = `./highlights/${name}.pdf`;
        await mdToPdf(
          { content },
          {
            dest,
            launch_options: {
              args: ['--no-sandbox'],
              headless: 'new' // Optional, but recommended for future compatibility
            }
          }
        );
        setProgress(jobId, getProgress(jobId) + progressPerBook);
         console.log(`PDF created for: ${name}`);
    }
    console.timeLog('getHighlightsZip', 'Finished createPdfsFromMarkdownList');
}

async function getHighlightsZip(highlights, jobId) {
    console.time('getHighlightsZip');
    const markdownContentList = createMarkdownFiles(highlights, jobId);
     console.log("Current Progress:", getProgress(jobId));
    await createPdfsFromMarkdownList(markdownContentList, jobId);
    // Create a zip file containing all the PDF files
    const zip = require('adm-zip');
    const zipFilePath = `./${jobId}.zip`; // update this with username-clippings.zip in future for multiple users.
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