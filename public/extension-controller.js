
var ethervoxSymphonyControllerService = SYMPHONY.services.register('ethervoxSymphony:controller');
var messageControllerService = SYMPHONY.services.register('message:controller');
var entities = {
    action: 'net.gltd.symphony.action',
    audience: 'net.gltd.symphony.audience',
    requestid: 'net.gltd.symphony.requestid',
    streamId: 'net.gltd.symphony.streamId',
    members: 'net.gltd.symphony.members',
    bridgechannelnum: 'net.gltd.symphony.bridgechannelnum',
};

SYMPHONY.remote.hello().then(onRemoteReady.bind(this));

function onRemoteReady(data) {  
    console.log('onRemoteReady', data)
    SYMPHONY.application
        .register('ethervox-symphony-extension', ['entity', 'extended-user-info'], ['ethervoxSymphony:controller', 'message:controller'])
        .then(onApplicationRegistered.bind(this))
}

function onApplicationRegistered(response) {
    console.log('onApplicationRegistered', response)
    var entityService = SYMPHONY.services.subscribe('entity');
    var extendedUserInfoService = SYMPHONY.services.subscribe('extended-user-info');

    extendedUserInfoService.getEmail().then(function(userEmail) {
        console.log('extendedUserInfoService.getEmail', userEmail)
        entityService.registerRenderer('net.gltd.symphony', {}, 'message:controller');
        messageControllerService.implement({
            render: function(type, entityData) {
                return renderEntityData(type, entityData, userEmail)
            },
        });
    }); 
}

function renderEntityData(type, entityData, userEmail) {
    console.log('renderEntityData.getEmail', type, entityData, userEmail)
    var data = { userEmail: userEmail };
    Object.keys(entities).forEach(function(entity) {
        var entityValue = getEntityValue(entityData, entities[entity]);
        if (entityValue) {
            data[entity] = entityValue;
        }
    });
    var iframeSrc = window.location.origin + "/button?data=" + window.btoa(JSON.stringify(data));
    return {
        template: '<messageML><iframe src="' + encodeURI(iframeSrc) + '"/></messageML>'
    }
}

function getEntityValue(entityData, type) {
    return entityData.id
        .filter(function(entity) { return entity.type === type })
        .map(function(entity) { return entity.value })
        .pop();
}