var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , request = require('request')
  , qs = require('querystring')
  , Q = require('q')
  , mime = require('mime');

//request.debug = true;

function Bot(options) {
  this.base_url = 'https://api.telegram.org/bot';
  this.polling = false;

  this.id = '';
  this.first_name = '';
  this.username = '';
  this.token = options.token;
  this.offset = 0;
}

util.inherits(Bot, EventEmitter);

Bot.prototype._get = function (options, callback) {
  var url = this.base_url + this.token + '/' + options.method;

  if (options.params) {
    url += '?' + qs.stringify(options.params);
  }

  request.get({
    url: url,
    json: true
  }, function (err, res, body) {
    if (err) {
      callback(err);
    } else {
      callback(null, body);
    }
  });

  return this;
};

Bot.prototype._multipart = function (options, callback) {
  var url = this.base_url + this.token + '/' + options.method;

  var req = request.post(url, function (err, res, body) {
    if (err) {
      callback(err);
    } else {
      callback(null, body);
    }
  });

  var form = req.form();
  Object.keys(options.files).forEach(function(key) {
    var file = options.files[key];
    form.append(key, file.stream, {
      filename: file.filename,
      contentType: mime.lookup(file.filename)
    });
  });

  Object.keys(options.params).forEach(function(key) {
    form.append(key, options.params[key]);
  });
  
};

Bot.prototype._poll = function () {
  var self = this;
  var url = this.base_url + this.token + '/getUpdates?timeout=60&offset=' + this.offset;

  request.get({
    url: url,
    json: true
  }, function (err, res, body) {
    if (!err && res.statusCode === 200) {
      if (body.ok) {
        body.result.forEach(function (msg) {
          if (msg.update_id >= self.offset) {
            self.offset = msg.update_id + 1;
            self.emit('message', msg.message);
          }
        });
      }
    }

    if (self.polling) {
      self._poll();
    }
    
  });
}

Bot.prototype.start = function () {
  var self = this;

  self._poll();
  self.polling = true;

  return self;
};

Bot.prototype.stop = function () {
  var self = this;
  
  self.polling = false;

  return self;
};

Bot.prototype.getMe = function (callback) {
  var self = this
    , deferred = Q.defer();

  this._get({ method: 'getMe' }, function (err, res) {
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
  var self = this
    , deferred = Q.defer();

  this._get({ 
    method: 'sendMessage',
    params: {
      chat_id: options.chat_id,
      text: options.text
    }
  }, function (err, res) {
    if (err) {
      return deferred.reject(err);
    }

    if (res.ok) {
      deferred.resolve(res.result);
    } else {
      deferred.reject(res);
    }
  });

  return deferred.promise.nodeify(callback);
};

Bot.prototype.forwardMessage = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._get({
    method: 'forwardMessage',
    params: {
      chat_id: options.chat_id,
      from_chat_id: options.from_chat_id,
      message_id: options.message_id
    }
  }, function (err, res) {
    if (err) {
      return deferred.reject(err);
    }

    if (res.ok) {
      deferred.resolve(res.result);
    } else {
      deferred.reject(res);
    }
  });

  return deferred.prototype.nodeify(callback);
};

Bot.prototype.sendChatAction = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._get({ 
    method: 'sendChatAction',
    params: {
      chat_id: options.chat_id,
      action: options.action
    }
  }, function (err, res) {
    if (err) {
      return deferred.reject(err);
    }

    if (res.ok) {
      deferred.resolve(res.result);
    } else {
      deferred.reject(res);
    }
  });

  return deferred.promise.nodeify(callback);
};

Bot.prototype.sendPhoto = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._multipart({
    method: 'sendPhoto',
    params: {
      chat_id: options.chat_id
    },
    files: {
      photo: options.files.photo
    }
  }, function (err, res) {
    if (err) {
      return deferred.reject(err);
    }

    if (res.ok) {
      deferred.resolve(res.result);
    } else {
      deferred.reject(res);
    }
  })

};

module.exports = Bot;
