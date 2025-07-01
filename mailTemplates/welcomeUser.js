module.exports = function({ given_name, email }) {
  return {
    subject: 'Welcome to Our Kindle Clippings',
    text: `Hello ${given_name},

I'm Pratyay, the developer of Kindle Clippings — a project born from my own struggle with managing Kindle highlights.

Thanks for signing up! I hope the service makes your reading life easier.

As an early user, you’ve received ${process.env.FREE_SIGNUP_COINS} free Coins — our in-app currency to unlock premium features like exporting and organizing.

If you have any questions, suggestions, or spot any bugs, feel free to reach out at ${process.env.EMAIL_USER}.

Connect with me:
LinkedIn: https://www.linkedin.com/in/pratyaydhond
GitHub: https://github.com/pratyaydhond
Second Brain: https://pratyaydhond.github.io/secondBrain/

Happy reading!

Regards,
Pratyay Dhond,
Creator, Kindle Clippings.`,
    html: `<div style="font-family: Arial, sans-serif; font-size: 15px; color: #2e2e2e;">
      <p>Hello ${given_name},</p>
      <p>I'm Pratyay, the developer of Kindle Clippings — a project born from my own struggle with managing Kindle highlights.</p>
      <p>Thanks for signing up! I hope the service makes your reading life easier.</p>
      <p>As an early user, you’ve received <b>${process.env.FREE_SIGNUP_COINS} free Coins</b> — our in-app currency to unlock premium features like exporting and organizing.</p>
      <p>If you have any questions, suggestions, or spot any bugs, feel free to reach out at <a href="mailto:${process.env.EMAIL_USER}">${process.env.EMAIL_USER}</a>.</p>
      <p>
        <b>Connect with me:</b><br>
        <a href="https://www.linkedin.com/in/pratyaydhond" target="_blank">LinkedIn</a> | 
        <a href="https://github.com/pratyaydhond" target="_blank">GitHub</a> | 
        <a href="https://pratyaydhond.github.io/secondBrain/" target="_blank">Second Brain</a>
      </p>
      <p>Happy reading!</p>
      <br>
      <p>Regards,<br>
      Pratyay Dhond,<br>
      Creator, Kindle Clippings.</p>
    </div>`
  };
};