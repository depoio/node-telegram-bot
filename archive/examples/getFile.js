'use strict';

var Bot = require('../lib/Bot');

var bot = new Bot({
  token: 'TOKEN_HERE'
})
.on('message', function (message) {
  console.log(message);
  if (message.sticker) {
    bot.getFile({
      file_id: message.sticker.file_id,
      dir: '.'
    })
    .then(function (res) {
      console.log(res);
    });
  }
})
.on('error', function (err) {
  console.error(err);
})
.start();
