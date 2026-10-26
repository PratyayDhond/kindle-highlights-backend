const fs = require('fs');
const path = require('path');
const { parseHighlights } = require('../parseHighlights/parseHighlights');

describe('parseHighlights', () => {
  it('parses the supplied Kindle clippings export without dropping highlights', () => {
    const filePath = path.join(__dirname, '..', 'My Clippings.txt');
    const result = parseHighlights(fs.readFileSync(filePath, 'utf8'));

    expect(result.status).not.toBe('error');
    expect(result.highlights).toHaveLength(9);
    expect(result.stats.totalHighlights).toBeGreaterThan(0);
    expect(result.highlights[0].highlights[0].highlight).toContain('invested money');
    expect(result.highlights[0].highlights[0].highlight).not.toContain('Your Highlight on');

    const psychoCybernetics = result.highlights.find(book => book.name === 'Psycho-Cybernetics (Updated and Expanded)');
    expect(psychoCybernetics.highlights.some(highlight => highlight.location.start === 484)).toBe(true);
  });
});
