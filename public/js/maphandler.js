function initMap(options = { feeds: [], styles: {}, dateRange: {}, mapcenter: 'all', gpx: {},maps:['OpenStreetMap']}) {
    try {
        var spotmap = L.map('spotmap-container', { fullscreenControl: true, });
    } catch (e) {
        return;
    }
    var Marker = L.Icon.extend({
        options: {
            shadowUrl: spotmapjsobj.url + 'leaflet/images/marker-shadow.png',
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
    // create markers
    markers = { tiny: {} };
    ['blue', 'gold', 'red', 'green', 'orange', 'yellow', 'violet', 'gray', 'black'].forEach(color => {
        markers[color] = new Marker({ iconUrl: spotmapjsobj.url + 'leaflet/images/marker-icon-' + color + '.png' });
        markers.tiny[color] = new TinyMarker({ iconUrl: spotmapjsobj.url + 'leaflet/images/marker-tiny-icon-' + color + '.png' });
    });

    var maps = spotmapjsobj.maps;
    var baseLayers = {};
    for (let mapName in maps) {
        if(options.maps.includes(mapName))
            baseLayers[mapName] = L.tileLayer(maps[mapName].url, maps[mapName].options);
      }

   baseLayers[Object.keys(baseLayers)[0]].addTo(spotmap);
    // define obj to post data
    let data = {
        'action': 'get_positions',
        'date-range-from': options.dateRange.from,
        'date-range-to': options.dateRange.to,
        'date': options.date,
    }
    if (options.feeds) {
        data.feeds = options.feeds;
    }
    jQuery.post(spotmapjsobj.ajaxUrl, data, function (response) {

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
            feeds = [response[0].feed_name],
            group = [],
            line = [];


        // loop thru the data received from backend
        response.forEach((entry, index) => {
            let color = 'blue';
            if (options.styles[entry.feed_name] && options.styles[entry.feed_name].color)
                color = options.styles[entry.feed_name].color;

            // feed changed in loop
            if (feeds[feeds.length - 1] != entry.feed_name) {
                let lastFeed = feeds[feeds.length - 1];
                let color = 'blue';
                if (options.styles[lastFeed] && options.styles[lastFeed].color)
                    color = options.styles[lastFeed].color;
                group.push(L.polyline(line, { color: color }))
                overlays[lastFeed] = L.layerGroup(group);
                line = [];
                group = [];
                feeds.push(entry.feed_name);
            } else if (options.styles[entry.feed_name] && options.styles[entry.feed_name].splitLines && index > 0 && entry.unixtime - response[index - 1].unixtime >= options.styles[entry.feed_name].splitLines * 60 * 60) {
                group.push(L.polyline(line, { color: color }));
                // start the new line
                line = [[entry.latitude, entry.longitude]];
            }

            else {
                // a normal iteration adding stuff with default values
                line.push([entry.latitude, entry.longitude]);
            }

            let message = '';
            let tinyTypes = ['UNLIMITED-TRACK', 'STOP', 'EXTREME-TRACK', 'TRACK'];
            if (options.styles[entry.feed_name] && options.styles[entry.feed_name].tinyTypes)
                tinyTypes = options.styles[entry.feed_name].tinyTypes;

            var option = { icon: markers[color] };
            if (tinyTypes.includes(entry.type)) {
                option.icon = markers.tiny[color];
            } else {
                message += "<b>" + entry.type + "</b><br>";
            }

            message += 'Date: ' + entry.date + '</br>Time: ' + entry.time + '</br>';
            if (entry.custom_message)
                message += 'Message: ' + entry.custom_message + '</br>';
            if (entry.altitude > 0)
                message += 'Altitude: ' + Number(entry.altitude) + 'm</br>';
            if (entry.battery_status == 'LOW')
                message += 'Battery status is low!' + '</br>';


            var marker = L.marker([entry.latitude, entry.longitude], option).bindPopup(message);
            group.push(marker);


            // for last iteration add the rest that is not caught with a feed change
            if (response.length == index + 1) {
                group.push(L.polyline(line, { color: color }));
                overlays[feeds[feeds.length - 1]] = L.layerGroup(group);
            }
        });
        if(options.gpx)
        for (let key in options.gpx) {
            console.log(key, options.gpx[key]);
            let track = new L.GPX(options.gpx[key], {async: true,marker_options:{startIconUrl: '',endIconUrl: '',shadowUrl: '',}}).on('loaded', function(e) {
                console.log(e.target.get_name());
            })
            overlays[key] = L.layerGroup([track]);
        }
        L.control.layers(baseLayers, overlays).addTo(spotmap);



        var bounds = L.bounds([[0, 0], [0, 0]]);
        let all = [];
        // loop thru feeds to get the bounds
        for (const feed in overlays) {
            if (overlays.hasOwnProperty(feed)) {
                const element = overlays[feed];
                element.addTo(spotmap);
                const layers = element.getLayers();
                layers.forEach(element => {
                    all.push(element);
                });
            }
        }
        if (options.mapcenter == 'all') {
            var group = new L.featureGroup(all);
            let bounds = group.getBounds();
            spotmap.fitBounds(bounds);
        } else {
            var lastPoint;
            var time = 0;
            response.forEach((entry, index) => {
                if (time < entry.unixtime) {
                    time = entry.unixtime;
                    lastPoint = [entry.latitude, entry.longitude];
                }
            });
            spotmap.setView([lastPoint[0], lastPoint[1]], 13);

        }

    });
}
