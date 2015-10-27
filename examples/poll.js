var Bot = require('../lib/Bot');

var bot = new Bot({
  token: 'TOKEN_HERE'
})
.on('message', function (message) {
  console.log(message);
})
.on('stop', function (message) {
  console.log('stop');
  bot.stop();
})
.on('start', function (message) {
  bot.start();
})
.on('error', function (message) {
  console.log(message);
})
.start();
