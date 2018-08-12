class Logger {
    logUnhandledRejections() {
        process.on('unhandledRejection', (reason, p) => {
            console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        });
    }
}

module.exports = Logger;