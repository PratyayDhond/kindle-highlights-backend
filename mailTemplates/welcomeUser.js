module.exports = function({ given_name, email }) {
  return {
    subject: 'Welcome to Our Kindle Clippings',
    text: `Hello ${given_name},

I'm Pratyay, the developer of Kindle Clippings — a project born from my own struggle with managing Kindle highlights.

Thanks for signing up! I hope the service makes your reading life easier.

As an early user, you’ve received 500 free Coins — our in-app currency to unlock premium features like exporting and organizing.

If you have any questions, suggestions, or spot any bugs, feel free to reach out at ${process.env.EMAIL_USER}.

Happy reading!

Regards,
Pratyay Dhond,
Creator, Kindle Clippings.`
  };
};