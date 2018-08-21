process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
process.env.NODE_ENV = 'production';

const fs = require('fs');

const Symphony = require('./src/symphony');
const Bot = require('./src/bot');
const Logger = require('./src/logger');

const env = process.env.ETHER_VOX_SYMPHONY_ENV || 'dev';
const config = require(`./config/${env}.config.json`);

const cert = fs.readFileSync('./certs/ethervox-symphony-cert.pem', { encoding: 'utf-8' });
const key = fs.readFileSync('./certs/ethervox-symphony-key.pem', { encoding: 'utf-8' });

const passphrase = process.env.ETHER_VOX_SYMPHONY_PASSPHRASE;
if (!passphrase) {
    throw 'ETHER_VOX_SYMPHONY_PASSPHRASE is not set';
}

const logger = new Logger();
logger.logUnhandledRejections();
const symphony = new Symphony(config.symphonyUrls, { cert, key, passphrase });
symphony.authenticate().then(() => {
    const bot = new Bot(config.bot);
    bot.initialize(symphony);
});