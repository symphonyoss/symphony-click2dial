(function() {

    var attributes = ['userEmail', 'requestid', 'audience', 'streamId', 'members', 'bridgechannelnum'];
    
    document.querySelectorAll('.tempo-btn').forEach(bindClick.bind(this));

    function bindClick(node) {
        node.addEventListener('click', onButtonClick.bind(this));
    }

    function onButtonClick(event) {
        var data = {
            action: event.target.getAttribute('data-action')
        };
        attributes.forEach(function(attribute) {
            var attrEl = document.getElementById(attribute);
            if (attrEl) {
                data[attribute] = attrEl.value;
            }
        });
        fetch('/button', {
            method: 'POST',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

})();