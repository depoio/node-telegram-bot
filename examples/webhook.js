var Bot = require('../lib/Bot');

var bot = new Bot({
  token: 'TOKEN HERE'
	webhook: 'URL here'
}).start();

// Telegram will send POST requests to the specified url.
// Keep in mind (from Bots API):
/*
	Notes
	1. You will not be able to receive updates using getUpdates for as long as an outgoing webhook is set up.
	2. We currently do not support self-signed certificates.
	3. Ports currently supported for Webhooks: 443, 80, 88, 8443.
*/
