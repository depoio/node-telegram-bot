var request = require('request');

//request.debug = true;

function Bot(options) {
  this.id = '';
  this.first_name = '';
  this.username = '';
  this.token = options.token;
  this.base_url = 'https://api.telegram.org/bot'
}

Bot.prototype.get = function (options, callback) {
  var url = this.base_url + this.token + '/' + options.method;

  request.get({
    url: url,
    json: true
  }, function (err, data, res) {
    if (err) {
      callback(err);
    } else {
      callback(null, res);
    }
  });

  return this;
};

Bot.prototype.getMe = function (callback) {
  var self = this;

  this.get({ method: 'getMe' }, function (err, res) {
    if (err) {
      return callback(err);
    }

    if (res.ok) {
      self.id = res.result.id;
      self.first_name = res.result.first_name;
      self.username = res.result.username;
      callback(null, res.result);
    } else {
      callback(res);
    }
  });
};

module.exports = Bot;