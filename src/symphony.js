const symphonyApi = require('symphony-api');
const MessageModel = symphonyApi.MessageModel;
const urljoin = require('url-join');
class Symphony {
    constructor(urls, credentials) {
        this.api = symphonyApi.create(urls);
        this.api.setCerts(credentials.cert, credentials.key, credentials.passphrase);
    }
    authenticate() {
        return new Promise((resolve, reject) => {
            this.api.authenticate()
                .then(() => this.getBotUser().then(resolve))
                .catch(reject);
        });
    }
    getBotUser() {
        return this.api.user.me().then(botUser => {
            console.log(`Successfully authorized as: ${botUser.emailAddress}`);
            this.botUser = botUser;
        });
    }
    getStream(streamId) {
        return this.api.stream.oneInfo(streamId);
    }
    createIM(userIDs) {
        this.api.stream.createIM = function(_userIDs) {
            return this.request(urljoin(this.podBaseUrl, '/v1/im/create'), 'POST', { body:  _userIDs, json: true });
        };
        return this.api.stream.createIM.call(this.api.stream, userIDs);
    }
    getStreamMembers(streamId) {
        this.api.stream.getStreamMembers = function(_streamId) {
            return this.request(urljoin(this.podBaseUrl, `/v1/room/${_streamId}/membership/list`), 'GET');
        };
        return this.api.stream.getStreamMembers.call(this.api.stream, streamId);
    }
    getLastBotActionMessage(streamId) {
        this.api.message.getBotMesssages = function(_botUserId, _streamId) {
            const query = `text:Available AND author:${_botUserId} AND streamId:${_streamId}`;
            const params = { query, limit: 1 };
            return this.request(urljoin(this.agentBaseUrl, `/v1/message/search`), 'GET', { params })
        }
        return this.api.message.getBotMesssages.call(this.api.message, this.botUser.id, streamId);
    }
}

module.exports = Symphony;
