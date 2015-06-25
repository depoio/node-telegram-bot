var Bot = require('./lib/Bot');

var bot = new Bot({
  token: 'TOKEN HERE'
})
.on('message', function (message) {
  console.log(message);
})
.start();