const cron = require('cron');
const https = require('https');
const http = require('http');

const backendUrl = process.env.BACKEND_URL || 'localhost:3000';
const job = new cron.CronJob('*/14 * * * *', function () {
  console.log('Keeping Server Alive - cron job running every 14 minutes');

  https.get(backendUrl, (res) => {
    if(res.statusCode === 200) {
      console.log('Server is alive');
    } else {
      console.error(`Server responded with status code: ${res.statusCode}`);
    }
  }).on('error', (err) => {
    console.error('Error keeping server alive:', err.message);
  });
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