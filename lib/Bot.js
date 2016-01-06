'use strict'

var EventEmitter = require('events').EventEmitter
  , request = require('request');

class Bot extends EventEmitter
{
  constructor(options) {
    super();
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
  }

  _get(options) {
    var url = this.base_url + 'bot' + this.token + '/' + options.method;

    return new Promise(function (resolve, reject) {
      request.get({
        url: url,
        json: true
      }, function (err, res, body) {
        if (err) {
          return reject(err);
        } else {
          resolve(body);
        }
      });
    });
  }
};

module.exports = Bot;
