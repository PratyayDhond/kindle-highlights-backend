function formatDate(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

module.exports = function({ given_name, highlights }) {

  let highlightsCount = highlights.length;
  // Prepare plain text highlights
  const highlightsText = highlights.map((h, i) =>
    `\n${i + 1}. "${h.highlight}"` +
    (h.location?.start ? ` | Location: ${h.location.start}` : '') +
    (h.bookTitle ? ` | ${h.bookTitle}` : '') +
    (h.author ? ` | by ${h.author}` : '') +
    (h.timestamp ? ` | highlighted on ${formatDate(h.timestamp)}` : '')
  ).join('\n');

  // Prepare HTML highlights
  const highlightsHtml = highlights.map((h, i) =>
    `<blockquote style="margin: 0 0 16px 0; padding-left: 12px; border-left: 3px solid #eee;">
      <b>${i + 1}.</b>
      <pre style="background: #f4f4f4; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 14px; white-space: pre-wrap; margin: 8px 0 4px 0;">${h.highlight}</pre>
      <span style="color: #555; font-size: 13px;">
        Location: ${h.location?.start ?? ''} ${h.bookTitle ? ` | ${h.bookTitle}` : ''} ${h.author ? ` | by ${h.author}` : ''} ${h.timestamp ? ` | highlighted on ${formatDate(h.timestamp)}` : ''}
      </span>
    </blockquote>`
  ).join('');

  return {
    subject: 'Your Kindle Clippings Highlights Newsletter',
    text: `Hello ${given_name},

I am Pratyay, the creator of Kindle Clippings — a project born from my own struggle with managing Kindle highlights.

Here are your ${highlightsCount} highlights for today's newsletter:

${highlightsText}

Happy reading!

Regards,
Pratyay Dhond,
Creator, Kindle Clippings.

Connect with me:
LinkedIn: https://www.linkedin.com/in/pratyaydhond
GitHub: https://github.com/pratyaydhond
Second Brain: https://pratyaydhond.github.io/secondBrain/

Newsletter sent on ${formatDate(new Date())}

If you no longer wish to receive these newsletters, please update your preferences in your account settings: ${FRONTEND_URL}/newsletter/unsubscribe
`,
    html: `<div style="font-family: Arial, sans-serif; font-size: 15px; color:#2e2e2e;">
      <p>Hello ${given_name},</p>
      <p>I am Pratyay, the creator of Kindle Clippings — a project born from my own struggle with managing Kindle highlights.</p>

      <p>Here are your ${highlightsCount} highlights for today's newsletter:</p>
      <p>Happy reading!</p>
      <br>
      ${highlightsHtml}

      <p>Regards,<br>
      Pratyay Dhond,<br>
      Creator, <a href="https://kindle-clippings.pages.dev/" target="_blank">Kindle Clippings</a>.</p>
      <p>
        <b>Connect with me:</b><br>
        <a href="https://www.linkedin.com/in/pratyaydhond" target="_blank">LinkedIn</a> | 
        <a href="https://github.com/pratyaydhond" target="_blank">GitHub</a> | 
        <a href="https://pratyaydhond.github.io/secondBrain/" target="_blank">My Second Brain</a>
      </p>
      <p style="font-size: 12px; color:#2e2e2e;">Newsletter sent on ${formatDate(new Date())}</p>
      <p style="font-size: 12px; color:#2e2e2e;">If you no longer wish to receive these newsletters, please update your preferences in your <a href="${FRONTEND_URL}/newsletter/unsubscribe" target="_blank">account settings</a>.</p>
    </div>`
  };
};