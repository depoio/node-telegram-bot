## Changelog

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