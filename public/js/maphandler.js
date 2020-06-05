function initMap(options = {devices: [], styles: {}}) {
    try {
        var spotmap = L.map('spotmap-container', { fullscreenControl: true, });
    } catch (e){
        return;
    }
    var Marker = L.Icon.extend({
        options: {
            shadowUrl: spotmapjsobj.url +'leaflet/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }
    });
    var TinyMarker = L.Icon.extend({
        options: {
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            popupAnchor: [0, 0]
        }
    });
    markers = {
        blue: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-blue.png'}),
        gold: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-gold.png'}),
        red: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-red.png'}),
        green: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-green.png'}),
        orange: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-orange.png'}),
        yellow: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-yellow.png'}),
        violet: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-violet.png'}),
        gray: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-gray.png'}),
        black: new Marker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-black.png'}),
        tiny:{
            blue: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-blue.png'}),
            gold: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-gold.png'}),
            red: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-red.png'}),
            green: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-green.png'}),
            orange: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-orange.png'}),
            yellow: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-yellow.png'}),
            violet: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-violet.png'}),
            gray: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-gray.png'}),
            black: new TinyMarker({iconUrl: spotmapjsobj.url +'leaflet/images/marker-tiny-icon-black.png'}),
        }
    };

    var blue_tiny = L.icon({
        iconUrl: spotmapjsobj.url +'leaflet/images/marker-icon-smallest.png',
        iconSize:     [10, 10], // size of the icon
        iconAnchor:   [5, 5], // point of the icon which will correspond to marker's location
        popupAnchor:  [-5, -5] // point from which the popup should open relative to the iconAnchor
    });

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
    jQuery.post(spotmapjsobj.ajaxUrl, { 'action': 'get_positions', 'devices': options.devices }, function (response) {

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
                let lastDevice = devices[devices.length-1];
                let color = 'blue';
                if(options.styles[lastDevice].color)
                    color = options.styles[lastDevice].color;
                group.push(L.polyline(line, {color: color}))
                overlays[lastDevice] = L.layerGroup(group).addTo(spotmap);
                line = [];
                group = [];
                devices.push(entry.device);
            } else {
                let color = 'blue';
                if(options.styles[entry.device].color)
                    color = options.styles[entry.device].color;
                line.push([entry.latitude, entry.longitude]);
                
                let message = 'Date: ' + entry.date + '</br>Time: ' + entry.time + '</br>';
                if(entry.custom_message)
                    message += 'Message: ' + entry.custom_message + '</br>';
                if(entry.altitude > 0)
                    message += 'Altitude: ' + Number(entry.altitude) + 'm</br>';
                if(entry.battery_status == 'LOW')
                    message += 'Battery status is low!' + '</br>';

                var option = {icon: markers[color]};
                let tinyTypes = ['UNLIMITED-TRACK','STOP'];
                if(options.styles[entry.device].tinyTypes)
                    tinyTypes = options.styles[entry.device].tinyTypes;

                if(tinyTypes.includes(entry.type))
                    option.icon = markers.tiny[color];

                var marker = L.marker([entry.latitude, entry.longitude], option).bindPopup(message);
                group.push(marker);
                
            }
            
            if(response.length == index+1){
                console.log(options.styles[entry.device].color)
                group.push(L.polyline(line, {color: options.styles[entry.device].color}));
                overlays[devices[devices.length-1]] = L.layerGroup(group).addTo(spotmap);
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
