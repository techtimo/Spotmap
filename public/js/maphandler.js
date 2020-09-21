// TODO: further investigation
// overides underscore.js needed for some gutenberg stuff
// let _ = lodash

class Spotmap {
    constructor (options) {
        this.options = options;
        this.debug("Spotmap obj created.");
        this.debug(this.options);
    }

    initMap(){

        this.debug("Lodash version: " + lodash.VERSION);
    
        // load maps
        var baseLayers = this.getOption('maps');
        var mapOptions = { 
            fullscreenControl: true,
            scrollWheelZoom: false,
        };
        if(Object.keys(baseLayers)[0].indexOf('swiss') > -1){
            mapOptions.crs = L.CRS.EPSG2056;
        }
        this.map = L.map(this.options.mapId, mapOptions);
        this.map.once('focus', function() { self.map.scrollWheelZoom.enable(); });

        baseLayers[Object.keys(baseLayers)[0]].addTo(this.map);
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
        var markers = { tiny: {} };
        ['blue', 'gold', 'red', 'green', 'orange', 'yellow', 'violet', 'gray', 'black'].forEach(function(color) {
            markers[color] = new Marker({ iconUrl: spotmapjsobj.url + 'leaflet/images/marker-icon-' + color + '.png' });
            markers.tiny[color] = new TinyMarker({ iconUrl: spotmapjsobj.url + 'leaflet/images/marker-tiny-icon-' + color + '.png' });
        });
    
    
    
        // define obj to post data
        let body = {
            'action': 'get_positions',
            'select': "*",
            'date-range': this.options.dateRange,
            'date': this.options.date,
            'orderBy': 'feed_name, time',
            'groupBy': '',
        }
        if (this.options.feeds) {
            body.feeds = this.options.feeds;
        }
        var self = this;
        this.getPoints(function (response) {
            
            var overlays = {},
                lastAdded = {'marker': {},'line':{}};
            if (response.error || response == 0) {
                self.debug("There was an error in the response");
                self.debug(response);
                self.map.setView([51.505, -0.09], 13);
                response = response.error ? response : {};
                response.title = response.title || "No data found!";
                response.message = response.message || "";
                if(!self.options.gpx){
                    var popup = L.popup()
                        .setLatLng([51.5, -0.09])
                        .setContent("<b>" + response.title + "</b><br>" + response.message)
                        .openOn(self.map);
                    self.map.setView([51.505, -0.09], 13);
                }
            } else {
    
                var feeds = [response[0].feed_name],
                    group = [],
                    line = [];
    
    
                // loop thru the data received from backend
                response.forEach(function(entry, index) {
                    let color = this.getOption('color', { 'feed': entry.feed_name });
                    lastAdded.marker[entry.feed_name] = entry.unixtime;
    
                    // feed changed in loop
                    if (feeds[feeds.length - 1] != entry.feed_name) {
                        let lastFeed = feeds[feeds.length - 1];
                        let color = this.getOption('color', { 'feed': lastFeed });
                        lastAdded.line[lastFeed] = L.polyline(line, { color: color });
                        group.push(lastAdded.line[lastFeed]);
                        let html = ' <span class="dot" style="position: relative;height: 10px;width: 10px;background-color: ' + color + ';border-radius: 50%;display: inline-block;"></span>';
                        if(this.options.feeds.length > 1){
                            overlays[lastFeed] = {"group": L.layerGroup(group), "label":lastFeed + html};
                        } else {
                            overlays[lastFeed] = {"group": L.layerGroup(group), "label":lastFeed};
                        }
                        line = [];
                        group = [];
                        feeds.push(entry.feed_name);
                    } 
                    // do we need to split the line?
                    else if (this.getOption('splitLines', { 'feed': entry.feed_name }) && index > 0 && entry.unixtime - response[index - 1].unixtime >= this.options.styles[entry.feed_name].splitLines * 60 * 60) {
                        group.push(L.polyline(line, { color: color }));
                        // start the new line
                        line = [[entry.latitude, entry.longitude]];
                    }
    
                    // a normal iteration adding stuff with default values
                    else {
                        line.push([entry.latitude, entry.longitude]);
                    }
    
                    let message = '';
                    let tinyTypes = this.getOption('tinyTypes',  { 'feed': entry.feed_name });
    
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
    
                    message += 'Time: ' + entry.time + '</br>Date: ' + entry.date + '</br>';
                    if(entry.local_timezone && !(entry.localdate == entry.date && entry.localtime == entry.time ))
                        message += 'Local Time: ' + entry.localtime + '</br>Local Date: ' + entry.localdate + '</br>';
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
                        self.map.panTo([entry.latitude, entry.longitude])
                    });
                    jQuery("#spotmap_" + entry.id).dblclick(function () {
                        marker.togglePopup();
                        self.map.setView([entry.latitude, entry.longitude], 14)
                    });
    
    
                    // for last iteration add the rest that is not caught with a feed change
                    if (response.length == index + 1) {
                        lastAdded.line[entry.feed_name] = L.polyline(line, { 'color': color });
                        group.push(lastAdded.line[entry.feed_name]);
                        let html = '';
                        if (this.options.feeds.length > 1) {
                            html = ' <span class="dot" style="position: relative;height: 10px;width: 10px;background-color: ' + color + ';border-radius: 50%;display: inline-block;"></span>';
                            html += '<div class="leaflet-control-layers-separator"></div>'
                        }
                        overlays[feeds[feeds.length - 1]] = {"group": L.layerGroup(group), "label":feeds[feeds.length - 1] + html};
                    }
                }, self);
            }
            var gpxBounds;
            var gpxOverlays = {};
            if (self.options.gpx) {
                // reversed so the first one is added last == on top of all others
                for (var i=0; i < self.options.gpx.length; i++) {
                    let entry = self.options.gpx[i];
                    let color = self.getOption('color', { gpx: entry });
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
                        if (self.options.mapcenter == 'gpx' || response.error) {
                            let gpxBound = e.target.getBounds();
                            let point = L.latLng(gpxBound._northEast.lat, gpxBound._northEast.lng);
                            let point2 = L.latLng(gpxBound._southWest.lat, gpxBound._southWest.lng);
                            if (!gpxBounds) {
                                gpxBounds = L.latLngBounds([point, point2]);
                            } else {
                                gpxBounds.extend(L.latLngBounds([point, point2]))
                            }
                            self.map.fitBounds(gpxBounds);
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
            lodash.forEachRight(gpxOverlays, function(value,key) { overlays[key] = value });
            var displayOverlays = {};
            for (let key in overlays) {
                displayOverlays[overlays[key].label] = overlays[key].group;
            }
    
            let all = [];
            // loop thru feeds (not gpx) to get the bounds
            for (let feed in displayOverlays) {
                const element = displayOverlays[feed];
                element.addTo(self.map);
                if (displayOverlays.hasOwnProperty(feed)) {
                    const layers = element.getLayers();
                    layers.forEach(function(element) {
                        if (!element._gpx)
                            all.push(element);
                    });
                }
            }
            if (self.options.mapcenter == 'all') {
                var group = new L.featureGroup(all);
                let bounds = group.getBounds();
                self.map.fitBounds(bounds);
            } else if (self.options.mapcenter == 'last') {
                var lastPoint;
                var time = 0;
                if (response.length > 0 && !response.error){
                    response.forEach(function(entry, index) {
                        if (time < entry.unixtime) {
                            time = entry.unixtime;
                            lastPoint = [entry.latitude, entry.longitude];
                        }
                    });
                    self.map.setView([lastPoint[0], lastPoint[1]], 13);
                }
    
            }
            for (let index in self.options.mapOverlays) {
                let overlay = self.options.mapOverlays[index];
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
                displayOverlays[Object.keys(displayOverlays)[0]].addTo(self.map);
                L.control.layers(baseLayers).addTo(self.map);
            } else {
                L.control.layers(baseLayers, displayOverlays).addTo(self.map);
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
    
            if(self.options.autoReload == true){
                var refresh = setInterval(function(){ 
                    body.groupBy = 'feed_name';
                    body.orderBy = 'time DESC';
                    self.getPoints(function (response) {
                        if(response.error){
                            return;
                        }
                        // debug("Checking for new points ...",self.options.debug);
                        response.forEach(function(entry, index) {
                            if(lastAdded.marker[entry.feed_name] < entry.unixtime){
                                lastAdded.marker[entry.feed_name] = entry.unixtime;
                                let color = self.getOption('color', { feed: entry.feed_name });
                                lastAdded.line[entry.feed_name].addLatLng([entry.latitude, entry.longitude]);
    
                                let message = '';
                                let tinyTypes = self.getOption('tinyTypes', { feed: entry.feed_name });
                
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
                                if (entry.hiddenPoints)
                                    message += 'There are ' + entry.hiddenPoints.count + ' hidden Points within a raduis of'+ entry.hiddenPoints.radius+' meters</br>';
    
                                let marker = L.marker([entry.latitude, entry.longitude], markerOptions).bindPopup(message);
                                overlays[entry.feed_name].group.addLayer(marker);
                                if(this.options.mapcenter == 'last'){
                                    self.map.setView([entry.latitude, entry.longitude], 14);
                                }
                            }
                        });
                        
                    },{body: body, filter: self.options.filterPoints});
                }, 30000);
            }
        },{body: body, filter: this.options.filterPoints});
    }

    getOption(option, config) {
        if(!config){
            config = {};
        }
        if (option == 'maps') {
            if (this.options.maps) {
                var baseLayers = {};
                
                if (this.options.maps.includes('swisstopo')) {
                    baseLayers['swissTopo'] = L.tileLayer.swiss();
                    return baseLayers;
                }
                for (let mapName in spotmapjsobj.maps) {
                    if (this.options.maps.includes(mapName)) {
                        let map = spotmapjsobj.maps[mapName];
                        if(map.wms){
                            baseLayers[map.label] = L.tileLayer.wms(map.url, map.options);
                        } else {
                            baseLayers[map.label] = L.tileLayer(map.url, map.options);
                        }
                    }
                }
                return baseLayers;
            }
            console.error("No Map defined");
            return false;
        }
        if (option == 'color' && config.feed) {
            if (this.options.styles[config.feed] && this.options.styles[config.feed].color)
                return this.options.styles[config.feed].color;
            return 'blue';
        }
        if (option == 'color' && config.gpx) {
            if (config.gpx.color)
                return config.gpx.color;
            return 'gold';
        }
        if (option == 'splitLines' && config.feed) {
            if (this.options.styles[config.feed] && this.options.styles[config.feed].splitLines)
                return this.options.styles[config.feed].splitLines;
            return 'false';
        }
        if (option == 'tinyTypes' && config.feed) {
            if (this.options.styles[config.feed] && this.options.styles[config.feed].tinyTypes)
                return this.options.styles[config.feed].tinyTypes;
            return ['UNLIMITED-TRACK', 'STOP', 'EXTREME-TRACK', 'TRACK'];
        }
    }
    debug(message){
        if(this.options.debug)
            console.log(message)
    }

    getPoints(callback,options){
        jQuery.post(spotmapjsobj.ajaxUrl, options.body, function (response){
            // filter out close by points, never filter if group option is set
            if(options.filter && ! options.body.groupBy && !response.error){
                let indexesToBeDeleted = [];
                response = lodash.each(response, function (element, index){
                    // if we spliced the array, loop to the end with undefinded elements
                    if(!element)
                        return
                    // continue so we can check against another value
                    if(index == 0)
                        return;
                    let lastPoint;
                    for (let i = index; i <= response.length; i++) {
                        if(!lodash.includes(indexesToBeDeleted, index)){
                            lastPoint = [response[index-i].latitude,response[index-i].longitude];
                            response[index-i].hiddenPoints = {count: i,radius: options.filter};
                            break;
                        }
                    }
                    let dif = L.latLng(element.latitude, element.longitude).distanceTo(lastPoint);
                    console.log(dif)
                    if(dif < options.filter){
                        indexesToBeDeleted.push(index);
                    }
                });
                lodash.each(indexesToBeDeleted,function(element){
                    response.splice(element,1);
                })
                
            }
            callback(response);
        });
    }
    initTable(id){
        // define obj to post data
        var body = {
            'action': 'get_positions',
            'date-range': this.options.dateRange,
            'type': this.options.type,
            'date': this.options.date,
            'orderBy': this.options.orderBy,
            'limit': this.options.limit,
            'groupBy': this.options.groupBy,
        }
        if (this.options.feeds) {
            body.feeds = this.options.feeds;
        }
        var self = this;
        this.getPoints(function (response) {
            let headerElements = ["Type", "Message", "Time"];
            let hasLocaltime = false;
            if (lodash.find(response, function(o) { return o.local_timezone; })){
                headerElements.push("Local Time");
                hasLocaltime = true;
            }
            var table = jQuery('#' + id);
            let row = '<tr>';
            lodash.each(headerElements,function(element){
                row += '<th>' + element + '</th>'
            })
            row += '<tr>'
            table.append(jQuery(row));
            if(response.error == true){
                self.options.autoReload = false;
                table.append(jQuery("<tr><td></td><td>No data found</td><td></td></tr>"))
                return;
            } else 
                lodash.forEach(response,function(entry){
                    if(!entry.local_timezone){
                        entry.localdate = '';
                        entry.localtime = '';
                    }
                    if(!entry.message)
                        entry.message = '';
                    let row = "<tr class='spotmap "+entry.type+"'><td id='spotmap_"+entry.id+"'>"+entry.type+"</td><td>"+entry.message+"</td><td>"+entry.time+"<br>"+entry.date+"</td>";
                    if (hasLocaltime)
                        row += "<td>"+entry.localtime+"<br>"+entry.localdate+"</td>";
                    row += "</tr>";
                    table.append(jQuery(row))
                });
            if(self.options.autoReload == true){
                var oldResponse = response;
                var refresh = setInterval(function(){ 
                    self.getPoints(function (response) {
                        if( lodash.head(oldResponse).unixtime < lodash.head(response).unixtime){
                            var table = jQuery('#' + id);
                            table.empty();
                            let headerElements = ["Type", "Message", "Time"];
                            let hasLocaltime = false;
                            if (lodash.find(response, function(o) { return o.local_timezone; })){
                                headerElements.push("Local Time");
                                hasLocaltime = true;
                            }
                            let row = '<tr>';
                            lodash.each(headerElements,function(element){
                                row += '<th>' + element + '</th>'
                            })
                            row += '<tr>'
                            table.append(jQuery(row));
                            lodash.forEach(response,function(entry){
                                if(!entry.local_timezone){
                                    entry.localdate = '';
                                    entry.localtime = '';
                                }
                                if(!entry.message)
                                    entry.message = '';
                                let row = "<tr class='spotmap "+entry.type+"'><td id='spotmap_"+entry.id+"'>"+entry.type+"</td><td>"+entry.message+"</td><td>"+entry.time+"<br>"+entry.date+"</td>";
                                if (hasLocaltime)
                                    row += "<td>"+entry.localtime+"<br>"+entry.localdate+"</td>";
                                row += "</tr>";
                                table.append(jQuery(row));
                            });
                        } else {
                            self.debug('same response!');
                        }
                        
                    },{body: body, filter: self.options.filterPoints}); 
                }, 10000);
            }
        },{body: body, filter: this.options.filterPoints});
    }
}
