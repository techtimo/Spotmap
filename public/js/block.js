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
        baseLayers[map] = L.tileLayer(spotmapjsobj.maps[map])
    }

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

        var overlays = {},
            devices = [response[0].device],
            group = [], 
            line = [];
        response.forEach((entry,index) => {
            if(devices[devices.length-1] != entry.device){
                console.log(devices)
                group.push(L.polyline(line, {color: 'red'}))
                overlays[devices[devices.length-1]] = L.layerGroup(group).addTo(spotmap);
                line,group = [];
                devices.push(entry.device);
            } else {
                line.push([entry.latitude, entry.longitude]);
                if(['CUSTOM','OK','NEWMOVEMENT','STATUS'].includes(entry.type)){
                    let message = 'Date: ' + entry.date + '</br>Time: ' + entry.time + '</br>';
                    if(entry.custom_message)
                        message += 'Message: ' + entry.custom_message;
                    let marker = L.marker([entry.latitude, entry.longitude]).bindPopup(message);
                    group.push(marker);
                }
            }
            
            if(response.length == index+1){
                group.push(L.polyline(line, {color: 'green'}));
                overlays[devices[devices.length-1]] = L.layerGroup(group).addTo(spotmap);
                devices.push(entry.device);
            }
        });

        if(devices.length == 1)
            L.control.layers(baseLayers).addTo(spotmap);
        else
            L.control.layers(baseLayers,overlays).addTo(spotmap);

        var polyline = L.polyline(line, {color: 'red'});
        // zoom the map to the polyline
        spotmap.fitBounds(polyline.getBounds());

    });
}
