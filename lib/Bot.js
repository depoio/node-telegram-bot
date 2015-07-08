var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , request = require('request')
  , fs = require('fs')
  , path = require('path')
  , qs = require('querystring')
  , Q = require('q')
  , mime = require('mime');

// request.debug = true;

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
    var file = options.files[key]
      , filename = path.basename(file)
      , stream = fs.createReadStream(file);

    form.append(key, stream, {
      filename: filename,
      contentType: mime.lookup(file)
    });
  });

  Object.keys(options.params).forEach(function(key) {
    if (options.params[key]) {
      form.append(key, options.params[key]);
    }
  });
  
  return this;
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

  return this;
};

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
      return deferred.reject(err);
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

Bot.prototype.getUserProfilePhotos = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._get({ 
    method: 'getUserProfilePhotos',
    params: {
      user_id: options.user_id,
      offset: options.offset,
      limit: options.limit
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

Bot.prototype.sendMessage = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._get({ 
    method: 'sendMessage',
    params: {
      chat_id: options.chat_id,
      text: options.text,
      disable_web_page_preview: options.disable_web_page_preview,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
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

  return deferred.promise.nodeify(callback);
};

Bot.prototype.sendPhoto = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._multipart({
    method: 'sendPhoto',
    params: {
      chat_id: options.chat_id,
      caption: options.caption,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
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
  });

  return deferred.promise.nodeify(callback);
};

Bot.prototype.sendAudio = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (mime.lookup(options.files.audio) !== 'audio/ogg') {
    return Q.reject(new Error('Invalid file type'))
    .nodeify(callback);
  }

  this._multipart({
    method: 'sendAudio',
    params: {
      chat_id: options.chat_id,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    },
    files: {
      audio: options.files.audio
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

Bot.prototype.sendDocument = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._multipart({
    method: 'sendDocument',
    params: {
      chat_id: options.chat_id,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    },
    files: {
      document: options.files.document
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

Bot.prototype.sendSticker = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (mime.lookup(options.files.sticker) !== 'image/webp') {
    return Q.reject(new Error('Invalid file type'))
    .nodeify(callback);
  }

  this._multipart({
    method: 'sendSticker',
    params: {
      chat_id: options.chat_id,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    },
    files: {
      sticker: options.files.sticker
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

Bot.prototype.sendVideo = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (mime.lookup(options.files.video.filename) !== 'video/mp4') {
    return Q.reject(new Error('Invalid file type'))
    .nodeify(callback);
  }

  this._multipart({
    method: 'sendVideo',
    params: {
      chat_id: options.chat_id,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    },
    files: {
      video: options.files.video
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

Bot.prototype.sendLocation = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  this._get({
    method: 'sendLocation',
    params: {
      chat_id: options.chat_id,
      latitude: options.latitude,
      longitude: options.longitude,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
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

module.exports = Bot;
