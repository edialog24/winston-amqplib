const winston = require('winston');
const amqp = require('amqplib/callback_api');
const Transport = require('winston').Transport;
const uuidV4 = require('uuid/v4');

class WinstonAmqplib {
    constructor(options, amqpOptions) {       
        Transport.call(this, options);
        this.source = options.source;
        this.correlationId = options.correlationId || (new Date().getTime()) + '_' + uuidV4();
        this.name = 'winston-amqplib';
        this.type = options.type;
        this.pooled = [];

        this.formatter = options.formatter || function (output) {
                return JSON.stringify({
                    level: output.level,
                    timestamp: new Date().toISOString(),
                    metadata: output.meta,
                    correlationId: this.correlationId,
                    source: this.source,
                    message: output.message,
                    type: this.type
                });
            };
        amqpOptions.exchange = amqpOptions.exchange || 'logs';
        amqpOptions.autoCloseChannel = amqpOptions.autoCloseChannel || true;
        amqpOptions.autoCloseConnection = amqpOptions.autoCloseConnection || true;
        amqpOptions.durable = amqpOptions.durable || false;
        //close channel if no activity for 1 seconds
        amqpOptions.autoCloseTime = amqpOptions.autoCloseTime || 1000;
        this.amqpOptions = amqpOptions;
        this.setupConnectionsAndChannel();

    }
    setupConnectionsAndChannel() {
        if(!this.amqpOptions.connection && !this.amqpOptions.channel) {
            WinstonAmqplib.createConnection(this.amqpOptions)
                .then((connection) => {
                    this.amqpOptions.connection = connection;
                    return WinstonAmqplib.setupChannel(this.amqpOptions);
                })
                .then((channel) => {
                    this.amqpOptions.channel = channel;
                    this.amqpOptions.channel.assertExchange(this.amqpOptions.exchange, 'fanout', {durable: this.amqpOptions.durable});
                    this.checkPool();
                })
                .catch((err) => console.error(err));
        } else if(!this.amqpOptions.channel){
            //Connection is provided from outside so we do not close it
            this.amqpOptions.autoCloseConnection = false;
            WinstonAmqplib.setupChannel(this.amqpOptions)
                .then((channel) => {
                    this.amqpOptions.channel = channel;
                    this.amqpOptions.channel.assertExchange(this.amqpOptions.exchange, 'fanout', {durable: this.amqpOptions.durable});
                    this.checkPool();
                })
                .catch((err) => console.error(err));
        } else {
            //We do not close the channel since it's provided from outside
            this.amqpOptions.autoCloseChannel = false;
            //Connection is provided from outside so we do not close it
            this.amqpOptions.autoCloseConnection = false;
            this.amqpOptions.channel.assertExchange(this.amqpOptions.exchange, 'fanout', {durable: this.amqpOptions.durable});
        }
    }
	static createConnection(amqpOptions) {
		const url = amqpOptions.url || 'amqp://localhost';
		return new Promise((res, rej) => {
			amqp.connect(url,  (err, conn) => {
                if(err) {
                    throw(err);
                }
				res(conn);                             
            });
		});
	}
    static setupChannel(amqpOptions) {
        return new Promise((res, rej) => {
            amqpOptions.connection.createChannel((err, ch) => {
                if(err) {
                    throw(err);
                }
                res(ch);
            });
        })
    }
    close() {
        if(this.amqpOptions.autoCloseChannel && this.amqpOptions.channel) {
            this.amqpOptions.channel.close();
            this.amqpOptions.channel = undefined;
        }
        if(this.amqpOptions.autoCloseConnection && this.amqpOptions.connection) {
            this.amqpOptions.connection.close();
            this.amqpOptions.connection = undefined;
        }
        this.closed = true;
    }
    async log(level, msg, meta, callback) {
        if(this.timerClose) {
            clearTimeout(this.timerClose);
        }
        if(this.closed) {
            //We got messages after we have called closed, so need to do a new connection again
            this.setupConnectionsAndChannel();
            this.closed = undefined;
        }


        const output = {
            level: level,
            message: msg,
            meta: meta,
        };
        msg = this.formatter(output);
        if(!this.amqpOptions.channel) {
            this.pooled.push({msg,callback});
            return;
        }
        //rabbit chat here
        this.checkPool();
        const ret = await this.amqpOptions.channel.publish(this.amqpOptions.exchange, '', new Buffer(msg));
        if(!ret) {
            //Something went wrong, pool message
            this.pooled.push({msg,callback});
        } else {
            if (callback)
                callback(null, true);
        }
        if(this.amqpOptions.autoCloseChannel) {
            this.timerClose = setTimeout(() => {this.close();},this.amqpOptions.autoCloseTime);
        }
    }

    checkPool() {
       for(let i=0; i< this.pooled.length; i++) {
           const ret = this.amqpOptions.channel.publish(this.amqpOptions.exchange, '', new Buffer(this.pooled[i].msg));
           if (ret) {
               if(this.pooled[i].callback)
                    this.pooled[i].callback(null,true);
               this.pooled.splice(i--,1);
           }
       }
    }
    //Winston will fail to log exceptions without this
    logException(msg, meta, callback) {
        this.log('error', msg, meta, callback);
    }

    //Winston will fail without this
    on(level, callback) {}
}


module.exports = winston.transports.WinstonAmqplib = WinstonAmqplib;