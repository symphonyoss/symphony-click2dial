const io = require('socket.io-client');
const { get } = require('lodash');
const logger = require('./logger');
const apiPath = process.env.ETHER_VOX_API_PATH;
const etherVoxApiUrl = apiPath.replace('/api/v2/ethervox', '');
const protectedSocketPath = '/socket.io';
const token = process.env.ETHER_VOX_TOKEN;

class Socket {

  constructor(symphony, responder) {
    this.symphony = symphony;
    this.responder = responder;
    this.botUserId = symphony.botUser.id;

    const socket = io(etherVoxApiUrl, {
      path: protectedSocketPath,
      transports: ['websocket'],
      rejectUnauthorized: false,
      query: { token }
    });

    socket.on('connect', () => logger.log('Socket Connected'));
    socket.on('connect_error', logger.log);
    socket.on('community-event', e => {
      console.log(e.event, e['event-object'])
      if (e.event === 'DynamicLineRingDown') return this.onDynamicLineRingDown(e['event-object'])
      if (e.event === 'ConnectionState') return this.onConnectionState(e['event-object']);
      if (e.event === 'HandsetStatus') return this.onHandsetStatus(e['event-object']);
    });
  }

  onDynamicLineRingDown(event) {
    logger.log('onDynamicLineRingDown', event);
    const { requestid, myself, farparty } = event;
    const myselfExternal = myself.external.find(external => external.channel === 'symphony');
    const farpartyExternal = farparty.external.find(external => external.channel === 'symphony');
    const externalCallerID = myselfExternal.identifier;
    const externalCalledID = farpartyExternal.identifier;
    this.getUserMetadata(externalCallerID, externalCalledID)
      .then(([externalCallerUser, externalCalledUser]) => {
        const roomName = this.getRoomName(externalCallerUser, externalCalledUser);
        /** try to create the room V3 */
        this.symphony.createRoom(roomName, requestid)
          .then(room => {
            const roomId = room.roomSystemInfo.id;
            /** add members */
            this.symphony.addRoomMember(roomId, externalCallerID);
            this.symphony.addRoomMember(roomId, externalCalledID);
            /** send ring down message */
            this.responder.sendRingDownMessage(requestid, roomId, externalCallerID, [ externalCallerID, externalCalledID ]);
          })
          .catch(() => {
            /** search for exisiting room in case of creation failure */
            this.symphony.searchRoom(roomName).then(result => {
              const room = result.rooms[0];
              const roomId = room.roomSystemInfo.id;
              /** send ring down message */
              this.responder.sendRingDownMessage(requestid, roomId, externalCallerID, [ externalCallerID, externalCalledID ]);
            });
        })
      });
  }

  onConnectionState(event) {
    logger.log('onConnectionState', event);
    const { requestid, externalCalledID, state, externalCallerID } = event;

    /**
     * Pending
     */
    if (state === 'pending') {

      if (externalCallerID && externalCalledID) {

        this.getUserMetadata(externalCallerID, externalCalledID)
          .then(([externalCallerUser, externalCalledUser]) => {
            const roomName = this.getRoomName(externalCallerUser, externalCalledUser);
            /** try to create the room V3 */
            this.symphony.createRoom(roomName, requestid)
              .then(room => {
                const roomId = room.roomSystemInfo.id;
                /** add members */
                this.symphony.addRoomMember(roomId, externalCallerID);
                this.symphony.addRoomMember(roomId, externalCalledID);
                /** send pendingCallMessage */
                this.responder.sendPendingCallMessage(requestid, roomId, externalCalledID, [ externalCallerID, externalCalledID ]);
              })
              .catch(() => {
                /** search for exisiting room in case of creation failure */
                this.symphony.searchRoom(roomName).then(result => {
                  const room = result.rooms[0];
                  const roomId = room.roomSystemInfo.id;
                  /** send pendingCallMessage */
                  this.responder.sendPendingCallMessage(requestid, roomId, externalCalledID, [ externalCallerID, externalCalledID ]);
                });
              })
          });
      }
    }

    /**
     * Rejected
     */
    if (state === 'rejected') {
      if (externalCallerID && externalCalledID) {

        /** send callSeparatorMessage to the chat with externalCallerID */
        this.symphony.createIM([ externalCallerID, this.botUserId ]).then(({ id }) => {
          this.responder.sendCallSeparatorMessage(id);
        });

        /** send callSeparatorMessage to the chat with externalCalledID */
        this.symphony.createIM([ externalCalledID, this.botUserId ]).then(({ id }) => {
          this.responder.sendCallSeparatorMessage(id);
        });

        this.getUserMetadata(externalCallerID, externalCalledID)
          .then(([externalCallerUser, externalCalledUser]) => {
            const roomName = this.getRoomName(externalCallerUser, externalCalledUser);
            /** search for room v3 */
            this.symphony.searchRoom(roomName).then(result => {
              const room = result.rooms[0];
              const roomId = room.roomSystemInfo.id;
              /** send callSeparatorMessage */
              this.responder.sendCallSeparatorMessage(roomId);
              /** send requestCallMessage */
              this.responder.sendRequestCallMessage(roomId, [ externalCallerID, externalCalledID ]);
            });
        });
      }
    }

    /**
     * established
     */
    else if (state === 'established') {
      /** push putOnHandsetMessage to chat with externalCalledID user */
      this.symphony.createIM([ externalCalledID, this.botUserId ]).then(({ id }) => {
        this.responder.sendPutOnHandsetMessage(requestid, id);
      });
      if (externalCallerID) {
        /** push putOnHandsetMessage to chat with externalCallerID user */
        this.symphony.createIM([ externalCallerID, this.botUserId ]).then(({ id }) => {
          this.responder.sendPutOnHandsetMessage(requestid, id);
        });

        this.getUserMetadata(externalCallerID, externalCalledID)
          .then(([externalCallerUser, externalCalledUser]) => {
            const roomName = this.getRoomName(externalCallerUser, externalCalledUser);
            /** search for room v3 */
            this.symphony.searchRoom(roomName).then(result => {
              const room = result.rooms[0];
               const roomId = room.roomSystemInfo.id;
              /** send dropHandsetMessage */
              this.responder.sendDropCallMessage(requestid, externalCallerID, roomId, [ externalCallerID, externalCalledID ]);
            });
        });
      }
    }
  }

  onHandsetStatus(event) {
    logger.log('onHandsetStatus', event);
    const { status, externalMember, requestid, call, myself, farparty } = event;
    if (status === 'connected' && call) {

      const myselfExternal = myself.external.find(external => external.channel === 'symphony');
      const farpartyExternal = farparty.external.find(external => external.channel === 'symphony');
      /** push dropHandsetMessage to chat with externalMember user */
      this.symphony.createIM([ myselfExternal.identifier, this.botUserId ]).then(({ id }) => {
        this.responder.sendDropHandsetMessage( requestid, id, call.bridgechannelnum);
      });

      this.getUserMetadata(myselfExternal.identifier, farpartyExternal.identifier)
        .then(([externalCallerUser, externalCalledUser]) => {
          const roomName = this.getRoomName(externalCallerUser, externalCalledUser);
          /** try to create the room V3 */
          this.symphony.createRoom(roomName, requestid)
            .then(room => {
              const roomId = room.roomSystemInfo.id;
              /** add members */
              this.symphony.addRoomMember(roomId, myselfExternal.identifier);
              this.symphony.addRoomMember(roomId, farpartyExternal.identifier);
              /** send handset activation message */
              this.responder.sendHandsetActivationMessage(requestid, roomId, myselfExternal.identifier, [ myselfExternal.identifier, farpartyExternal.identifier ]);
            })
            .catch(() => {
              /** search for exisiting room in case of creation failure */
              this.symphony.searchRoom(roomName).then(result => {
                const room = result.rooms[0];
                const roomId = room.roomSystemInfo.id;
                /** send handset activation message */
                this.responder.sendHandsetActivationMessage(requestid, roomId, myselfExternal.identifier, [ myselfExternal.identifier, farpartyExternal.identifier ]);
              });
          })
        });
    }
    else if (status === 'disconnected') {
      /** push putOnHandsetMessage to chat with externalMember user */
      this.symphony.createIM([ externalMember.identifier, this.botUserId ]).then(({ id }) => {
        this.responder.sendPutOnHandsetMessage(requestid, id);
      });
    }
  }

  /** returns symphony metadata */
  getUserMetadata(externalCallerID, externalCalledID) {
    return Promise
        .all([this.symphony.searchUsers(externalCallerID), this.symphony.searchUsers(externalCalledID)])
        .then(([ externalCallerUserResult, externalCalledUserResult ]) =>
          ([
            get(externalCallerUserResult, 'users[0]'),
            get(externalCalledUserResult, 'users[0]')
          ])
        );
  }

  getRoomName(...users) {
    return `${users.map(user => user.displayName).join(', ')} - Dynamic Bridge`;
  }
}

module.exports = Socket;
