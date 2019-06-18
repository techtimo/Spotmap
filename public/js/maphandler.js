var spotmap = L.map('spotmap').setView([-45,170], 7);
var OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
});
OpenTopoMap.addTo(spotmap);

function onEachFeature(feature, layer) {
    // does this feature have a property named popupContent?
    if (feature.properties.type === 'UNLIMITED-TRACK') {
        layer.bindPopup('Time: ' + feature.properties.time);
    }
}

jQuery(document).ready(function () {
    jQuery.post(spotmapjsobj.ajax_url,{ 'action': 'the_ajax_hook'},function (response) {
        console.log(response);
        L.geoJSON(response, {
            onEachFeature: onEachFeature
        }).addTo(spotmap);

    });
});