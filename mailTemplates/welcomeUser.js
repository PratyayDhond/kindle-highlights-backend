module.exports = function({ given_name, email }) {
  return {
    subject: 'Welcome to Our Kindle Clippings',
    text: `Hello ${given_name},

I'm Pratyay, the developer of Kindle Clippings — a project born from my own struggle with managing Kindle highlights.

Thanks for signing up! I hope the service makes your reading life easier.

As an early user, you’ve received 500 free Biblions — our in-app currency to unlock premium features like exporting and organizing.

What’s a Biblion?
It’s Greek for “book” or “scroll” — a name that reflects our shared love for reading.

If you have any questions, suggestions, or spot any bugs, feel free to reach out at ${process.env.EMAIL_USER}.

Happy reading!

Regards,
Pratyay Dhond,
Creator, Kindle Clippings.`
  };
};