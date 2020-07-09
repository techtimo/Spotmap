function getOption(option, optionObj, config) {
    if(!config){
        config = {};
    }
    if (option == 'maps') {
        if (optionObj.maps) {
            var baseLayers = {};
            
            if (optionObj.maps.includes('swisstopo')) {
                baseLayers['swissTopo'] = L.tileLayer.swiss();
                return baseLayers;
            }
            for (let mapName in spotmapjsobj.maps) {
                if (optionObj.maps.includes(mapName)) {
                    let map = spotmapjsobj.maps[mapName];
                    baseLayers[map.label] = L.tileLayer(map.url, map.options);
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

function debug(message,debug){
    if(debug == true){
        console.log(message)
    }
}

function initMap(options) {
    if(!options){
        // if called via blocks with no input
        options = { feeds: [], styles: {}, dateRange: {}, mapcenter: 'all', gpx: {}, maps: ['OpenStreetMap'], mapId: "spotmap-container" }
    }
    debug("Configuration for map setup:",options.debug);
    debug(options,options.debug);

    // load maps
    var baseLayers = getOption('maps', options);

    var spotmap = null;
    var mapOptions = { 
        fullscreenControl: true,
        scrollWheelZoom: false,
    };
    if(Object.keys(baseLayers)[0].indexOf('swiss') > -1){
        mapOptions.crs = L.CRS.EPSG2056;
    }
    try {
        spotmap = L.map(options.mapId, mapOptions);
    } catch (e) {
        return;
    }
    baseLayers[Object.keys(baseLayers)[0]].addTo(spotmap);
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
    ['blue', 'gold', 'red', 'green', 'orange', 'yellow', 'violet', 'gray', 'black'].forEach(function(color) {
        markers[color] = new Marker({ iconUrl: spotmapjsobj.url + 'leaflet/images/marker-icon-' + color + '.png' });
        markers.tiny[color] = new TinyMarker({ iconUrl: spotmapjsobj.url + 'leaflet/images/marker-tiny-icon-' + color + '.png' });
    });



    // define obj to post data
    let body = {
        'action': 'get_positions',
        'date-range': {
            'from': options.dateRange.from,
            'to': options.dateRange.to,
        },
        'date': options.date,
        'orderBy': 'feed_name, time'
    }
    if (options.feeds) {
        body.feeds = options.feeds;
    }
    jQuery.post(spotmapjsobj.ajaxUrl, body, function (response) {
        var overlays = {},
            lastAdded = {'marker': {},'line':{}};
        if (response.error) {
            debug("There was an error in the response", options.debug);
            debug(response, options.debug);
            spotmap.setView([51.505, -0.09], 13);
            response.title = response.title || "No data found!";
            response.message = response.message || "";
            if(!options.gpx){
                var popup = L.popup()
                    .setLatLng([51.5, -0.09])
                    .setContent("<b>" + response.title + "</b><br>" + response.message)
                    .openOn(spotmap);
                spotmap.setView([51.505, -0.09], 13);
            }
        } else {


            var feeds = [response[0].feed_name],
                group = [],
                line = [];


            // loop thru the data received from backend
            response.forEach(function(entry, index) {
                let color = getOption('color', options, { 'feed': entry.feed_name });
                lastAdded.marker[entry.feed_name] = entry.unixtime;

                // feed changed in loop
                if (feeds[feeds.length - 1] != entry.feed_name) {
                    let lastFeed = feeds[feeds.length - 1];
                    let color = getOption('color', options, { 'feed': lastFeed });
                    lastAdded.line[lastFeed] = L.polyline(line, { color: color });
                    group.push(lastAdded.line[lastFeed]);
                    let html = ' <span class="dot" style="position: relative;height: 10px;width: 10px;background-color: ' + color + ';border-radius: 50%;display: inline-block;"></span>';
                    if(options.feeds.length > 1){
                        overlays[lastFeed] = {"group": L.layerGroup(group), "label":lastFeed + html};
                    } else {
                        overlays[lastFeed] = {"group": L.layerGroup(group), "label":lastFeed};
                    }
                    line = [];
                    group = [];
                    feeds.push(entry.feed_name);
                } 
                // do we need to split the line?
                else if (getOption('splitLines', options, { 'feed': entry.feed_name }) && index > 0 && entry.unixtime - response[index - 1].unixtime >= options.styles[entry.feed_name].splitLines * 60 * 60) {
                    group.push(L.polyline(line, { color: color }));
                    // start the new line
                    line = [[entry.latitude, entry.longitude]];
                }

                // a normal iteration adding stuff with default values
                else {
                    line.push([entry.latitude, entry.longitude]);
                }

                let message = '';
                let tinyTypes = getOption('tinyTypes', options, { 'feed': entry.feed_name });

                var markerOptions = { icon: markers[color] };
                if (tinyTypes.includes(entry.type)) {
                    markerOptions.icon = markers.tiny[color];
                } else {
                    message += "<b>" + entry.type + "</b><br>";
                }
                if (entry.type == "HELP")
                    markerOptions = { icon: markers['red'] };
                else if (entry.type == "HELP-CANCEL")
                    markerOptions = { icon: markers['green'] };

                message += 'Date: ' + entry.date + '</br>Time: ' + entry.time + '</br>';
                if (entry.message)
                    message += 'Message: ' + entry.message + '</br>';
                if (entry.altitude > 0)
                    message += 'Altitude: ' + Number(entry.altitude) + 'm</br>';
                if (entry.battery_status == 'LOW')
                    message += 'Battery status is low!' + '</br>';


                var marker = L.marker([entry.latitude, entry.longitude], markerOptions).bindPopup(message);
                group.push(marker);
                jQuery("#spotmap_" + entry.id).click(function () {
                    marker.togglePopup();
                    spotmap.panTo([entry.latitude, entry.longitude])
                });
                jQuery("#spotmap_" + entry.id).dblclick(function () {
                    marker.togglePopup();
                    spotmap.setView([entry.latitude, entry.longitude], 14)
                });


                // for last iteration add the rest that is not caught with a feed change
                if (response.length == index + 1) {
                    lastAdded.line[entry.feed_name] = L.polyline(line, { 'color': color });
                    group.push(lastAdded.line[entry.feed_name]);
                    let html = '';
                    if (options.feeds.length > 1) {
                        html = ' <span class="dot" style="position: relative;height: 10px;width: 10px;background-color: ' + color + ';border-radius: 50%;display: inline-block;"></span>';
                        html += '<div class="leaflet-control-layers-separator"></div>'
                    }
                    overlays[feeds[feeds.length - 1]] = {"group": L.layerGroup(group), "label":feeds[feeds.length - 1] + html};
                }
            });
        }
        var gpxBounds;
        var gpxOverlays = {};
        if (options.gpx) {
            // reversed so the first one is added last == on top of all others
            for (var i=options.gpx.length-1; i >= 0; i--) {
                let entry = options.gpx[i];
                let color = getOption('color', options, { gpx: entry });
                let gpxOption = {
                    async: true,
                    marker_options: {
                        wptIcons: {
                            '': markers[color],
                        },
                        wptIconsType: {
                            '': markers[color],
                        },
                        startIconUrl: '',
                        endIconUrl: '',
                        shadowUrl: spotmapjsobj.url + 'leaflet-gpx/pin-shadow.png',
                    },
                    polyline_options: {
                        'color': color
                    }
                }

                let track = new L.GPX(entry.url, gpxOption).on('loaded', function (e) {
                    // e.target.getLayers()[0].bindPopup(entry.name);
                    // console.log(e)
                    if (options.mapcenter == 'gpx' || response.error) {
                        let gpxBound = e.target.getBounds();
                        let point = L.latLng(gpxBound._northEast.lat, gpxBound._northEast.lng);
                        let point2 = L.latLng(gpxBound._southWest.lat, gpxBound._southWest.lng);
                        if (!gpxBounds) {
                            gpxBounds = L.latLngBounds([point, point2]);
                        } else {
                            gpxBounds.extend(L.latLngBounds([point, point2]))
                        }
                        spotmap.fitBounds(gpxBounds);
                    }
                }).on('addline', function(e) {
                    e.line.bindPopup(entry.name);
                });
                let html = ' <span class="dot" style="position: relative;height: 10px;width: 10px;background-color: ' + color + ';border-radius: 50%;display: inline-block;"></span>';
                if (gpxOverlays[entry.name]) {
                    gpxOverlays[entry.name].group.addLayer(track);
                } else {
                    gpxOverlays[entry.name] = {group: L.layerGroup([track]), 'label': entry.name + html};
                }

            }
        }
        // reverse order in menu to have the first element added last but shown on the menu first again
        gpxProps = Object.keys(gpxOverlays).reverse();
        gpxProps.forEach(function(key) { overlays[key] = gpxOverlays[key] })
        // overlays = overlays.reverse();
        displayOverlays = {};
        for (let key in overlays) {
            displayOverlays[overlays[key].label] = overlays[key].group;
        }

        let all = [];
        // loop thru feeds (not gpx) to get the bounds
        for (let feed in displayOverlays) {
            if (displayOverlays.hasOwnProperty(feed)) {
                const element = displayOverlays[feed];
                element.addTo(spotmap);
                const layers = element.getLayers();
                layers.forEach(function(element) {
                    if (!element._gpx)
                        all.push(element);
                });
            }
        }
        if (options.mapcenter == 'all') {
            var group = new L.featureGroup(all);
            let bounds = group.getBounds();
            spotmap.fitBounds(bounds);
        } else if (options.mapcenter == 'last') {
            var lastPoint;
            var time = 0;
            if (response.length){
                response.forEach(function(entry, index) {
                    if (time < entry.unixtime) {
                        time = entry.unixtime;
                        lastPoint = [entry.latitude, entry.longitude];
                    }
                });
            }
            spotmap.setView([lastPoint[0], lastPoint[1]], 13);

        }
        for (let index in options.mapOverlays) {
            let overlay = options.mapOverlays[index];
            if(overlay == 'openseamap'){
                displayOverlays.OpenSeaMap = L.tileLayer('http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenSeaMap</a> contributors',
                });
            }
        }

        if(Object.keys(baseLayers).length == 1){
            baseLayers = {};
        }
        if (Object.keys(displayOverlays).length == 1) {
            displayOverlays[Object.keys(displayOverlays)[0]].addTo(spotmap);
            L.control.layers(baseLayers).addTo(spotmap);
        } else {
            L.control.layers(baseLayers, displayOverlays).addTo(spotmap);
        }
        
        // spotmap.on('baselayerchange', function(layer) {
        //     let center = spotmap.getCenter();
        //     let zoom = spotmap.getZoom();
        //     console.log(spotmap.options.crs);

        //     if (layer.name.indexOf('swiss') > -1 && spotmap.options.crs.code == "EPSG:2056"){
        //         spotmap.options.crs = L.CRS.EPSG2056;
        //         spotmap.options.tms = true;
        //     } 
        //     else if (layer.name.indexOf('swiss') > -1 && spotmap.options.crs.code == "EPSG:3857"){
        //         spotmap.options.crs = L.CRS.EPSG2056;
        //         spotmap.options.tms = true;
        //         zoom += 7;
        //     } 
        //     else if (layer.name.indexOf('swiss') == -1 && spotmap.options.crs.code == "EPSG:2056") {
        //         spotmap.options.crs = L.CRS.EPSG3857; "EPSG:3857"
        //         spotmap.options.tms = false;
        //         zoom -=
        //     }
        //     spotmap.setView(center);
        //     spotmap._resetView(center, zoom, true);
        //  })
    
        spotmap.once('focus', function() { spotmap.scrollWheelZoom.enable(); });

        var refresh = setInterval(function(){ 
            body.groupBy = 'feed_name';
            body.orderBy = 'time DESC';
            jQuery.post(spotmapjsobj.ajaxUrl, body, function (response) {
                debug("Checking for new points ...",options.debug);
                response.forEach(function(entry, index) {
                    if(lastAdded.marker[entry.feed_name] < entry.unixtime){
                        lastAdded.marker[entry.feed_name] = entry.unixtime;
                        let color = getOption('color', options, { feed: entry.feed_name });
                        lastAdded.line[entry.feed_name].addLatLng([entry.latitude, entry.longitude]);

                        let message = '';
                        let tinyTypes = getOption('tinyTypes', options, { feed: entry.feed_name });
        
                        var markerOptions = { icon: markers[color] };
                        if (tinyTypes.includes(entry.type)) {
                            markerOptions.icon = markers.tiny[color];
                        } else {
                            message += "<b>" + entry.type + "</b><br>";
                        }
                        if (entry.type == "HELP")
                            markerOptions = { icon: markers['red'] };
                        else if (entry.type == "HELP-CANCEL")
                            markerOptions = { icon: markers['green'] };
        
                        message += 'Date: ' + entry.date + '</br>Time: ' + entry.time + '</br>';
                        if (entry.message)
                            message += 'Message: ' + entry.message + '</br>';
                        if (entry.altitude > 0)
                            message += 'Altitude: ' + Number(entry.altitude) + 'm</br>';
                        if (entry.battery_status == 'LOW')
                            message += 'Battery status is low!' + '</br>';

                        let marker = L.marker([entry.latitude, entry.longitude], markerOptions).bindPopup(message);
                        overlays[entry.feed_name].group.addLayer(marker);
                        if(options.mapcenter == 'last'){
                            spotmap.setView([entry.latitude, entry.longitude], 14);
                        }
                    }
                });
                
            });
        }, 30000);
    });
}
