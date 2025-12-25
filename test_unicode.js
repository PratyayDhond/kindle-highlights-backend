const m = require('./parseHighlights/parseKindleExtensionHighlights.js');

const testHighlights = [
    {
        highlight: 'The Hamming distance d(000, 011) is 2 because (000 ⊕ 011) is 011 (two 1s)',
        timestamp: '2024-01-01',
        type: 'highlight',
        page: '1',
        location: { start: 1, end: 2 }
    },
    {
        highlight: 'the minimum distance between the valid • codes must be (s + 1), so that the received codeword does not match a valid codeword.',
        timestamp: '2024-01-02',
        type: 'highlight',
        page: '2',
        location: { start: 3, end: 4 }
    },
    {
        highlight: 'Test with emoji 😊 and other special chars',
        timestamp: '2024-01-03',
        type: 'highlight',
        page: '3',
        location: { start: 5, end: 6 }
    }
];

console.log('Testing with multiple Unicode characters: ⊕ • 😊');
const res = m.purgeOverlappingHighlights(testHighlights);
console.log('Success! Processed', res.length, 'highlight(s)');
res.forEach((h, i) => {
    console.log(`${i + 1}. ${h.highlight?.slice(0, 80)}`);
});
