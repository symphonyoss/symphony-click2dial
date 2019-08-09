const isLoggingEnabled = process.env.ETHER_VOX_ENABLE_LOGGING;

class Logger {
    static log() {
      if (isLoggingEnabled) console.log(...arguments);
    }
    logUnhandledRejections() {
        process.on('unhandledRejection', (reason, p) => {
            console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        });
    }
}

module.exports = Logger;
