node-telegram-bot
=================
[![build status](https://img.shields.io/travis/depoio/node-telegram-bot.svg?style=flat-square)](https://travis-ci.org/depoio/node-telegram-bot)[![dependencies](https://img.shields.io/david/depoio/node-telegram-bot.svg?style=flat-square)](https://david-dm.org/depoio/node-telegram-bot)[![node version](https://img.shields.io/node/v/gh-badges.svg?style=flat-square)](https://www.npmjs.com/package/node-telegram-bot)[![npm version](http://img.shields.io/npm/v/gh-badges.svg?style=flat-square)](https://www.npmjs.com/package/node-telegram-bot)

## Changelog

- 0.0.16 support file id for audio, document, sticker and video
- 0.0.15 emit command (message that starts with '/')
- 0.0.14 sendLocation
- 0.0.13 getUserProfilePhotos
- 0.0.12 sendDocument
- 0.0.9 sendAudio
- 0.0.8 sendPhoto
- 0.0.7 forwardMessage
- 0.0.6 sendChatAction
- 0.0.3 Longpoll
- 0.0.2 getMessage
- 0.0.1 getMe

## Sending files (including photo, audio, document, video and sticker) 

Now only require filepath,

```javascript

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

```


Previously, 

```javascript

bot.sendPhoto({
  chat_id: USER_ID,
  caption: 'Telegram Logo',
  files: {
    photo: {
      filename: './examples/logo.png',
      stream: fs.createReadStream('./examples/logo.png')
    }
  }
}, function (err, msg) {
  console.log(err);
  console.log(msg);
});

```



## Here's an example:

```javascript

var Bot = require('node-telegram-bot');

var bot = new Bot({
  token: 'TOKEN HERE'
})
.on('message', function (message) {
  console.log(message);
})
.start();

```