var Bot = require('../index')

describe('Telegram Bot client general test', function () {
  it('should instantiate Telegram Bot client', function (done) {
    var bot = new Bot();
    console.log(bot);
    done();
  });
});
