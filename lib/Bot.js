var request = require('request')
  , qs = require('querystring')
  , Q = require('q');

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

  if (options.params) {
    url += '?' + qs.stringify(options.params);
  }

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
  var self = this
    , deferred = Q.defer();

  this.get({ method: 'getMe' }, function (err, res) {
    if (err) {
      return deferred.reject(res);
    }

    if (res.ok) {
      self.id = res.result.id;
      self.first_name = res.result.first_name;
      self.username = res.result.username;

      deferred.resolve(res.result);
    } else {
      deferred.reject(res);
    }
  });

  return deferred.promise.nodeify(callback);
};

Bot.prototype.sendMessage = function (options, callback) {
  var self = this;

  this.get({ 
    method: 'sendMessage',
    params: {
      chat_id: options.chat_id,
      text: options.text
    }
  }, function (err, res) {
    if (err) {
      return deferred.reject(res);
    }

    if (res.ok) {
      deferred.resolve(res.result);
    } else {
      deferred.reject(res);
    }
  });

  return deferred.promise.nodeify(callback);
};

module.exports = Bot;