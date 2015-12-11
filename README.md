node-telegram-bot
=================
[![build status](https://img.shields.io/travis/depoio/node-telegram-bot.svg?style=flat-square)](https://travis-ci.org/depoio/node-telegram-bot)[![dependencies](https://img.shields.io/david/depoio/node-telegram-bot.svg?style=flat-square)](https://david-dm.org/depoio/node-telegram-bot)[![node version](https://img.shields.io/node/v/gh-badges.svg?style=flat-square)](https://www.npmjs.com/package/node-telegram-bot)[![npm version](http://img.shields.io/npm/v/gh-badges.svg?style=flat-square)](https://www.npmjs.com/package/node-telegram-bot)

## Changelog

- 0.1.9 Improved error 409 by kaminoo
- 0.1.8 Timeout defaults to 60000ms
- 0.1.7 Supports splitting command target (#45)
- 0.1.6 Fixes #53
- 0.1.5 Add analytics botan.io
- 0.1.4 Fixes #48
- 0.1.2 Merge #40, Use debug for logging
- 0.1 Setwebhook, disable command parsing & maxattempts
- 0.0.19 Added webhook support instead of polling
- 0.0.18 Merged bug fix
- 0.0.17 support multiple command arguments
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

## Documentation

Documentation is built using jsdoc with DocStrap. More to come (including examples)!
[Documentation Link](http://depoio.github.io/node-telegram-bot/Bot.html)

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

## How to use Botan.io analytics:
```javascript

var bot = new Bot({
  token: 'Telegram token'
})
.enableAnalytics('Botan.io token')
.on('message', function (message) {
  console.log(message);
})
.start();

```

## Credits
[Sample sound](http://www.bigsoundbank.com/sound-0477-wilhelm-scream.html)
