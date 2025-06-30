const cron = require('cron');
const https = require('https');
const http = require('http');

const backendUrl = process.env.BACKEND_URL || 'localhost:3000';

function keepAliveWithRetry(url) {
  https.get(url, (res) => {
    if (res.statusCode === 200) {
      console.log('Server is alive');
    } else if (res.statusCode !== 200) {
      console.error('Server did not respond. Retrying in 1 minute...');
      setTimeout(() => keepAliveWithRetry(url), 60 * 1000);
    } else {
      console.error(`Server responded with status code: ${res.statusCode}`);
    }
  }).on('error', (err) => {
    console.error('Error keeping server alive:', err.message);
    // Optionally retry on network errors as well:
    setTimeout(() => keepAliveWithRetry(url), 60 * 1000);
  });
}

const job = new cron.CronJob('*/14 * * * *', function () {
  console.log('Keeping Server Alive - cron job running every 14 minutes');
  keepAliveWithRetry(backendUrl);
});

module.exports = {
  job,
  startCronJob: () => {
    job.start();
    console.log('Cron job started');
  },
  stopCronJob: () => {
    job.stop();
    console.log('Cron job stopped');
  }
};