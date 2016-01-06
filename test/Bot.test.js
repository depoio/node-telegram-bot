var chai = require('chai')
  , should = chai.should()
  , Bot = require('../index');

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

  describe('GET request', function () {
    it('should have _get function', function (done) {
      bot._get.should.exist;
      done();
    });

    it('getMe should throw 401 when using bad token', function (done) {
      this.slow(1500);
      bot._get({ method: 'getMe' })
      .then(function (res) {
        console.log(res);
        res.body.should.be.an('object');
        res.body.ok.should.not.be.ok;
        res.body.error_code.should.equal(401);
        res.body.description.should.equal('[Error]: Unauthorized');
        done();
      })
      .catch(function (err) {
        should.not.exist(err);
        console.error(err);
      });
    });
  });
});
