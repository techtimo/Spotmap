function getOption(option, optionObj, config = {}) {
    if (option == 'maps') {
        if (optionObj.maps) {
            var baseLayers = {};
            for (let mapName in spotmapjsobj.maps) {
                if (optionObj.maps.includes(mapName)) {
                    baseLayers[mapName] = L.tileLayer(spotmapjsobj.maps[mapName].url, spotmapjsobj.maps[mapName].options);
                }
            }
            return baseLayers;
        }
        console.error("No Map defined");
        return false;
    }
    if (option == 'color' && config.feed) {
        if (optionObj.styles[config.feed] && optionObj.styles[config.feed].color)
            return optionObj.styles[config.feed].color;
        return 'blue';
    }
    if (option == 'color' && config.gpx) {
        if (config.gpx.color)
            return config.gpx.color;
        return 'gold';
    }
    if (option == 'splitLines' && config.feed) {
        if (optionObj.styles[config.feed] && optionObj.styles[config.feed].splitLines)
            return optionObj.styles[config.feed].splitLines;
        return 'false';
    }
    if (option == 'tinyTypes' && config.feed) {
        if (optionObj.styles[config.feed] && optionObj.styles[config.feed].tinyTypes)
            return optionObj.styles[config.feed].tinyTypes;
        return ['UNLIMITED-TRACK', 'STOP', 'EXTREME-TRACK', 'TRACK'];
    }
    if (option == 'tinyTypes' && config.feed) {
        if (optionObj.styles[config.feed] && optionObj.styles[config.feed].tinyTypes)
            return optionObj.styles[config.feed].tinyTypes;
        return ['UNLIMITED-TRACK', 'STOP', 'EXTREME-TRACK', 'TRACK'];
    }
}

function initMap(options = { feeds: [], styles: {}, dateRange: {}, mapcenter: 'all', gpx: {}, maps: ['OpenStreetMap'] }) {
    console.log(options);
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
    var baseLayers = getOption('maps', options);

    baseLayers[options.maps[0]].addTo(spotmap);
    // define obj to post data
    let body = {
        'action': 'get_positions',
        'date-range-from': options.dateRange.from,
        'date-range-to': options.dateRange.to,
        'date': options.date,
    }
    if (options.feeds) {
        body.feeds = options.feeds;
    }
    jQuery.post(spotmapjsobj.ajaxUrl, body, function (response) {

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
            let color = getOption('color', options, { feed: entry.feed_name });

            // feed changed in loop
            if (feeds[feeds.length - 1] != entry.feed_name) {
                let lastFeed = feeds[feeds.length - 1];
                let color = getOption('color', options, { feed: lastFeed });
                group.push(L.polyline(line, { color: color }))
                overlays[lastFeed] = L.layerGroup(group);
                line = [];
                group = [];
                feeds.push(entry.feed_name);
            } else if (getOption('splitLines', options, { feed: entry.feed_name }) && index > 0 && entry.unixtime - response[index - 1].unixtime >= options.styles[entry.feed_name].splitLines * 60 * 60) {
                group.push(L.polyline(line, { color: color }));
                // start the new line
                line = [[entry.latitude, entry.longitude]];
            }

            else {
                // a normal iteration adding stuff with default values
                line.push([entry.latitude, entry.longitude]);
            }

            let message = '';
            let tinyTypes = getOption('tinyTypes', options, { feed: entry.feed_name });

            var markerOptions = { icon: markers[color] };
            if (tinyTypes.includes(entry.type)) {
                markerOptions.icon = markers.tiny[color];
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


            var marker = L.marker([entry.latitude, entry.longitude], markerOptions).bindPopup(message);
            group.push(marker);


            // for last iteration add the rest that is not caught with a feed change
            if (response.length == index + 1) {
                group.push(L.polyline(line, { color: color }));
                overlays[feeds[feeds.length - 1]] = L.layerGroup(group);
            }
        });
        if (options.gpx)
            for (const entry of options.gpx) {
                console.log(entry);
                let gpxOption = {
                    async: true,
                    marker_options: {
                        startIconUrl: '',
                        endIconUrl: '',
                        shadowUrl: '',
                    },
                    polyline_options: {
                        color: getOption('color', options, { gpx: entry })
                    }
                }
                console.log('gpxoption', getOption('color', options, { gpx: entry }))
                let track = new L.GPX(entry.url, gpxOption).on('loaded', function (e) {
                    console.log(e.target.get_name());
                })
                if(overlays[entry.name]){
                    // shit happens...
                    // TODO merge into one layergroup

                } else {
                    overlays[entry.name] = L.layerGroup([track]);
                }
            }

        if (Object.keys(overlays).length == 1) {
            overlays[Object.keys(overlays)[0]].addTo(spotmap);
            L.control.layers(baseLayers).addTo(spotmap);
        } else {
            L.control.layers(baseLayers, overlays).addTo(spotmap);
        }


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
        console.log(spotmap)
        return spotmap;
    });
}
