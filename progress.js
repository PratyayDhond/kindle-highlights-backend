const progressMap = {};
var bookCount = 0;

function setProgress(jobId, value) {
  progressMap[jobId] = Number(value.toFixed(2));
}

function getProgress(jobId) {
  return progressMap[jobId] || 0;
}

function setBookCount(count) {
  bookCount = count;
}

function getBookCount() {
  return bookCount;
}

function deleteProgress(jobId) {
  delete progressMap[jobId];
}

module.exports = {
  setProgress,
  setBookCount,
  getBookCount,
  getProgress,
  progressMap,
  deleteProgress,
};

