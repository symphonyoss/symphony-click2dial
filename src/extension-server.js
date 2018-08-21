const fs = require('fs');
const atob = require('atob');
const path = require('path');
const http = require('http');
const compression = require('compression')
const express = require('express');
const EventEmitter = require('events');
const exphbs  = require('express-handlebars');
const kebabCase = require('lodash/kebabCase');
const difference = require('lodash/difference');
const EtherVox = require('./ether-vox');

class ExtensionServer extends EventEmitter {
    constructor(symphony, responder) {
        super();
        
        const port = process.env.ETHER_VOX_EXTENSION_SERVER_PORT;
        if (!port) {
            throw 'ETHER_VOX_EXTENSION_SERVER_PORT is not set';
        }

        this.etherVox = new EtherVox();
        this.symphony = symphony;
        this.responder = responder;
        
        this.app = express();
        this.app.engine('handlebars', exphbs({
            defaultLayout: 'main',
            layoutsDir: path.join(__dirname, '../public/views/layouts')
        }));
        this.app.set('view engine', 'handlebars');
        this.app.enable('view cache');
        this.app.set('views', path.join(__dirname, '../public/views'));

        this.app.use(compression());
        this.app.use(express.static(path.join(__dirname, '../public'), {
            maxAge: '1y',
            setHeaders: function setHeaders(res, path, stat) {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET');
                res.header('Access-Control-Allow-Headers', 'Content-Type');
            }
        }));
        this.app.use(express.json());

        http.createServer(this.app).listen(port);

        this.app.get('/button', this.onGetButton.bind(this));
        this.app.post('/button', this.onPostButton.bind(this));

        this.actionMapping = {
            'requestCall': this.onRequestCall.bind(this),
            'rejectCall': this.onRejectCall.bind(this),
            'acceptCall': this.onAcceptCall.bind(this),
            'dropCall': this.onDropCall.bind(this),
            'putOnHandset': this.onPutOnHandset.bind(this),
            'dropHandset': this.onDropHandset.bind(this)
        };
    }
    onGetButton(req, res) {
        const data = JSON.parse(atob(req.query.data));
        res.render(kebabCase(data.action), Object.assign(data, { layout: 'buttons' }));
    }
    onPostButton(req, res) {
        this.symphony.api.user.lookup({ email: req.body.userEmail })
            .then(requestor => this.onUserLookup(req, res, requestor));
    }
    onUserLookup(req, res, requestor) {
        let message;
        if (req.body.audience && req.body.audience !== requestor.id.toString()) {
            message = `<mention uid="${requestor.id}" />, You are not authorized to perform that operation`;
            res.write('unauthorized');
        }
        else {
            message = `<mention uid="${requestor.id}" /> `;
            message += this.actionMapping[req.body.action].call(this, req.body, requestor);
            res.write('ok');
        }
        this.respond(req.body.streamId, message);
    }
    onRequestCall(body, requestor) {
        const parties = this.extractParties(body, requestor);
        this.responder.onRequestCall(body.streamId, requestor.id, parties.farparty, parties.members);
        return 'requested a bridge';
    }
    onRejectCall(body, requestor) {
        const parties = this.extractParties(body, requestor);
        this.responder.onRejectCall(body.streamId, body.requestid, requestor.id, parties.farparty, parties.members);
        return 'requested bridge rejection';
    }
    onAcceptCall(body, requestor) {
        const parties = this.extractParties(body, requestor);
        this.responder.onAcceptCall(body.streamId, body.requestid, requestor.id, parties.farparty, parties.members);
        return 'requested bridge acceptance';
    }
    onDropCall(body, requestor) {
        const parties = this.extractParties(body, requestor);
        this.responder.onDropCall(body.streamId, body.requestid, requestor.id, parties.farparty, parties.members);
        return 'requested bridge deactivation';
    }
    onPutOnHandset(body, requestor) {
        this.responder.onPutOnHandset(body.requestid, body.streamId, requestor.id);
        return 'requested handset activation';
    }
    onDropHandset(body, requestor) {
        this.responder.onDropHandset(body.requestid, body.bridgechannelnum, body.streamId, requestor.id);
        return 'requested handset deactivation';
    }
    extractParties(body, requestor) {
        const members = body.members.split(',');
        return { members, farparty: difference(members, [requestor.id.toString()])[0] };
    }
    respond(streamId, message, data) {
        this.emit('respondSimple', { streamId, message, data });
    }
}

module.exports = ExtensionServer;