'use strict';

var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('node-telegram-bot');
var util = require('util');
var request = require('request');
var fs = require('fs');
var path = require('path');
var qs = require('querystring');
var Q = require('q');
var botanio = require('botanio-node');
var mime = require('mime');

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
  this.base_url = 'https://api.telegram.org/';
  this.id = '';
  this.first_name = '';
  this.username = '';
  this.token = options.token;
  this.offset = options.offset ? options.offset : 0;
  this.interval = options.interval ? options.interval : 500;
  this.webhook = options.webhook ? options.webhook : false;
  this.parseCommand = options.parseCommand ? options.parseCommand : true;
  this.maxAttempts = options.maxAttempts ? options.maxAttempts : 5;
  this.polling = false;
  this.pollingRequest = null;
  this.analytics = null;
  this.timeout = options.timeout ? options.timeout : 60; //specify in seconds
  // define the messageType's
  // this.NORMAL_MESSAGE = 1;
  // this.EDITED_MESSAGE = 2;
}

util.inherits(Bot, EventEmitter);

/**
 * This callback occur after client request for a certain webservice.
 * @func _get
 * @param {Object} options
 * @param {Bot~requestCallback} callback    The callback that handles the response.
 *
 * @callback Bot~requestCallback
 * @param {Error} callback.Error during request
 * @param {Object} callback.Response from Telegram service
 */
Bot.prototype._get = function (options, callback) {
  var self = this;
  var url = this.base_url + 'bot' + this.token + '/' + options.method;

  if (options.params) {
    url += '?' + qs.stringify(options.params);
  }

  var attempt = 1;

  function retry() {
    request.get({
      url: url,
      json: true
    }, function (err, res, body) {
      if (err) {
        if (err.code === 'ENOTFOUND' && attempt < self.maxAttempts) {
        ++attempt;
        self.emit('retry', attempt);
        retry();
        } else {
          callback(err);
        }
      } else {
        callback(null, body);
      }
    });
  }

  retry();

  return this;
};

/**
 * To perform multipart request e.g. file upload
 * @func _multipart
 * @param {Object} options
 * @param {Bot~requestCallback} callback    The callback that handles the response.

 * @callback Bot~requestCallback
 * @param {Error} callback.Error during request
 * @param {Object} callback.Response from Telegram service
 */
Bot.prototype._multipart = function (options, callback) {
  var self = this;
  var url = this.base_url + 'bot' + this.token + '/' + options.method;

  var attempt = 1;

  function retry() {
    var req = request.post(url, function (err, res, body) {
      if (err) {
        if (err.code === 'ENOTFOUND' && attempt < self.maxAttempts) {
          ++attempt;
          self.emit('retry', attempt);
          retry();
        } else {
          callback(err);
        }
      } else {
        var contentType = res.headers['content-type'];

        if (contentType.indexOf('application/json') >= 0) {
          try {
            body = JSON.parse(body);
          } catch (e) {
            callback(e, body);
          }
        }

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

    Object.keys(options.params).forEach(function (key) {
      if (options.params[key]) {
        form.append(key, options.params[key]);
      }
    });
  }

  retry();

  return this;
};

/**
 * Temporary solution to set webhook
 * @func _setWebhook
 * @param {Object} webhook
 *
 */
Bot.prototype._setWebhook = function (webhook) {
  var self = this;
  var url = this.base_url + 'bot' + this.token + '/setWebhook' + "?" + qs.stringify({url: webhook});

  request.get({
    url: url,
    json: true
  }, function (err, res, body) {
    /**
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {int} res.statusCode
     */
    if (!err && res && res.statusCode === 200) {
      if (body.ok) {
      	debug("Set webhook to " + self.webhook);
      } else {
        debug("Body not ok");
        debug(body);
      }
    } else if(res && res.hasOwnProperty('statusCode') && res.statusCode === 401){
      debug(err);
      debug("Failed to set webhook with code" + res.statusCode);
    } else {
      debug(err);
      debug("Failed to set webhook with unknown error");
    }
  });
};

/**
 * Start polling for messages
 * @func _poll
 *
 * @return {Bot} Self
 */
Bot.prototype._poll = function () {
  var self = this;
  var url = self.base_url + 'bot' + self.token + '/getUpdates?timeout=' + self.timeout + '&offset=' + self.offset;

  self.pollingRequest = null;
  if (self.polling) {
    debug("Poll");

    self.pollingRequest = request.get({
      url: url,
      timeout: self.timeout * 1000,
      json: true
    }, function (err, res, body) {

      if (err && err.code !== 'ETIMEDOUT') {
        self.emit('error', err);
      } else if (res && res.statusCode === 200) {
        if (body.ok) {
          body.result.forEach(function (msg) {
            /**
             * @param {Object} msg
             * @param {int} msg.update_id
             * @param {Boolean} msg.edited_message
             */
            if (msg.update_id >= self.offset) {
              self.offset = msg.update_id + 1;
              var message;
              var messageType = 0;
              if (!!msg.message){
                message = msg.message;
                messageType = 1; // We are a normal message
              }else if (!!msg.edited_message){
                message = msg.edited_message;
                messageType = 2; // We are an edited message
              }
              if(messageType > 0) {
                if (self.parseCommand) {
                  if (message && message.text && message.text.charAt(0) === '/') {
                    /**
                     * Split the message on space and @
                     * Zero part = complete message
                     * First part = command with leading /
                     * Third part = target or empty ""
                     * Fourth part = arguments or empty ""
                     */
                    var messageParts = message.text.match(/([^@ ]*)([^ ]*)[ ]?(.*)/);

                    // Filter everything not alphaNum out of the command
                    var command = messageParts[1].replace(/[^a-zA-Z0-9 ]/g, "");
                    // Target incl @ sign or null
                    var target = (messageParts[2] !== "" ? messageParts[2]: null);
                    // Optional arguments or null
                    var args = (messageParts[3] !== "" ? messageParts[3].split(' '): null);

                    self.emit(command, message, args, target);
                  }
                }

                if (self.analytics !== null) {
                  self.analytics.track(message);
                }
                message.messageType = messageType;
                self.emit('message', message);
              }

              if (msg.callback_query) {
                self.emit('callback_query', msg.callback_query);
              }
            }
          });
        }

        if (self.polling) {
            self._poll();
        }

      } else if(res && res.hasOwnProperty('statusCode') && res.statusCode === 401) {
        self.emit('error', new Error('Invalid token.'));
      } else if(res && res.hasOwnProperty('statusCode') && res.statusCode === 409) {
        self.emit('error', new Error('Duplicate token.'));
      } else if(res && res.hasOwnProperty('statusCode') && res.statusCode === 502) {
        self.emit('error', new Error('Gateway error.'));
      } else if(self.pollingRequest && !self.pollingRequest._aborted) { //Skip error throwing, this is an abort due to stopping
        self.emit('error', new Error(util.format('Unknown error')));
      }
    });
  }

  return self;
};

/**
 * Bot start receiving activities
 * @func start
 *
 * @return {Bot} Self
 */
Bot.prototype.start = function () {
  var self = this;
  if (self.webhook) {
      self._setWebhook(this.webhook);
  } else if (!self.polling) {
      self.polling = true;
      self._poll();
  }
  return self;
};

/**
 * End polling for messages
 * @func stop
 *
 * @return {Bot} Self
 */
Bot.prototype.stop = function () {
  var self = this;
  self.polling = false;
  if (self.pollingRequest) {
      self.pollingRequest.abort();
  }
  return self;
};

/**
 * Returns basic information about the bot in form of a User object.
 * @func getMe
 *
 * @param {Bot~requestCallback} callback    The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#getme
 */
Bot.prototype.getMe = function (callback) {
  var self = this;
  var deferred = Q.defer();

  this._get({ method: 'getMe' },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.user_id   Unique identifier of the target user
 * @param {String=} options.offset    Sequential number of the first photo to be returned. By default, all photos are returned.
 * @param {int=} options.limit     Limits the number of photos to be retrieved. Values between 1—100 are accepted. Defaults to 100.
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#getuserprofilephotos
 */
Bot.prototype.getUserProfilePhotos = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'getUserProfilePhotos',
    params: {
      user_id: options.user_id,
      offset: options.offset,
      limit: options.limit
    }
   },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * Use this method to get basic info about a file and prepare it for downloading. For the moment, bots can download files of up to 20MB in size.
 *
 * @param {Object} options           Options
 * @param {String} options.file_id   File identifier to get info about
 * @param {String=} options.dir       Directory the file to be stored (if it is not specified, no file willbe downloaded)
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#getfile
 */
Bot.prototype.getFile = function (options, callback) {
  var self = this;
  var deferred = Q.defer();

  this._get({
    method: 'getFile',
    params: {
      file_id: options.file_id
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     * @param {string} res.result.file_path
     */
    function (err, res) {
    if (err) {
      return deferred.reject(err);
    }

    if (res.ok) {
      var filename = path.basename(res.result.file_path);
      var url = self.getFileURLFromFilePath(res.result.file_path);
      if (options.dir) {
        var filepath  = path.join(options.dir, filename);
        var destination = fs.createWriteStream(filepath);
        request(url)
        .pipe(destination)
        .on('finish', function () {
          deferred.resolve({
            destination: filepath,
            url: url
          });
        })
        .on('error', function(error){
          deferred.reject(error);
        });
      } else {
        deferred.resolve({
          url: url
        });
      }
    } else {
      deferred.reject(res);
    }
  });

  return deferred.promise.nodeify(callback);
};


/**
 * Use this method to get the download URL for a Telegram file when file_path is provided along file_id. Usually happens with forwarded messages to which you already called getFile.
 *
 * @param {String} file_path   File path provided by Telegram
 * @return {String} Download URL
 *
 */
Bot.prototype.getFileURLFromFilePath = function (file_path) {
    var self = this;
    return self.base_url + 'file/bot' + self.token + '/' + file_path;
};

/**
 * Use this method to send text messages.
 *
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.text      Text of the message to be sent
 * @param {String} options.parse_mode  Send Markdown, if you want Telegram apps to show bold, italic and inline URLs in your bot's message.
 * @param {Boolean=} options.disable_web_page_preview    Disables link previews for links in this message
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendmessage
 */
Bot.prototype.sendMessage = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'sendMessage',
    params: {
      chat_id: options.chat_id,
      text: options.text,
      parse_mode: options.parse_mode,
      disable_web_page_preview: options.disable_web_page_preview,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * Use this method to send phone contacts. On success, the sent Message is returned.
 *
 * @func sendContact
 * @param {Object} options
 * @param callback
 * @returns {*}
 *
 * @see https://tlgrm.ru/docs/bots/api#sendcontact
 */
Bot.prototype.sendContact = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'sendContact',
    params: {
      chat_id: options.chat_id,
      phone_number: options.phone_number,
      first_name: options.first_name,
      last_name: options.last_name,
      disable_notification: options.disable_notification,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {int} options.from_chat_id    Unique identifier for the chat where the original message was sent — User or GroupChat id
 * @param {Boolean} options.disable_notification Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int} options.message_id    Unique message identifier
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#forwardmessage
 */
Bot.prototype.forwardMessage = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'forwardMessage',
    params: {
      chat_id: options.chat_id,
      from_chat_id: options.from_chat_id,
      disable_notification: options.disable_notification,
      message_id: options.message_id
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.photo     Path to photo file (Library will create a stream if the path exist)
 * @param {String=} options.file_id   If file_id is passed, method will use this instead
 * @param {String=} options.caption   Photo caption (may also be used when resending photos by file_id).
 * @param {Boolean} options.disable_notification Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Object} options.files
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendphoto
 */
Bot.prototype.sendPhoto = function (options, callback) {
  var deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendPhoto',
      params: {
        chat_id: options.chat_id,
        photo: options.file_id,
        caption: options.caption,
        disable_notification: options.disable_notification,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      }
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.audio     Path to audio file (Library will create a stream if the path exist)
 * @param {String=} options.file_id   If file_id is passed, method will use this instead
 * @param {String} options.caption Optional	Audio caption, 0-200 characters
 * @param {int} options.duration Optional	Duration of the audio in seconds
 * @param {String} options.performer Optional	Performer
 * @param {String} options.title Optional	Track name
 * @param {Boolean} options.disable_notification Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Object} options.files
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendaudio
 */
Bot.prototype.sendAudio = function (options, callback) {
  var deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendAudio',
      params: {
        chat_id: options.chat_id,
        audio: options.file_id,
        caption: options.caption,
        duration: options.duration,
        performer: options.performer,
        title: options.title,
        disable_notification: options.disable_notification,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      }
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.file_id   file_id as String
 * @param {String} options.document  Path to document file (Library will create a stream if the path exist)
 * @param {String} options.caption  Optional	New caption of the message
 * @param {Boolean} options.disable_notification  Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Object} options.files
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#senddocument
 */
Bot.prototype.sendDocument = function (options, callback) {
  var deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendDocument',
      params: {
        chat_id: options.chat_id,
        document: options.file_id,
        caption: options.caption,
        disable_notification: options.disable_notification,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      }
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.sticker   Path to sticker file (Library will create a stream if the path exist)
 * @param {String=} options.file_id   If file_id is passed, method will use this instead
 * @param {Boolean} options.disable_notification  Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Object} options.files
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendsticker
 */
Bot.prototype.sendSticker = function (options, callback) {
  var deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendSticker',
      params: {
        chat_id: options.chat_id,
        sticker: options.file_id,
        disable_notification: options.disable_notification,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      }
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.video   Path to video file (Library will create a stream if the path exist)
 * @param {String=} options.file_id   If file_id is passed, method will use this instead
 * @param {int} options.duration 	Optional	Duration of sent video in seconds
 * @param {int} options.width Optional	Video width
 * @param {int} options.height Optional	Video height
 * @param {String} options.caption Optional	Video caption (may also be used when resending videos by file_id), 0-200 characters
 * @param {Boolean} options.disable_notification  Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Object} options.files
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendvideo
 */
Bot.prototype.sendVideo = function (options, callback) {
  var deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendSticker',
      params: {
        chat_id: options.chat_id,
        video: options.file_id,
        duration: options.duration,
        width: options.width,
        height: options.height,
        caption: options.caption,
        disable_notification: options.disable_notification,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      }
    },
     /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
        type: 'video',
        filename: options.files.filename,
        contentType: options.files.contentType,
        stream: options.files.stream
      }
    } else if (mime.lookup(options.files.video.filename) !== 'video/mp4') {
      return Q.reject(new Error('Invalid file type'))
      .nodeify(callback);
    } else {
      files = {
        video: options.files.video
      }
    }

    this._multipart({
      method: 'sendVideo',
      params: {
        chat_id: options.chat_id,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      },
      files: files
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.audio     Path to audio file (Library will create a stream if the path exist)
 * @param {String} options.caption Optional	Voice message caption, 0-200 characters
 * @param {int} options.duration Optional	Duration of the voice message in seconds
 * @param {String=} options.file_id   If file_id is passed, method will use this instead
 * @param {Boolean} options.disable_notification  Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Object} options.files
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendvoice
 */
Bot.prototype.sendVoice = function (options, callback) {
  var deferred = Q.defer();

  if (options.file_id) {
    this._get({
      method: 'sendVoice',
      params: {
        chat_id: options.chat_id,
        audio: options.file_id,
        caption: options.caption,
        duration: options.duration,
        disable_notification: options.disable_notification,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      }
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
      method: 'sendVoice',
      params: {
        chat_id: options.chat_id,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: JSON.stringify(options.reply_markup)
      },
      files: files
    },
      /**
       * @param {Error} err
       * @param {Object} res
       * @param {Boolean} res.ok
       * @param {Object} res.result
       */
      function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {float} options.latitude  Latitude of location
 * @param {float} options.longitude Longitude of location
 * @param {Boolean} options.disable_notification  Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendlocation
 */
Bot.prototype.sendLocation = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'sendLocation',
    params: {
      chat_id: options.chat_id,
      latitude: options.latitude,
      longitude: options.longitude,
      disable_notification: options.disable_notification,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * Use this method to send point on the map.
 *
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {float} options.latitude  Latitude of location
 * @param {float} options.longitude Longitude of location
 * @param {String} options.title Yes	Name of the venue
 * @param {String} options.address Yes	Address of the venue
 * @param {String} options.foursquare_id Optional	Foursquare identifier of the venue
 * @param {Boolean} options.disable_notification  Optional	Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound.
 * @param {int=} options.reply_to_message_id   If the message is a reply, ID of the original message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendvenue
 */
Bot.prototype.sendVenue = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'sendVenue',
    params: {
      chat_id: options.chat_id,
      latitude: options.latitude,
      longitude: options.longitude,
      title: options.title,
      address: options.address,
      foursquare_id: options.foursquare_id,
      disable_notification: options.disable_notification,
      reply_to_message_id: options.reply_to_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {String} options.action    Type of action to broadcast.
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#sendchataction
 */
Bot.prototype.sendChatAction = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'sendChatAction',
    params: {
      chat_id: options.chat_id,
      action: options.action
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * Use this method to edit text messages sent by the bot or via the bot (for inline bots).
 * On success, if edited message is sent by the bot, the edited Message is returned, otherwise True is returned.
 * @func editMessageText
 *
 * @param {Object} options           Options

 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {int} options.message_id Optional	Required if inline_message_id is not specified. Unique identifier of the sent message
 * @param {String} options.inline_message_id Optional	Required if chat_id and message_id are not specified. Identifier of the inline message
 * @param {String} options.text      Text of the message to be sent
 * @param {String} options.parse_mode  Send Markdown, if you want Telegram apps to show bold, italic and inline URLs in your bot's message.
 * @param {Boolean=} options.disable_web_page_preview    Disables link previews for links in this message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}

 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#editmessagetext
 */
Bot.prototype.editMessageText = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'editMessageText',
    params: {
      chat_id: options.chat_id,
      message_id: options.message_id,
      inline_message_id: options.inline_message_id,
      text: options.text,
      parse_mode: options.parse_mode,
      disable_web_page_preview: options.disable_web_page_preview,
      reply_markup: JSON.stringify(options.reply_markup)
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * Use this method to edit captions of messages sent by the bot or via the bot (for inline bots).
 * On success, if edited message is sent by the bot, the edited Message is returned, otherwise True is returned.
 * @func editMessageCaption
 *
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {int} options.message_id Optional	Required if inline_message_id is not specified. Unique identifier of the sent message
 * @param {String} options.inline_message_id Optional	Required if chat_id and message_id are not specified. Identifier of the inline message
 * @param {String} options.caption Optional	New caption of the message
 * @param {String} options.text      Text of the message to be sent
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#editmessagecaption
 */
Bot.prototype.editMessageCaption = function (options, callback) {
  var deferred = Q.defer();

  this._get({
    method: 'editMessageCaption',
    params: {
      chat_id: options.chat_id,
      message_id: options.message_id,
      inline_message_id: options.inline_message_id,
      caption: options.caption,
      text: options.text,
      reply_markup: JSON.stringify(options.reply_markup)
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * Use this method to edit captions of messages sent by the bot or via the bot (for inline bots).
 * On success, if edited message is sent by the bot, the edited Message is returned, otherwise True is returned.
 * @func editMessageReplyMarkup
 *
 * @param {Object} options           Options
 * @param {int} options.chat_id   Unique identifier for the message recipient — User or GroupChat id
 * @param {int} options.message_id Optional	Required if inline_message_id is not specified. Unique identifier of the sent message
 * @param {String} options.inline_message_id Optional	Required if chat_id and message_id are not specified. Identifier of the inline message
 * @param {Object=} options.reply_markup    Additional interface options. {@link https://core.telegram.org/bots/api/#replykeyboardmarkup| ReplyKeyboardMarkup}
 * @param {Bot~requestCallback} callback          The callback that handles the response.
 * @return {promise} Q Promise
 *
 * @see https://core.telegram.org/bots/api#editmessagereplymarkup
 */
Bot.prototype.editMessageReplyMarkup = function (options, callback) {
  /**
   * @param {Object} Q
   * @param {Function} Q.defer
   * @param {Object} deferred
   * @param {Function} deferred.reject
   * @param {Function} deferred.resolve
   * @param {Object} deferred.promise
   * @param {Function} deferred.promise.nodeify
   */
  var deferred = Q.defer();

  this._get({
    method: 'editMessageReplyMarkup',
    params: {
      chat_id: options.chat_id,
      message_id: options.message_id,
      inline_message_id: options.inline_message_id,
      reply_markup: JSON.stringify(options.reply_markup)
    }
  },
    /**
     * @param {Error} err
     * @param {Object} res
     * @param {Boolean} res.ok
     * @param {Object} res.result
     */
    function (err, res) {
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
 * Analytics from http://botan.io/
 * Allows all incoming messages, and you can make tagging, for specific messages
 * bot.analytics.track(message, 'Specific tag');
 *
 * @param  {String} token You can take this token here: https://appmetrica.yandex.com/
 * @return {Bot} Self
 *
 * @see https://github.com/botanio/sdk
 */
Bot.prototype.enableAnalytics = function(token) {
  this.analytics = botanio(token);

  return this;
};

module.exports = Bot;
