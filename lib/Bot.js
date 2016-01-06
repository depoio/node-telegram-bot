'use strict'

let EventEmitter = require('events').EventEmitter;

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
};

module.exports = Bot;
