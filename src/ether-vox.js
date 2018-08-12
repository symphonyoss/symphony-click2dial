const superagent = require('superagent');
const http  = require('superagent');
class EtherVox {
    constructor() {
        this.apiPath = process.env.ETHER_VOX_API_PATH;
        if (!this.apiPath) {
            throw 'ETHER_VOX_API_PATH is not set';
        }
        this.token = process.env.ETHER_VOX_TOKEN;
        if (!this.token) {
            throw 'ETHER_VOX_TOKEN is not set';
        }        
    }
    checkMember(identifier) {
        return this
            ._request('GET', 'account/member/check')
            .query({ identifier, channel: 'symphony' })
    }
    getAuthURL(identifier) {
        return this
            ._request('GET', 'auth/url')
            .query({ identifier, channel: 'symphony' });
    }
    getCall(requestid) {
        return this
            ._request('GET', `community/line/call/${requestid}`);
    }
    requestCall(requestor, farparty) {
        return this
            ._request('POST', 'community/line/call')
            .send({ requestor, farparty, channel: 'symphony'})
    }
    acceptCall(requestid, identifier) {
        return this
            ._request('POST', 'community/line/accept')
            .send({ requestid, identifier, channel: 'symphony'});
    }
    rejectCall(requestid, identifier) {
        return this
            ._request('POST', 'community/line/reject')
            .send({ requestid, identifier, channel: 'symphony'});
    }
    putOnHandset(requestid, identifier) {
        return this
            ._request('POST', 'community/handset/connect')
            .send({ requestid, identifier, channel: 'symphony', force: true });
    }
    dropHandset(requestid, identifier, bridgechannelnum) {
        return this
            ._request('POST', 'community/handset/drop')
            .send({ requestid, identifier, bridgechannelnum, channel: 'symphony'});
    }
    getCommunityLines() {
        return this._request('GET', 'community/line');
    }
    _request(method, service) {
        return superagent
            [method.toLowerCase()](`${this.apiPath}/${Array.isArray(service) ? service.join('/') : service}`)
            .set('Authorization', `Bearer ${this.token}`)
    }
}

module.exports = EtherVox;