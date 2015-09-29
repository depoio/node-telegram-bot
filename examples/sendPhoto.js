
var Bot = require('../lib/Bot')
  , fs = require('fs');

bot.sendPhoto({
  chat_id: USER_ID,
  caption: 'Telegram Logo',
  files: {
    photo: './examples/logo.png'
  }
}, function (err, msg) {
  console.log(err);
  console.log(msg);
});
