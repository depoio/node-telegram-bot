
var Bot = require('./lib/Bot')
  , fs = require('fs');

bot.sendPhoto({
  chat_id: USER_ID,
  caption: 'Telegram Logo',
  files: {
    photo: {
      filename: 'logo.png',
      stream: fs.createReadStream('./examples/logo.png')
    }
  }
}, function (err, msg) {
  console.log(err);
  console.log(msg);
});
