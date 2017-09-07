# winston-amqplib

This library is a transport for winston for logging to amqp using the amqplib.

# examples

const winston = require('winston');
require('./winston-amqplib');

var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)(),
		//new (winston.transports.File)({ filename: 'somefile.log' })
		new (winston.transports.WinstonAmqplib)({source:'myAppID', level:'info', correlationId:'id used for tracking messages in elasticsearch'},{url:'url to rabbit'})
	]
});        
logger.log('info','testmessage');



# params
The second object to the lib is for amqplib:

url: url to rabbit, connection will be created and same with channel
connection: you can supply the connection if you like to reuse an existing
channel: You can also send only an existing channel to reuse
exchange: The exchange, defaults to logs
durable: Should it be durable, defaults to false