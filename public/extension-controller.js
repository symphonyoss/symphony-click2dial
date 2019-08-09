
var ethervoxSymphonyControllerService = SYMPHONY.services.register('ethervoxSymphony:controller');
var messageControllerService = SYMPHONY.services.register('message:controller');
var etherVoxControllerService = SYMPHONY.services.register("etherVox:controller");
const symphonyUrl = 'https://foundation-dev-api.symphony.com';

var entities = {
    action: 'net.gltd.symphony.action',
    audience: 'net.gltd.symphony.audience',
    requestid: 'net.gltd.symphony.requestid',
    streamId: 'net.gltd.symphony.streamId',
    members: 'net.gltd.symphony.members',
    bridgechannelnum: 'net.gltd.symphony.bridgechannelnum',
};

SYMPHONY.remote.hello()
  .then(authenticate)
  .then(onRemoteReady.bind(this));

function authenticate(response) {

	console.log('Response authenticate: ', response);
	companyId = ''+ response.pod;

	// /authenticate returns app token in body (only)
	return fetch(symphonyUrl + '/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'text-text',
      body: JSON.stringify(companyId)
    }
  })
	.then(function(data)
			{
		appToken = data;
		return Q({appId: appId, tokenA: data});
			}.bind(this));
}

function onRemoteReady(data) {
    console.log('onRemoteReady', data)
    SYMPHONY.application
        .register(
          'ethervox-symphony-extension',
          ['entity', 'extended-user-info', 'modules', 'applications-nav', 'ui'],
          ['ethervoxSymphony:controller', 'message:controller', 'modules:controller', 'etherVox:controller']
        ).then(onApplicationRegistered.bind(this))
}

function onApplicationRegistered(response) {
    console.log('onApplicationRegistered', response)

    var modulesService = SYMPHONY.services.subscribe('modules');
    var applicationsNavService = SYMPHONY.services.subscribe('applications-nav');
    var entityService = SYMPHONY.services.subscribe('entity');
    var extendedUserInfoService = SYMPHONY.services.subscribe('extended-user-info');
    var uiService = SYMPHONY.services.subscribe("ui");

        // UI: Add elements to the Symphony user interface:
    // buttons on IMs/MIMs/rooms, links on cashtag/hashtag hover cards and settings
    uiService.registerExtension("single-user-im", "hello-im", "etherVox:controller", {label: "Request Contact", data: {"datetime": Date()}});
    // uiService.registerExtension("multi-user-im", "hello-mim", "etherVox:controller", {label: "MIM Button"});
    // uiService.registerExtension("room", "hello-room", "etherVox:controller", {label: "Room Button"});
    // uiService.registerExtension("profile", "hello-profile", "etherVox:controller", {label: "Profile Button"});
    // uiService.registerExtension("hashtag", "hello-hashtag", "etherVox:controller", {label: "Hashtag Link"});
    // uiService.registerExtension("cashtag", "hello-cashtag", "etherVox:controller", {label: "Cashtag Link"});
    // uiService.registerExtension("settings", "hello-settings", "etherVox:controller", {label: "Settings Link"});



    applicationsNavService.add("ethervox-nav", "etherVox", "etherVox:controller");

    etherVoxControllerService.implement({
        select: function(id) {
          if (id == "ethervox-nav") {
            modulesService.show(
                "etherVox",
                {
			            title: "etherVox"
                },
               "etherVox:controller",
	              "https://ethervox-symphony-dashboard.gltd.net",
                // "https://localhost:8060/dashboard/dist/ev-dashboard/index.html#hall",
               //"https://ethervox-symphony-bot.gltd.net/dashboard/dist/ev-dashboard/index.html",
                {
                  "canFloat": true
                }
              );
          }
        }
      });

    extendedUserInfoService.getEntitlement().then(a => console.log(a))
    extendedUserInfoService.getJwt().then(console.log)

    extendedUserInfoService.getEmail().then(function(userEmail) {
        console.log('extendedUserInfoService.getEmail', userEmail, extendedUserInfoService)
        entityService.registerRenderer('net.gltd.symphony', {}, 'message:controller');
        messageControllerService.implement({
            render: function(type, entityData) {
                return renderEntityData(type, entityData, userEmail)
            },
        });
        etherVoxControllerService.implement({
          trigger: function(uiClass, id, payload, data) {
            if (uiClass == "single-user-im") {
                console.log('IM button was clicked on ' + data.datetime + '.');
            }
            // else if (uiClass == "multi-user-im") {
            //     console.log('MIM button was clicked.');
            // } else if (uiClass == "room") {
            //     console.log('Room button was clicked.');
            // } else if (uiClass == "profile") {
            //     console.log('Profile button was clicked.');
            // } else if (uiClass == "hashtag") {
            //     console.log('Hashtag link was clicked.');
            // } else if (uiClass == "settings") {
            //     console.log('Settings link was clicked.')
            // }
            console.log({uiClass, id, payload, data, userEmail});
        },
        })
    });


}

function renderEntityData(type, entityData, userEmail) {
    var data = { userEmail: userEmail };
    Object.keys(entities).forEach(function(entity) {
        var entityValue = getEntityValue(entityData, entities[entity]);
        if (entityValue) {
            data[entity] = entityValue;
        }
    });
    // var iframeSrc = window.location.origin + "/button?data=" + window.btoa(JSON.stringify(data));
    var iframeSrc = "https://ethervox-symphony-bot.gltd.net/button?data=" + window.btoa(JSON.stringify(data));
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
