class Message {
    constructor(type) {
        const typeHandlers = {
            'CONFIRMED_MEMBER': this.buildConfirmedMemberMessage,
        };
        if (typeHandlers[type]) {
            typeHandlers[type].call(this);
        }
        else if (type) {
            throw 'Message type not recognized';
        }
    }
    buildConfirmedMemberMessage() {
        this.body = `
            <h3>Great! It looks like you are registered with etherVox.</h3>
        `;
        return this;
    }

    buildHandsetActivationMessage(requestid, streamId, farparty, members) {
      const mentions = members ? members.map(memberId => `<mention uid="${memberId}"/>`).join(', ') : '';
      this.body = `
        ${mentions}<br/>
        CallID: ${requestid}<br/>
        <br/>
        <mention uid="${farparty}"/> activated his Handset`;
      this.structuredObject = {
        availableActions: {
          type: 'net.gltd.symphony',
          version: '1.0',
          id: [{
              type: 'net.gltd.symphony.streamId',
              value: streamId
          }, {
              type: 'net.gltd.symphony.audience',
              value: farparty
          }, {
              type: 'net.gltd.symphony.members',
              value: members
          }, {
              type: 'net.gltd.symphony.requestid',
              value: requestid
          }, {
              type: 'net.gltd.symphony.action',
              value: 'ringDown'
          }]
        }
      };
      return this;
    }

    buildRingDownMessage(requestid, streamId, farparty, members) {
      const mentions = members ? members.map(memberId => `<mention uid="${memberId}"/>`).join(', ') : '';
      this.body = `
        ${mentions}<br/>
        CallID: ${requestid}<br/>
        <br/>
        <mention uid="${farparty}"/> sent ringdown signal`;
      this.structuredObject = {
        availableActions: {
          type: 'net.gltd.symphony',
          version: '1.0',
          id: [{
              type: 'net.gltd.symphony.streamId',
              value: streamId
          }, {
              type: 'net.gltd.symphony.audience',
              value: farparty
          }, {
              type: 'net.gltd.symphony.members',
              value: members
          }, {
              type: 'net.gltd.symphony.requestid',
              value: requestid
          }, {
              type: 'net.gltd.symphony.action',
              value: 'ringDown'
          }]
        }
      };
      return this;
  }

    buildPendingCallMessage(requestid, streamId, farparty, members) {
        this.body = `
            <mention uid="${farparty}"/><br/>
            CallID: ${requestid}<br/>
            Available actions:<br/>
            <div class="entity" data-entity-id="availableActions"> (etherVox Extension is not installed) </div>`;
        this.structuredObject = {
            availableActions: {
                type: 'net.gltd.symphony',
                version: '1.0',
                id: [{
                    type: 'net.gltd.symphony.streamId',
                    value: streamId
                }, {
                    type: 'net.gltd.symphony.audience',
                    value: farparty
                }, {
                    type: 'net.gltd.symphony.members',
                    value: members
                }, {
                    type: 'net.gltd.symphony.requestid',
                    value: requestid
                }, {
                    type: 'net.gltd.symphony.action',
                    value: 'pendingCall'
                }]
            }
        };
        return this;
    }

    buildDropCallMessage(requestid, caller, streamId, members) {
        this.body = `
            <mention uid="${caller}"/><br/>
            CallID: ${requestid}<br/>
            Available actions:<br/>
            <div class="entity" data-entity-id="availableActions"> (etherVox Extension is not installed) </div>
        `;
        this.structuredObject = {
            availableActions: {
                type: 'net.gltd.symphony',
                version: '1.0',
                id: [{
                    type: 'net.gltd.symphony.streamId',
                    value: streamId
                }, {
                    type: 'net.gltd.symphony.audience',
                    value: caller
                }, {
                    type: 'net.gltd.symphony.members',
                    value: members
                }, {
                    type: 'net.gltd.symphony.requestid',
                    value: requestid
                }, {
                    type: 'net.gltd.symphony.action',
                    value: 'dropCall'
                }]
            }
        };
        return this;
    }
    buildPutOnHandsetMessage(requestid, streamId) {
        this.body = `
            CallID: ${requestid}<br/>
            Available actions:<br/>
            <div class="entity" data-entity-id="availableActions"> (etherVox Extension is not installed) </div>
        `;
        this.structuredObject = {
            availableActions: {
                type: 'net.gltd.symphony',
                version: '1.0',
                id: [{
                    type: 'net.gltd.symphony.streamId',
                    value: streamId
                }, {
                    type: 'net.gltd.symphony.requestid',
                    value: requestid
                }, {
                    type: 'net.gltd.symphony.action',
                    value: 'putOnHandset'
                }]
            }
        };
        return this;
    }
    buildDropHandsetMessage(requestid, streamId, bridgechannelnum) {
        this.body = `
            CallID: ${requestid}<br/>
            Available actions:<br/>
            <div class="entity" data-entity-id="availableActions"> (etherVox Extension is not installed) </div>
        `;
        this.structuredObject = {
            availableActions: {
                type: 'net.gltd.symphony',
                version: '1.0',
                id: [{
                    type: 'net.gltd.symphony.bridgechannelnum',
                    value: bridgechannelnum
                }, {
                    type: 'net.gltd.symphony.streamId',
                    value: streamId
                }, {
                    type: 'net.gltd.symphony.requestid',
                    value: requestid
                }, {
                    type: 'net.gltd.symphony.action',
                    value: 'dropHandset'
                }]
            }
        };
        return this;
    }
    buildCallSeparatorMessage() {
      this.body = `
        <br/>
        <br/>
        *********************************************************** Bridge has been destroyed! ***********************************************************<br/>
        <br/>
        <br/>
        <br/>`;

      return this;
    }
    buildRequestCallMessage(streamId, members) {
        const mentions = members ? members.map(memberId => `<mention uid="${memberId}"/>`).join(', ') : '';
        this.body = `
            ${mentions}<br/>
            Available actions:<br/>
            <div class="entity" data-entity-id="availableActions"> (etherVox Extension is not installed) </div>
        `;
        this.structuredObject = {
            availableActions: {
                type: 'net.gltd.symphony',
                version: '1.0',
                id: [{
                    type: 'net.gltd.symphony.streamId',
                    value: streamId
                }, {
                    type: 'net.gltd.symphony.members',
                    value: members
                }, {
                    type: 'net.gltd.symphony.action',
                    value: 'requestCall'
                }]
            }
        };
        return this;
    }
    buildNotificationMessage(message) {
        this.body = `<h4>${message}</h4>`;
        return this;
    }
    buildRegistrationMessage(authUrl) {
        this.body = `
            <h3>Registration is required.</h3>
            <b>> <a href="${authUrl}">Click here to register.</a></b>`;
        return this;
    }
    buildGenericErrorMessage(error) {
        this.body = `
            <h3>An error occured!</h3>
            <b class="color--theme-accent">${error}</b>`;
        return this;
    }
    buildAny(body, structuredObject = false) {
        this.body = body;
        this.structuredObject = structuredObject || this.structuredObject;
        return this;
    }
    addNotification(notification) {
        this.body = `
            <h4>${notification}</h4><br/>
            ${this.body}`;
        return this;
    }
    data() {
        return this.structuredObject;
    }
    get() {
        return this.body;
    }
}

module.exports = Message;
