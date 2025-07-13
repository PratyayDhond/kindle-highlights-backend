newHighlightsForTest = [
    { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 26 } },
    { highlight: 'B', type: 'highlight', page: '4', location: { start: 12, end: 24 } },
    { highlight: 'C', type: 'highlight', page: '3', location: { start: 15, end: 23 } },
    { highlight: 'D', type: 'note', page: '2', location: { start: 18, end: 22 } },
    { highlight: 'E', type: 'highlight', page: '5', location: { start: 17, end: 29 } }
]

highlightsOnCloudForTest = [
    { highlight: 'A', type: 'highlight', page: '1', location: { start: 1, end: 26 } },
    { highlight: 'B', type: 'highlight', page: '4', location: { start: 12, end: 24 } },
    { highlight: 'C', type: 'highlight', page: '3', location: { start: 15, end: 23 } },
    { highlight: 'F', type: 'note', page: '21', location: { start: 118, end: 221 } },
    { highlight: 'G', type: 'highlight', page: '51', location: { start: 117, end: 219 } }
]

module.exports = {
    newHighlightsForTest,
    highlightsOnCloudForTest
}
