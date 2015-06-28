node-telegram-bot
=================
[![build status](https://img.shields.io/travis/depoio/node-telegram-bot.svg?style=flat-square)](https://travis-ci.org/depoio/node-telegram-bot)[![node version](https://img.shields.io/node/v/gh-badges.svg?style=flat-square)](https://www.npmjs.com/package/node-telegram-bot)[![npm version](http://img.shields.io/npm/v/gh-badges.svg?style=flat-square)](https://www.npmjs.com/package/node-telegram-bot)

## Changelog

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