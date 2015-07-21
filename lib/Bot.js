var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , request = require('request')
  , fs = require('fs')
  , path = require('path')
  , qs = require('querystring')
  , Q = require('q')
  , mime = require('mime');

// request.debug = true;

/**
 * Constructor for Telegram Bot API Client.
 *
 * @class Bot
 * @constructor
 * @param {Object} options        Configurations for the client
 * @param {String} options.token  Bot token
 *
 * @see https://core.telegram.org/bots/api
 */
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

/**
 * This callback occur after client request for a certain webservice.
 *
 * @callback Bot~requestCallback
 * @param {Error}   Error during request
 * @param {Object}  Response from Telegram service
 */
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

  var form = req.form()
    , filename
    , type
    , stream
    , contentType;

  var arr = Object.keys(options.files);

  if (arr.indexOf('stream') > -1) {
    type = options.files['type'];
    filename = options.files['filename'];
    stream = options.files['stream'];
    contentType = options.files['contentType'];
  } else {
    arr.forEach(function (key) {
      var file = options.files[key];
      type = key;
      filename = path.basename(file);
      stream = fs.createReadStream(file);
      contentType = mime.lookup(file);
    })
  }

  form.append(type, stream, {
    filename: filename,
    contentType: contentType
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
  	        if(msg.message.text && msg.message.text.charAt(0) === '/'){
  		        var command = msg.message.text.split(' ', 2)[0];
  		        command = command.replace(/[^a-zA-Z0-9 ]/g, "");
  		        if(msg.message.text.split(' ')[1])
  		        {
  			        var arguments = msg.message.text.split(' ');
  			        arguments.shift();
  			        self.emit(command, msg.message, arguments);
  		        }
  		        else{
  			        self.emit(command, msg.message);
  		        }
  	        } else {
              self.emit('message', msg.message);
            }
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

/**
 * Start polling for messages
 *
 * @return {Bot} Self
 */
Bot.prototype.start = function () {
  var self = this;

  self._poll();
  self.polling = true;

  return self;
};

/**
 * End polling for messages
 *
 * @return {Bot} Self
 */
Bot.prototype.stop = function () {
  var self = this;

  self.polling = false;

  return self;
};

/**
 * Returns basic information about the bot in form of a User object.
 *
 * @param {Bot~requestCallback} callback    The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#getme
 */
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

/**
 * Use this method to get a list of profile pictures for a user.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.user_id   Unique identifier of the target user
 * @param {String=}             options.offset    Sequential number of the first photo to be returned. By default, all photos are returned.
 * @param {Integer=}            options.limit     Limits the number of photos to be retrieved. Values between 1—100 are accepted. Defaults to 100.
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#getuserprofilephotos
 */
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

/**
 * Use this method to send text messages.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String}              options.text      Text of the message to be sent
 * @param {Boolean=}            options.disable_web_page_preview    Disables link previews for links in this message
 * @param {Integer=}            options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=}             options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendmessage
 */
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

/**
 * Use this method to forward messages of any kind.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {Integer}             options.from_chat_id    Unique identifier for the chat where the original message was sent — User or GroupChat id
 * @param {Integer}             options.message_id    Unique message identifier
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#forwardmessage
 */
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

/**
 * Use this method to send photos.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String}              options.photo     Path to photo file (Library will create a stream if the path exist)
 * @param {String=}             options.file_id   If file_id is passed, method will use this instead
 * @param {String=}             options.caption   Photo caption (may also be used when resending photos by file_id).
 * @param {Integer=}            options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=}             options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendphoto
 */
Bot.prototype.sendPhoto = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendPhoto',
      params: {
        chat_id: options.chat_id,
        caption: options.caption,
        photo: options.file_id,
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
  } else {
    var files;
    if (options.files.stream) {
      files = {
        type: 'photo',
        filename: options.files.filename,
        contentType: options.files.contentType,
        stream: options.files.stream
      }
    } else {
      files = {
       photo: options.files.photo
      }
    }

    this._multipart({
      method: 'sendPhoto',
      params: {
        chat_id: options.chat_id,
        caption: options.caption,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      },
      files: files
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
  }

  return deferred.promise.nodeify(callback);
};

/**
 * Use this method to send audio files, if you want Telegram clients to display the file as a playable voice message.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String}              options.audio     Path to audio file (Library will create a stream if the path exist)
 * @param {String=}             options.file_id   If file_id is passed, method will use this instead
 * @param {Integer=}            options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=}             options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendaudio
 */
Bot.prototype.sendAudio = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendAudio',
      params: {
        chat_id: options.chat_id,
        audio: options.file_id,
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
  } else {
    var files;
    if (options.files.stream) {
      files = {
        type: 'audio',
        filename: options.files.filename,
        contentType: options.files.contentType,
        stream: options.files.stream
      }
    } else if (mime.lookup(options.files.audio) !== 'audio/ogg') {
      return Q.reject(new Error('Invalid file type'))
      .nodeify(callback);
    } else {
      files = {
        audio: options.files.audio
      }
    }

    this._multipart({
      method: 'sendAudio',
      params: {
        chat_id: options.chat_id,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      },
      files: files
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
  }

  return deferred.promise.nodeify(callback);
};

/**
 * Use this method to send general files.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String}              options.document  Path to document file (Library will create a stream if the path exist)
 * @param {String=}             options.file_id   If file_id is passed, method will use this instead
 * @param {Integer=}            options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=}             options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#senddocument
 */
Bot.prototype.sendDocument = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendDocument',
      params: {
        chat_id: options.chat_id,
        document: options.file_id,
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
  } else {
    var files;
    if (options.files.stream) {
      files = {
        type: 'document',
        filename: options.files.filename,
        contentType: options.files.contentType,
        stream: options.files.stream
      }
    } else {
      files = {
        document: options.files.document
      }
    }

    this._multipart({
      method: 'sendDocument',
      params: {
        chat_id: options.chat_id,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      },
      files: files
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
  }

  return deferred.promise.nodeify(callback);
};

/**
 * Use this method to send .webp stickers.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String}              options.sticker   Path to sticker file (Library will create a stream if the path exist)
 * @param {String=}             options.file_id   If file_id is passed, method will use this instead
 * @param {Integer=}            options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=}             options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendsticker
 */
Bot.prototype.sendSticker = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendSticker',
      params: {
        chat_id: options.chat_id,
        sticker: options.file_id,
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
  } else {
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
  }

  return deferred.promise.nodeify(callback);
};

/**
 * Use this method to send video files, Telegram clients support mp4 video.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String}              options.video   Path to video file (Library will create a stream if the path exist)
 * @param {String=}             options.file_id   If file_id is passed, method will use this instead
 * @param {Integer=}            options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=}             options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendvideo
 */
Bot.prototype.sendVideo = function (options, callback) {
  var self = this
    , deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendSticker',
      params: {
        chat_id: options.chat_id,
        video: options.file_id,
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
  } else {
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
  }

  return deferred.promise.nodeify(callback);
};

/**
 * Use this method to send point on the map.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {Float}               options.latitude  Latitude of location
 * @param {Float}               options.longitude Longitude of location
 * @param {Integer=}            options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=}             options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendlocation
 */
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

/**
 * Use this method when you need to tell the user that something is happening on the bot's side.
 *
 * @param {Object}              options           Options
 * @param {Integer}             options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String}              options.action    Type of action to broadcast.
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {Promise}  Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendchataction
 */
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
