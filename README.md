# winston-amqplib

This library is a transport for winston for logging to amqp using the amqplib.

# examples
```javascript
const winston = require('winston');
require('winston-amqplib');

var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)(),
		new (winston.transports.WinstonAmqplib)({source:'myAppID', level:'info', correlationId:'id used for tracking messages'},{url:'url to rabbit',})
	]
});        
logger.log('info','testmessage');
```


# params
The second object to the lib is for amqplib:

Different ways to do the connection is:
url: url to rabbit, connection will be created and same with channel
autoCloseTime: Timer that closes the connection for you if you choose to let the library create the connection and channel, if you supply only connection it's only the channel that is autoclosed.

connection: you can supply the connection if you like to reuse an existing !important, the connection is never closed by the library
channel: You can also send only an existing channel to reuse !important, the channel is never closed by the library



exchange: The exchange, defaults to logs
durable: Should it be durable, defaults to false