const difference = require('lodash/difference');
const get = require('lodash/get');
const EventEmitter = require('events');

const Message = require('./message');
const EtherVox = require('./ether-vox');
class Responder extends EventEmitter {
    constructor(symphony) {
        super();
        this.botUser = symphony.botUser;
        this.symphony = symphony;
        this.etherVox = new EtherVox();
    }
    handle(event) {
        const eventTypeHandlers = {
            'MESSAGESENT': this.onMessageSent,
            'USERJOINEDROOM': this.onUserJoinedRoom,
            'INSTANTMESSAGECREATED': this.onInstantMessageCreated,
            'ROOMCREATED': this.onRoomCreated
        };
        (eventTypeHandlers[event.type] || this.onUnknown).call(this, event);
    }
    onMessageSent(event) {
        const message = event.payload.messageSent.message;
        if (this.isUserMessage(message)) {
            this.etherVox.checkMember(message.user.userId)
                .then(response => !response.body ? this.callToRegister(message.user.userId, message.stream.streamId) : true)
                .then(isMember => isMember ? this.handleMemberMessage(message) : null);
        }
    }
    handleMemberMessage(message) {
        return message.stream.streamType === 'IM'
            ? this.handleIMMessage(message)
            : this.handleRoomMessage(message);
    }
    handleIMMessage(message) {
        if (this.containsResponse(message, 'putOnHandset')) {
            const requestid = this.extractParameter(message);
            this.onPutOnHandset(requestid, message.stream.streamId, message.user.userId);
        }
        else if (this.containsResponse(message, 'dropHandset')) {
            const parameters = this.extractParameter(message).split('_');
            const requestid = parameters[0];
            const bridgechannelnum = parameters[1];
            this.onDropHandset(requestid, bridgechannelnum, message.stream.streamId, message.user.userId);
        }
        else if (this.isManMessage(message)) {
            this.onManRequest(message);
        }
        else {
            this.respondConfirmedMember(message.stream.streamId);
        }
    }
    handleRoomMessage(message) {
        this.symphony.getStreamMembers(message.stream.streamId)
            .then(streamMembers => {
                const members = difference(streamMembers.map(member => member.id), [this.botUser.id]);
                const farparty = difference(members, [message.user.userId]);
                if (this.containsResponse(message, 'requestCall')) {
                    this.onRequestCall(message.stream.streamId, message.user.userId, farparty, members);
                }
                else if (this.containsResponse(message, 'acceptCall')) {
                    const requestid = this.extractParameter(message);
                    this.onAcceptCall(message.stream.streamId, requestid, message.user.userId, farparty, members);
                }
                else if (this.containsResponse(message, 'rejectCall')) {
                    const requestid = this.extractParameter(message);
                    this.onRejectCall(message.stream.streamId, requestid, message.user.userId, farparty, members);
                }
                else if (this.containsResponse(message, 'dropCall')) {
                    const requestid = this.extractParameter(message);
                    this.onDropCall(message.stream.streamId, requestid, message.user.userId, farparty, members);
                }
                else if (this.isManMessage(message)) {
                    this.onManRequest(message);
                }
            });
    }
    onManRequest(message) {
        this.symphony.getLastBotActionMessage(message.stream.streamId).then(response => {
            if (response && response.length) {
                const lastBotActionMessage = JSON.parse(response[0].data);
                const intendedAction = lastBotActionMessage.availableActions.id.find(action => action.type === 'net.gltd.symphony.action');
                if (intendedAction && intendedAction.value) {
                    this.repeatMessage(intendedAction, lastBotActionMessage.availableActions, response[0]);
                }
            }
        });
    }
    repeatMessage(intendedAction, lastBotActionMessageData, lastBotActionMessage) {
        const audience = lastBotActionMessageData.id.find(data => data.type === 'net.gltd.symphony.audience');
        const members = lastBotActionMessageData.id.find(data => data.type === 'net.gltd.symphony.members');
        const requestid = lastBotActionMessageData.id.find(data => data.type === 'net.gltd.symphony.requestid');
        const bridgechannelnum = lastBotActionMessageData.id.find(data => data.type === 'net.gltd.symphony.bridgechannelnum');
        const caller = members && audience ? difference(members.value, audience.value)[0] : null;
        const messageToRepeat = {
            'requestCall': streamId => this.sendRequestCallMessage(streamId, members.value),
            'pendingCall': streamId => this.validateCallState(streamId, requestid.value, 'request|pending')
                .then(() => this.sendPendingCallMessage(requestid.value, streamId, audience.value, members.value))
                .catch(() => this.sendRequestCallMessage(streamId, members.value)),
            'dropCall': streamId => this.validateCallState(streamId, requestid.value, 'established|accepted')
                .then(() => this.sendDropCallMessage(requestid.value, caller, streamId, members.value))
                .catch(() => this.sendRequestCallMessage(streamId, members.value)),
            'putOnHandset': streamId => this.validateCallState(streamId, requestid.value, 'established|accepted')
                .then(() => this.sendPutOnHandsetMessage(requestid.value, streamId))
                .catch(() => this.sendNotificationMessage(streamId, `This bridge doesn't exist anymore`)),
            'dropHandset': streamId => this.validateCallState(streamId, requestid.value, 'established|accepted')
                .then(() => this.sendDropHandsetMessage(requestid.value, streamId, bridgechannelnum.value))
                .catch(() => this.sendNotificationMessage(streamId, `This bridge doesn't exist anymore`))
        };
        (messageToRepeat[intendedAction.value] || noop)(lastBotActionMessage.stream.streamId);
    }
    sendCallSeparatorMessage(streamId) {
      const response = new Message();
      response.buildCallSeparatorMessage();
      return this.respond(streamId, response.get(), response.data());
    }
    onPutOnHandset(requestid, streamId, userId) {
        return this.validateCallState(streamId, requestid, 'established|accepted')
            .then(() => this.etherVox.putOnHandset(requestid, userId.toString())
                // .then(response => this.sendDropHandsetMessage(requestid, streamId, response.body.bridgechannelnum))
                .catch(error => this.onEtherVoxError(streamId, error.response.text))
            )
            .catch(call => this.onCallValidationError(streamId, requestid, 'established|accepted', call.state));
    }
    sendDropHandsetMessage(requestid, streamId, bridgechannelnum) {
        const response = new Message();
        response.buildDropHandsetMessage(requestid, streamId, bridgechannelnum);
        return this.respond(streamId, response.get(), response.data());
    }
    onDropHandset(requestid, bridgechannelnum, streamId, userId) {
        return this.validateCallState(streamId, requestid, 'established|accepted')
            .then(() => this.etherVox.dropHandset(requestid, userId.toString(), bridgechannelnum)
                // .then(() => this.sendPutOnHandsetMessage(requestid, streamId))
                .catch(error => this.onEtherVoxError(streamId, error.response.text))
            )
            .catch(call => this.onCallValidationError(streamId, requestid, 'established|accepted', call.state));
    }
    sendPutOnHandsetMessage(requestid, streamId) {
        const response = new Message();
        response.buildPutOnHandsetMessage(requestid, streamId);
        return this.respond(streamId, response.get(), response.data());
    }
    onRequestCall(streamId, userId, farparty, members) {
        return this.etherVox
            .requestCall(userId.toString(), farparty.toString())
            // .then(response => this.sendPendingCallMessage(response.body.requestid, streamId, farparty, members))
            .catch(error => this.onEtherVoxError(streamId, error.response.text));
    }
    sendPendingCallMessage(requestid, streamId, farparty, members) {
        const response = new Message();
        response.buildPendingCallMessage(requestid, streamId, farparty, members);
        return this.respond(streamId, response.get(), response.data());
    }
    onAcceptCall(streamId, requestid, userId, farparty, members) {
        return this.validateCallState(streamId, requestid, 'request|pending')
            .then(() => this.etherVox.acceptCall(requestid, userId.toString())
                // .then(response => this.handleAcceptCall(streamId, requestid, userId, farparty, members))
                .catch(error => this.onEtherVoxError(streamId, error.response.text))
            )
            .catch(() => this.sendRequestCallMessage(streamId, members, `This bridge doesn't exist anymore`));
    }
    handleAcceptCall(streamId, requestid, userId, farparty, members) {
        const caller = difference(members, farparty)[0];
        this.sendDropCallMessage(requestid, caller, streamId, members);
        const IMToCreateUserIDs = members.map(memberId => [this.botUser.id, memberId]);
        const IMToCreatePromises = IMToCreateUserIDs.map(userIDs => this.symphony.createIM(userIDs));

        return Promise.all(IMToCreatePromises).then(responses => {
            const streamIds = responses.map(response => response.id);
            streamIds.forEach(_streamId => {
                const responseMessage = new Message();
                responseMessage.buildPutOnHandsetMessage(requestid, _streamId);
                return this.respond(_streamId, responseMessage.get(), responseMessage.data());
            });
        });
    }
    sendDropCallMessage(requestid, caller, streamId, members) {
        const responseMessage = new Message();
        responseMessage.buildDropCallMessage(requestid, caller, streamId, members);
        this.respond(streamId, responseMessage.get(), responseMessage.data());
    }
    onRejectCall(streamId, requestid, userId, farparty, members) {
        return this.validateCallState(streamId, requestid, 'request|pending')
            .then(() => this.onCommonCallRejection(streamId, requestid, userId, farparty, members))
            .catch(() => this.sendRequestCallMessage(streamId, members, `This bridge doesn't exist anymore`));
    }
    onDropCall(streamId, requestid, userId, farparty, members) {
        return this.validateCallState(streamId, requestid, 'established|accepted')
            .then(() => this.onCommonCallRejection(streamId, requestid, userId, farparty, members))
            .catch(() => this.sendRequestCallMessage(streamId, members, `This bridge doesn't exist anymore`));
    }
    onCommonCallRejection(streamId, requestid, userId, farparty, members) {
        return this.etherVox
            .rejectCall(requestid, userId.toString())
            // .then(() => this.sendRequestCallMessage(streamId, members))
            .catch(error => this.onEtherVoxError(streamId, error.response.text));
    }
    sendRequestCallMessage(streamId, members, notification) {
        const responseMessage = new Message();
        responseMessage.buildRequestCallMessage(streamId, members);
        if (notification) {
          responseMessage.addNotification(notification);
        }
        return this.respond(streamId, responseMessage.get(), responseMessage.data());
    }
    sendRingDownMessage(requestid, streamId, farparty, members) {
      const response = new Message();
      response.buildRingDownMessage(requestid, streamId, farparty, members);
      return this.respond(streamId, response.get(), response.data());
    }
    sendHandsetActivationMessage(requestid, streamId, farparty, members) {
      const response = new Message();
      response.buildHandsetActivationMessage(requestid, streamId, farparty, members);
      return this.respond(streamId, response.get(), response.data());
    }
    containsResponse(message, response) {
        return message.message.indexOf(response) > -1;
    }
    extractParameter(message) {
        return message.message.match(/_(.*)</)[1];
    }
    onEtherVoxError(streamId, error) {
        const response = new Message();
        return this.respond(streamId, response.buildGenericErrorMessage(error).get());
    }
    sendNotificationMessage(streamId, notification) {
        const response = new Message();
        return this.respond(streamId, response.buildNotificationMessage(notification).get());
    }
    onUserJoinedRoom(event) {
        const userId = event.payload.userJoinedRoom.affectedUser.userId;
        const streamId  = event.payload.userJoinedRoom.stream.streamId;
        return this.checkMember(userId, streamId);
    }
    onInstantMessageCreated(event) {
        const userId = event.initiator.user.userId;
        const streamId  = event.payload.instantMessageCreated.stream.streamId;
        return this.checkMember(userId, streamId);
    }
    onRoomCreated(event) {
      if (event.initiator.user.userId !== this.botUser.id) {
        const streamId = event.payload.roomCreated.stream.streamId;
        this.symphony.getStreamMembers(streamId).then(members => {
          const userIds = members
            .filter(member => member.id !== this.botUser.id)
            .map(member => member.id);
          this.sendRequestCallMessage(streamId, userIds);
        });
      }
    }
    checkMember(userId, streamId) {
        return userId !== this.botUser.id
          ? this.etherVox.checkMember(userId).then(response => !response.body ? this.callToRegister(userId, streamId) : true)
          : Promise.resolve(true);
    }
    onUnknown(event) {
        this.emit('handleUnknown', event);
    }
    onCallValidationError(streamId, requestid, expectedState, givenState) {
        const response = new Message();
        let error = `Call ${requestid} is not in ${expectedState} state`;
        error += givenState ? ` (${givenState} instead)` : '';
        return this.respond(streamId, response.buildGenericErrorMessage(error).get());
    }
    validateCallState(streamId, requestid, state) {
        return new Promise((resolve, reject) => this.etherVox
            .getCall(requestid)
            .then(response => state.split('|').indexOf(response.body.state) > -1 ? resolve() : reject(response.body))
            .catch(error => reject(get(error, 'response.text'))));
    }
    callToRegister(userId, streamId) {
        this.etherVox
            .getAuthURL(userId)
            .then(res => {
                const response = new Message();
                response.buildRegistrationMessage(res.text);
                this.respond(streamId, response.get());
            });
        return false;
    }
    respond(streamId, message, data) {
        this.emit('respond', { streamId, message, data });
        return Promise.resolve();
    }
    isUserMessage(message) {
        return message.user.userId !== this.botUser.id;
    }
    isManMessage({ data }) {
        if (data) {
            const parsed = JSON.parse(data);
            return Object.keys(parsed)
                .filter(key => parsed[key].type === 'com.symphony.user.mention')
                .map(key => parsed[key].id[0])
                .find(mention => mention.type === 'com.symphony.user.userId' && mention.value.toString() === this.botUser.id.toString());
        }
        else {
            return false;
        }
    }
    respondConfirmedMember(streamId) {
        const response = new Message('CONFIRMED_MEMBER');
        this.respond(streamId, response.get());
        return true;
    }
}

module.exports = Responder;
