const { compareHighlights } = require('../server')
const { expect } = require('chai');

describe('compareHighlights', () => {
  it('returns true for identical highlights', () => {
    const h1 = { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 2 } };
    const h2 = { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 2 } };
    expect(compareHighlights(h1, h2)).to.be.true;
  });
  it('returns false for different highlights', () => {
    const h1 = { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 2 } };
    const h2 = { highlight: 'B', type: 'highlight', page: '2', location: { start: 3, end: 4 } };
    expect(compareHighlights(h1, h2)).to.be.false;
  });
});