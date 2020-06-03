// block.js
( function( blocks, element, i18n) {
    var el = element.createElement;
    const { __ } = i18n;
    function renderMap( props ) {
        return el('div',{},
            el('div', {id: 'spotmap-container', 'data-mapcenter': 'all',style: {'height': 300+'px', 'max-width': 100+'%'}}),
            el('script', {type: 'text/javascript'},'jQuery( document ).ready(function() {initMap();});')
        )
    }
    blocks.registerBlockType( 'spotmap/spotmap', {
        title: __('Spotmap'),
        icon: 'location-alt',
        category: 'embed',
        edit: function( props ) {
            jQuery( document ).ready(function() {initMap();});
            return renderMap( props )
        },
 
        save: function( props ) {
            jQuery( document ).ready(function() {initMap();});
            return renderMap( props );
        },
        keywords: ['findmespot', 'spot', 'gps', __('map')],
    } );
} )(
    window.wp.blocks,
    window.wp.element,
    window.wp.i18n
);

function onEachFeature(feature, layer) {
    switch (feature.properties.type) {
        case 'CUSTOM':
        case 'OK':
            layer.bindPopup(
                'Date: ' + feature.properties.date + '</br>'
                + 'Time: ' + feature.properties.time + '</br>'
                + 'Message: ' + feature.properties.message);
            break;
        default:
            layer.bindPopup(
                'Date: ' + feature.properties.date + '</br>'
                + 'Time: ' + feature.properties.time);
    }
}

function initMap(options = {}) {
    try {
        var spotmap = L.map('spotmap-container', { fullscreenControl: true, });
    } catch (e){
        return;
    }
    var baseLayers = {"Mapbox Outdoors": L.tileLayer(
        'https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            tileSize: 512,
            accessToken: "pk.eyJ1IjoidGVjaHRpbW8iLCJhIjoiY2s2ODg4amxxMDJhYzNtcG03NnZoM2dyOCJ9.5hp1h0z5YPfqIpiP3UOs9w",
            zoomOffset: -1,
            attribution: '© <a href="https://apps.mapbox.com/feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        })};
    for (var map in spotmapjsobj.maps){
        console.log(spotmapjsobj.maps[map])
        baseLayers[map] = L.tileLayer(spotmapjsobj.maps[map],{ attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
    })
    }
    L.control.layers(baseLayers).addTo(spotmap);


    baseLayers[Object.keys(baseLayers)[0]].addTo(spotmap);
    jQuery.post(spotmapjsobj.ajaxUrl, { 'action': 'get_positions' }, function (response) {

        if (response.error) {
            spotmap.setView([51.505, -0.09], 13);
            response.title = response.title || "No data found!";
            response.message = response.message || "";
            var popup = L.popup()
                .setLatLng([51.5, -0.09])
                .setContent("<b>" + response.title + "</b><br>" + response.message)
                .openOn(spotmap);
            return;
        }

        L.geoJSON(response, {
            onEachFeature: onEachFeature
        }).addTo(spotmap);

        const mapcenter = options.mapcenter || "all";
        if (mapcenter == 'all') {
            // get the outermost points to set the map boarders accordingly
            var corner1 = [200, 200], corner2 = [-200, -200];
            response.forEach(function (point) {
                if (corner1[1] > point.geometry.coordinates[0]) {
                    corner1[1] = point.geometry.coordinates[0];
                }
                if (corner1[0] > point.geometry.coordinates[1]) {
                    corner1[0] = point.geometry.coordinates[1];
                }
                if (corner2[1] < point.geometry.coordinates[0]) {
                    corner2[1] = point.geometry.coordinates[0];
                }
                if (corner2[0] < point.geometry.coordinates[1]) {
                    corner2[0] = point.geometry.coordinates[1];
                }
            });
            //console.log(JSON.stringify([corner2,corner1]));
            spotmap.fitBounds([
                corner2,
                corner1
            ]);
        } else if (mapcenter == 'last') {
            var lastpoint = response[response.length - 1];
            spotmap.setView([lastpoint.geometry.coordinates[1], lastpoint.geometry.coordinates[0]], 13);
        }

    });
}
