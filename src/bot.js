const has = require('lodash/has');
const Responder = require('./responder');
const ExtensionServer = require('./extension-server');

class Bot {
    constructor(config) {
        this.config = config;
    }
    initialize(symphony) {
        this.symphonyApi = symphony.api;
        this.botUser = symphony.botUser;
        this.responder = new Responder(symphony);
        this.extensionServer = new ExtensionServer(symphony, this.responder);
        this.listen();
    }
    listen() {
        this.symphonyApi.feed.start().then(this.handleEvents.bind(this));
    }
    handleEvents() {
        this.symphonyApi.feed.on('messages', this.onFeed.bind(this));
        this.responder.on('respond', this.onRespond.bind(this));
        this.extensionServer.on('respondSimple', this.onRespondSimple.bind(this));
    }
    onRespond(response) {
        this.symphonyApi.message.v4.send(response.streamId, `
            <messageML>
                <br /><br />
                <h1>
                    <img src="https://abapi.gltd.net/ethervox-black.png" />
                    etherVox
                </h1>
                ${response.message}
                <br />
            </messageML>
        `, response.data);
    }
    onRespondSimple(response) {
        this.symphonyApi.message.v4.send(
            response.streamId,
            `<messageML>${response.message}</messageML>`,
            response.data
        );
    }
    onFeed(feed) {
        if (feed && Array.isArray(feed)) {
            feed.forEach(this.onEvent.bind(this));
        }
    }
    onEvent(event) {
        this.responder.handle(event);
    }
}

module.exports = Bot;
