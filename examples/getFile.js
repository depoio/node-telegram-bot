'use strict';

var Bot = require('../lib/Bot');

var bot = new Bot({
  token: 'TOKEN_HERE'
})
.on('message', function (message) {
  console.log(message);
  if (message.sticker) {
    bot.getFile({
      file_id: message.sticker.file_id
    })
    .then(function (res) {
      console.log(res);
    });
  }
})
.start();
