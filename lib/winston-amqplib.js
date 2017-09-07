const winston = require('winston');
const amqp = require('amqplib/callback_api');
const Transport = require('winston').Transport;

class WinstonAmqplib {
    constructor(options, amqpOptions) {
        Transport.call(this, options);
        this.source = options.source;
        this.correlationId = options.correlationId;
        this.name = 'winston-amqplib';
        this.pooled = [];
        this.exchange = amqpOptions.exchange || 'logs';
        this.formatter = options.formatter || function (output) {
                return JSON.stringify({
                    level: output.level,
                    timestamp: new Date().toISOString(),
                    meta: output.meta,
                    correlationId: this.correlationId,
                    source: this.source,
                    message: output.message
                });
            };

        if(!amqpOptions.connection && !amqpOptions.channel) {
            const url = amqpOptions.url || 'amqp://localhost';
            amqp.connect(url,  (err, conn) => {
                if(err) {
                    throw(err);
                }
                amqpOptions.connection = conn;
                this.setupAmqp(amqpOptions);
            });
        } else {
            this.setupAmqp(amqpOptions);
        }
    }
    setupAmqp(amqpOptions) {
        amqpOptions.durable = amqpOptions.durable || false;
        if(!amqpOptions.channel) {
            amqpOptions.connection.createChannel((err, ch) => {
                if(err) {
                    throw(err);
                }
                this._channel = ch;
                this._channel.assertExchange(this.exchange, 'fanout', {durable: amqpOptions.durable});
                console.log("WINSTONAMQPLIB logger ready");
            });
        } else {
            this._channel = amqpOptions.channel;
            this._channel.assertExchange(this.exchange, 'fanout', {durable: amqpOptions.durable});
            console.log("WINSTONAMQPLIB logger ready");
        }
    }
    async log(level, msg, meta, callback) {

        const output = {
            level: level,
            message: msg,
            meta: meta,
        };
        msg = this.formatter(output);
        if(!this._channel) {
            this.pooled.push({msg,callback});
            return;
        }
        //rabbit chat here
        this.checkPool();
        const ret = await this._channel.publish(this.exchange, '', new Buffer(msg));
        if(!ret) {
            //Something went wrong, pool message
            this.pooled.push({msg,callback});
        } else {
            if (callback)
                callback(null, true);
        }

    }
    checkPool() {
       for(let i=0; i< this.pooled.length; i++) {
           const ret = this._channel.publish(this.exchange, '', new Buffer(this.pooled[i].msg));
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