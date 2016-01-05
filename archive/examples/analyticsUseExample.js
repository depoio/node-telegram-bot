var Bot = require('../lib/Bot');
var tokenBotanIO = '1234qwer-tyuio-56789-asdf';
var tokenTelegram = '123456789:qwertyuiopasdf';

var bot = new Bot({
  token: tokenTelegram
})
.enableAnalytics(token)
.on('message', function (message) {
  // Not necessary use analytics.track
  if (message.text == '/levelup') {
    this.analytics.track(message, 'Get new level');
  }
  if (message.text == '/exit') {
    this.analytics.track(message, 'Left users');
  }
}})
.start();