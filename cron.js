const cron = require('cron');
const https = require('https');

const sendNewsletter = require('./utils/sendNewsletter')

const backendUrl = process.env.BACKEND_URL || 'localhost:3000';
const NEWSLETTER_CRON_STRING = process.env.NEWSLETTER_CRON_STRING || '0 6-23 * * *'; // Default to run every day at 6 AM

// Deprecated as we have moved away from RENDER to Google AppCloud
// function keepAliveWithRetry(url) {
//   https.get(url, (res) => {
//     if (res.statusCode === 200) {
//       console.log('Server is alive');
//     } else if (res.statusCode !== 200) {
//       console.error('Server did not respond. Retrying in 1 minute...');
//       setTimeout(() => keepAliveWithRetry(url), 60 * 1000);
//     } else {
//       console.error(`Server responded with status code: ${res.statusCode}`);
//     }
//   }).on('error', (err) => {
//     console.error('Error keeping server alive:', err.message);
//     setTimeout(() => keepAliveWithRetry(url), 60 * 1000);
//   });
// }

// const job = new cron.CronJob('*/14 * * * *', function () {
//   console.log('Keeping Server Alive - cron job running every 14 minutes');
//   keepAliveWithRetry(backendUrl);
// });

// const newsletterJob = new cron.CronJob('0 6-23 * * *', function () {
// for testing purpose
const newsletterJob = new cron.CronJob(NEWSLETTER_CRON_STRING, function () {
  console.log('Newsletter cron job triggered.');
  sendNewsletter();
}, null, true, 'Asia/Kolkata');

module.exports = {
  job,
  startCronJob: () => {
    job.start();
    console.log('Cron job started');
  },
  stopCronJob: () => {
    job.stop();
    console.log('Cron job stopped');
  },
  newsletterJob,
  startNewsletterJob: () => {
    newsletterJob.start();
    console.log('Newsletter cron job started');
  },
  stopNewsletterJob: () => {
    newsletterJob.stop();
    console.log('Newsletter cron job stopped');
  }
};