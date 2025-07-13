// Mock console.log to suppress MongoDB connection logs during testing
const originalConsoleLog = console.log;
console.log = jest.fn();

const { compareHighlights, checkForNewHighlights } = require('../server');
const {newHighlightsForTest, highlightsOnCloudForTest } = require('./assets/highlightsData')
const {cleanEmail} = require('../auth.js')
// Restore console.log after import
console.log = originalConsoleLog;

describe('compareHighlights', () => {
  it('returns true for identical highlights', () => {
    const h1 = { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 2 } };
    const h2 = { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 2 } };
    console.log('Comparing highlights:', h1, h2);
    console.log('Comparison result:', compareHighlights(h1, h2));
    expect(compareHighlights(h1, h2)).toBe(true);
  });

  it('returns false for different highlights', () => {
    const h1 = { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 2 } };
    const h2 = { highlight: 'B', type: 'highlight', page: '2', location: { start: 3, end: 4 } };
    expect(compareHighlights(h1, h2)).toBe(false);
  });

  it('returns true for new highlights on local array', () => {
    expect(checkForNewHighlights(newHighlightsForTest, highlightsOnCloudForTest)).toBe(true);
  });

  it('returns false for same highlights array on both local and cloud', () => {
    expect(checkForNewHighlights(newHighlightsForTest, newHighlightsForTest)).toBe(false);
    expect(checkForNewHighlights(newHighlightsForTest, newHighlightsForTest)).toBe(false);
  });

  it('returns false for jumbled but same highlights', () => {
    const newHighlights = [...newHighlightsForTest]
    const sortedNewHighlights = [...newHighlightsForTest].sort((a,b) => {
      if(parseInt(a.page) < parseInt(b.page))
          return -1;
      if(parseInt(a.page) > parseInt(b.page))
          return 1;
      return 0;
    })
    expect(checkForNewHighlights(sortedNewHighlights, newHighlights)).toBe(false);
  })

  it('returns email without characters after `+` symbol', () => {
    expect(cleanEmail('test+123@test.com')).toBe('test@test.com')
  })

  it('returns email as it is for correct email', () => {
    expect(cleanEmail('test@test.com')).toBe('test@test.com');
  })

  it('returns null for invalid email', () => {
    expect(cleanEmail('test@test@test.com')).toBe(null);
    expect(cleanEmail('invalidEmail')).toBe(null);
  })


});