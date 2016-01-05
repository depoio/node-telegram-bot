var chai = require('chai')
  , nock = require('nock')
  , should = chai.should()
  , Bot = require('../lib/Bot');

var TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

describe('Telegram Bot client general test', function () {
  var bot;

  before(function (done) {
    bot = new Bot({ token: TOKEN });
    done();
  });

  it('should instantiate Telegram Bot client with correct token and values', function (done) {
    bot.base_url.should.equal('https://api.telegram.org/');
    bot.polling.should.equal(false);
    bot.token.should.equal(TOKEN);
    done();
  });

  it('should have the essential functions', function (done) {
    bot._get.should.exist;
    bot._multipart.should.exist;
    bot._poll.should.exist;
    done();
  });
});

