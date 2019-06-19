var spotmap = L.map('spotmap');
var OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
});
OpenTopoMap.addTo(spotmap);

function onEachFeature(feature, layer) {
    if (feature.properties.type === 'UNLIMITED-TRACK') {
        layer.bindPopup(
            'Date: ' + feature.properties.date +
            'Time: ' + feature.properties.time);
    }
}

jQuery(document).ready(function () {
    jQuery.post(spotmapjsobj.ajax_url,{ 'action': 'the_ajax_hook'},function (response) {

        response.forEach(function(point){

        });
        console.log(JSON.stringify(response));
        L.geoJSON(response, {
            onEachFeature: onEachFeature
        }).addTo(spotmap);

        /*
        get the outermost points to set the map boarders accordingly
        DON'T ASK WHY, the long lat values are swapped fot the bounds:
        https://leafletjs.com/reference-1.5.0.html#latlngbounds
        TODO ensure all points are in the range*/
        var corner1 = [200,200], corner2 = [-200,-200];
        response.forEach(function (point) {
            if (corner1[1] > point.geometry.coordinates[0]){
                corner1[1] = point.geometry.coordinates[0];
            }
            if (corner1[0] > point.geometry.coordinates[1]){
                corner1[0] = point.geometry.coordinates[1];
            }
            if (corner2[1] < point.geometry.coordinates[0]){
                corner2[1] = point.geometry.coordinates[0];
            }
            if (corner2[0] < point.geometry.coordinates[1]){
                corner2[0] = point.geometry.coordinates[1];
            }
        });
        //console.log(JSON.stringify([corner2,corner1]));
        spotmap.fitBounds([
            corner2,
            corner1
        ]);
    });
});