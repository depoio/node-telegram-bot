/**
 * Created by longstone on 28/06/15.
 */
'use strict';

var fs = require('fs');
var Bot = require('../lib/Bot');

/**
 * this sample helps understand how the bot works, can also be used for integration tests ;)
 */
var bot = new Bot({
  token: 'TOKEN_HERE'
})
.on('message', function (message) {
  switch (message.text) {
    case "/sendMessage":
      bot.sendMessage({
        chat_id: message.chat.id,
        text: 'echo : ' + message.text
      });
      break;
    case "/sendPhoto":
      bot.sendPhoto({
        chat_id: message.chat.id,
        caption: 'trololo',
        files: {
          photo: './logo.png'
        }
      });
      break;
    case "/sendDocument":
      bot.sendDocument({
        chat_id: message.chat.id,
        files: {
          filename: 'scream',
          contentType: 'audio/ogg',
          stream: fs.createReadStream('./0477.ogg')
        }
      }, console.error);
      break;
    case "/sendLocation":
      bot.sendLocation({
        chat_id: message.chat.id,
        latitude: -27.121192,
        longitude: -109.366424,
        reply_to_message_id: message.message_id
      });
      break;
  }
})
.on('message', function (message) {
  console.log(message);
})
//Command without argument
.on('test', function (message){
  bot.sendMessage({
    chat_id: message.chat.id,
    text: 'You\'ve send command: ' + command
  });
})
//Command with argument:
.on('arg', function (args, message){
  bot.sendMessage({
    chat_id: message.chat.id,
    text: 'You\'ve send command with arguments: ' + args
  });
})
.start();
