class Spotmap {
    constructor(options) {
        if (!options.maps) {
            console.error("Missing important options!!");
        }
        this.options = options;
        this.mapcenter = {};
        this.debug("Spotmap obj created.");
        this.debug(this.options);
        this.map = {};
        this.layerControl = L.control.layers({},{},{hideSingleBase: true});
        this.layers = {
            feeds: {},
            gpx: {},
        };
    }

    doesFeedExists(feedName){
        return this.layers.feeds.hasOwnProperty(feedName)
    }
    initMap() {
        jQuery('#' + this.options.mapId).height(this.options.height);
        var self = this;

        let oldOptions = jQuery('#' + this.options.mapId).data('options');
        jQuery('#' + this.options.mapId).data('options', this.options);
        var container = L.DomUtil.get(this.options.mapId);
        if (container != null) {
            if (!lodash.isEqual(this.options, oldOptions)) {
                // https://github.com/Leaflet/Leaflet/issues/3962
                container._leaflet_id = null;
                jQuery('#' + this.options.mapId + " > .leaflet-control-container").empty();
                jQuery('#' + this.options.mapId + " > .leaflet-pane").empty();
            } else {
                return 0;
            }
        }

        var mapOptions = {
            fullscreenControl: true,
            scrollWheelZoom: false,
            attributionControl: false,
        };
        this.map = L.map(this.options.mapId, mapOptions);
        L.control.scale().addTo(this.map);
        // use no prefix in attribution
        L.control.attribution({prefix: ''}).addTo(this.map);
        // enable scrolling with mouse once the map was focused
        this.map.once('focus', function () { self.map.scrollWheelZoom.enable(); });

        self.getOption('maps');
        this.addButtons();
        
        // define obj to post data
        let body = {
            'action': 'get_positions',
            'select': "*",
            'feeds': '',
            'date-range': this.options.dateRange,
            'date': this.options.date,
            'orderBy': 'feed_name, time',
            'groupBy': '',
        }
        if (this.options.feeds) {
            body.feeds = this.options.feeds;
        }
        self.layerControl.addTo(self.map);
        this.getPoints(function (response) {
            // console.log(response);
            // this is the case if explicitly no feeds were provided
            if(!response.empty){
                // loop thru the data received from server
                response.forEach(function (entry, index) {
                    this.addPoint(entry);
                    this.addPointToLine(entry);
                }, self);

            }
            if (self.options.gpx) {

                for (var i = 0; i < self.options.gpx.length; i++) {
                    let entry = self.options.gpx[i];
                    let title = self.options.gpx[i].title;
                    let color = self.getOption('color', { gpx: entry });
                    let gpxOption = {
                        async: true,
                        marker_options: {
                            wptIcons: {
                                '': self.getMarkerIcon({color: color}),
                            },
                            wptIconsType: {
                                '': self.getMarkerIcon({color: color}),
                            },
                            startIconUrl: '', endIconUrl: '',
                            shadowUrl: spotmapjsobj.url + 'leaflet-gpx/pin-shadow.png',
                        },
                        polyline_options: {
                            'color': color,
                        }
                    }

                    let track = new L.GPX(entry.url, gpxOption).on('loaded', function (e) {
                        // if last track
                        if (self.options.mapcenter == 'gpx' || response.empty) {
                            self.setBounds('gpx');
                        }
                    }).on('addline', function (e) {
                        e.line.bindPopup(title);
                    });
                    let html = ' ' + self.getColorDot(color);
                    self.layers.gpx[title] = {
                        featureGroup: L.featureGroup([track])
                    };
                    self.layers.gpx[title].featureGroup.addTo(self.map)
                    self.layerControl.addOverlay(self.layers.gpx[title].featureGroup,title + html);
                    
                }
            }
            // add feeds to layercontrol
            lodash.forEach(self.layers.feeds, function(value, key) {
                self.layers.feeds[key].featureGroup.addTo(self.map);
                
                if (self.layers.feeds.length + self.options.gpx.length == 1){
                    self.layerControl.addOverlay(self.layers.feeds[key].featureGroup,key);
                }
                else {
                    let color = self.getOption('color', { 'feed': key })
                    let label = key + ' ' + self.getColorDot(color)
                    // if last element
                        // label += '<div class="leaflet-control-layers-separator"></div>'
                    self.layerControl.addOverlay(self.layers.feeds[key].featureGroup, label)
                }

            });
            self.setBounds(self.options.mapcenter);
            // TODO merge displayOverlays
            // displayOverlays merge 
            // self.getOptions('overlays');
            
            // if (Object.keys(displayOverlays).length == 1) {
            //     displayOverlays[Object.keys(displayOverlays)[0]].addTo(self.map);
            //     if (Object.keys(baseLayers).length > 1)
            //         L.control.layers(baseLayers,{},{hideSingleBase: true}).addTo(self.map);
            // } else {
                // L.control.layers(baseLayers, displayOverlays,{hideSingleBase: true}).addTo(self.map);
            // }
            // self.map.on('baselayerchange', self.onBaseLayerChange(event));
            
            if (self.options.autoReload == true && !response.empty) {
                var refresh = setInterval(function () {
                    body.groupBy = 'feed_name';
                    body.orderBy = 'time DESC';
                    self.getPoints(function (response) {
                        if (response.error) {
                            return;
                        }
                        response.forEach(function (entry, index) {
                            let feedName = entry.feed_name;
                            let lastPoint = lodash.last(self.layers.feeds[feedName].points)
                            if (lastPoint.unixtime < entry.unixtime) {
                                self.debug("Found a new point for Feed: " + feedName);
                                self.addPoint(entry);
                                self.addPointToLine(entry);

                                if (self.options.mapcenter == 'last') {
                                    self.map.setView([entry.latitude, entry.longitude], 14);
                                }
                            }
                        });

                    }, { body: body, filter: self.options.filterPoints });
                }, 30000);
            }
        }, { body: body, filter: this.options.filterPoints });
    }

    getOption(option, config) {
        if (!config) {
            config = {};
        }
        if (option == 'maps') {
            if (this.options.maps) {
                let firstmap = true;
                for (let mapName in this.options.maps) {
                    mapName = this.options.maps[mapName];
                    let layer;
                    if (lodash.keys(spotmapjsobj.maps).includes(mapName)) {
                        let map = spotmapjsobj.maps[mapName];
                        if (map.wms) {
                            layer = L.tileLayer.wms(map.url, map.options);
                        } else {
                            layer = L.tileLayer(map.url, map.options);
                        }
                        this.layerControl.addBaseLayer(layer, map.label);
                    }
                    // if (this.options.maps.includes('swisstopo')) {
                    //     layer = L.tileLayer.swiss()
                    //     this.layerControl.addBaseLayer(layer, 'swissTopo');
                    //     L.Control.Layers.prototype._checkDisabledLayers = function () { };
                    // }
                    if(firstmap && layer){
                        firstmap = false;
                        layer.addTo(this.map);
                    }

                }
                // if (lodash.startsWith(this.options.maps[0], "swiss") && self.map.options.crs.code == "EPSG:3857") {
                //     self.changeCRS(L.CRS.EPSG2056)
                //     self.map.setZoom(zoom + 7)
                // }
            }
            return;
        }


        if (option == 'overlays') {
            if (this.options.overlays) {
                let overlays = {};
                for (let overlayName in this.options.overlays) {
                    overlayName = this.options.overlays[overlayName];
                    if (lodash.keys(spotmapjsobj.overlays).includes(overlayName)) {
                        let overlay = spotmapjsobj.overlays[overlayName];
                            overlays[overlay.label] = L.tileLayer(overlay.url, overlay.options);
                    }
                }
                return overlays;
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
        if (option == 'lastPoint') {
            if (this.options.lastPoint)
                return this.options.lastPoint;
            return false;
        }
        if (option == 'feeds') {
            if (this.options.feeds || this.options.feeds.length == 0)
                return false;
            return this.options.feeds;
        }

        if (option == 'splitLines' && config.feed) {
            if (this.options.styles[config.feed] && this.options.styles[config.feed].splitLinesEnabled && this.options.styles[config.feed].splitLinesEnabled === false)
                return false;
            if (this.options.styles[config.feed] && this.options.styles[config.feed].splitLines)
                return this.options.styles[config.feed].splitLines;
            return false;
        }
    }
    debug(message) {
        if (this.options && this.options.debug)
            console.log(message)
    }

    getPoints(callback, options) {
        var self = this;
        jQuery.post(spotmapjsobj.ajaxUrl, options.body, function (response) {
            let feeds = true;
            if(self.options.feeds && self.options.feeds.length == 0){
                feeds = false
            }
            if(feeds && (response.error || response == 0)){
                self.debug("There was an error in the response");
                self.debug(response);
                self.map.setView([51.505, -0.09], 13);
                response = response.error ? response : {};
                response.title = response.title || "No data found!";
                response.message = response.message || "";
                if (self.options.gpx.length == 0) {
                    var popup = L.popup()
                        .setLatLng([51.5, 0])
                        .setContent("<b>" + response.title + "</b><br>" + response.message)
                        .openOn(self.map);
                    self.map.setView([51.5, 0], 13);
                }
            }
            else if(feeds && options.filter && !response.empty){
                response = self.removeClosePoints(response, options.filter);
                callback(response);
            } else {
                callback(response);
            }
        });
    }

    removeClosePoints(points, radius){
        points = lodash.eachRight(points, function (element, index) {
            // if we spliced the array, or check the last element, do nothing
            if (!element || index == 0)
                return
            let nextPoint,
                indexesToBeDeleted = [];
            for (let i = index - 1; i > 0; i--) {
                nextPoint = [points[i].latitude, points[i].longitude];
                let dif = L.latLng(element.latitude, element.longitude).distanceTo(nextPoint);
                if (dif <= radius && element.type == points[i].type) {
                    indexesToBeDeleted.push(i);
                    continue;
                }
                if (indexesToBeDeleted.length != 0) {
                    points[index].hiddenPoints = { count: indexesToBeDeleted.length, radius: radius };
                }
                break;
            }
            lodash.each(indexesToBeDeleted, function (index) {
                points[index] = undefined;
            });
        });
        // completely remove the entries from the points
        points = points.filter(function (element) {
            return element !== undefined;
        });
        return points;
    }

    addButtons() {
        // zoom to bounds btn 
        var self = this;
        let zoomOptions = { duration: 2 };
        let last = L.easyButton({
            states: [{
                stateName: 'all',
                icon: 'fa-globe',
                title: 'Show all points',
                onClick: function (control) {
                    self.setBounds('all');
                    control.state('last');
                },
            }, {
                stateName: 'last',
                icon: 'fa-map-pin',
                title: 'Jump to last known location',
                onClick: function (control) {
                    self.setBounds('last');
                    if (!lodash.isEmpty(self.options.gpx))
                        control.state('gpx');
                    else
                        control.state('all');
                },
            }, {
                stateName: 'gpx',
                icon: '<span class="target">Tr.</span>',
                title: 'Show GPX track(s)',
                onClick: function (control) {
                    self.setBounds('gpx');
                    control.state('all');
                },
            }]
        });
        //   the users position
        let position = L.easyButton({states: [{
            icon: 'fa-location-arrow',
            title: 'Jump to your location',
            onClick: function () {
                self.map.locate({ setView: true, maxZoom: 15 });
            },
        }]});
        // add all btns to map
        L.easyBar([last, position]).addTo(this.map);
    }
    
    // onBaseLayerChange(layer) {
    //     // let bounds = this.map.getBounds();
    //     let center = this.map.getCenter();
    //     let zoom = this.map.getZoom();
    //     // console.log(this.map.getZoom());

    //     if (lodash.startsWith(layer.name, "swiss") && this.map.options.crs.code == "EPSG:3857") {
    //         this.changeCRS(L.CRS.EPSG2056)
    //         this.map.setZoom(zoom + 7)
    //     }
    //     else if (!lodash.startsWith(layer.name, "swiss") && this.map.options.crs.code == "EPSG:2056") {
    //         this.changeCRS(L.CRS.EPSG3857)
    //         this.map.setZoom(zoom - 7)
    //     }
    //     // this.map.options.zoomSnap = 0;
    //     this.map._resetView(center, zoom, true);
    //     zoom = this.map.getZoom();
    //     // this.map.options.zoomSnap = 1;
    // }
    
    initTable(id) {
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
            if (lodash.find(response, function (o) { return o.local_timezone; })) {
                headerElements.push("Local Time");
                hasLocaltime = true;
            }
            var table = jQuery('#' + id);
            let row = '<tr>';
            lodash.each(headerElements, function (element) {
                row += '<th>' + element + '</th>'
            })
            row += '<tr>'
            table.append(jQuery(row));
            if (response.error == true) {
                self.options.autoReload = false;
                table.append(jQuery("<tr><td></td><td>No data found</td><td></td></tr>"))
                return;
            } else
                lodash.forEach(response, function (entry) {
                    if (!entry.local_timezone) {
                        entry.localdate = '';
                        entry.localtime = '';
                    }
                    if (!entry.message)
                        entry.message = '';
                    let row = "<tr class='spotmap " + entry.type + "'><td id='spotmap_" + entry.id + "'>" + entry.type + "</td><td>" + entry.message + "</td><td>" + entry.time + "<br>" + entry.date + "</td>";
                    if (hasLocaltime)
                        row += "<td>" + entry.localtime + "<br>" + entry.localdate + "</td>";
                    row += "</tr>";
                    table.append(jQuery(row))
                });
            if (self.options.autoReload == true) {
                var oldResponse = response;
                var refresh = setInterval(function () {
                    self.getPoints(function (response) {
                        if (lodash.head(oldResponse).unixtime < lodash.head(response).unixtime) {
                            var table = jQuery('#' + id);
                            table.empty();
                            let headerElements = ["Type", "Message", "Time"];
                            let hasLocaltime = false;
                            if (lodash.find(response, function (o) { return o.local_timezone; })) {
                                headerElements.push("Local Time");
                                hasLocaltime = true;
                            }
                            let row = '<tr>';
                            lodash.each(headerElements, function (element) {
                                row += '<th>' + element + '</th>'
                            })
                            row += '<tr>'
                            table.append(jQuery(row));
                            lodash.forEach(response, function (entry) {
                                if (!entry.local_timezone) {
                                    entry.localdate = '';
                                    entry.localtime = '';
                                }
                                if (!entry.message)
                                    entry.message = '';
                                let row = "<tr class='spotmap " + entry.type + "'><td id='spotmap_" + entry.id + "'>" + entry.type + "</td><td>" + entry.message + "</td><td>" + entry.time + "<br>" + entry.date + "</td>";
                                if (hasLocaltime)
                                    row += "<td>" + entry.localtime + "<br>" + entry.localdate + "</td>";
                                row += "</tr>";
                                table.append(jQuery(row));
                            });
                        } else {
                            self.debug('same response!');
                        }

                    }, { body: body, filter: self.options.filterPoints });
                }, 10000);
            }
        }, { body: body, filter: this.options.filterPoints });
    }

    getColorDot(color){
        return '<span class="dot" style="position: relative;height: 10px;width: 10px;background-color: ' + color + ';border-radius: 50%;display: inline-block;"></span>'
    }
    getPopupText(entry){
        let message = "<b>" + entry.type + "</b><br>";
        message += 'Time: ' + entry.time + '</br>Date: ' + entry.date + '</br>';
        if (entry.local_timezone && !(entry.localdate == entry.date && entry.localtime == entry.time))
            message += 'Local Time: ' + entry.localtime + '</br>Local Date: ' + entry.localdate + '</br>';
        if (entry.message)
            message += 'Message: ' + entry.message + '</br>';
        if (entry.altitude >= 0)
            message += 'Altitude: ' + Number(entry.altitude) + 'm</br>';
        if (entry.battery_status == 'LOW')
            message += 'Battery status is low!' + '</br>';
        if (entry.hiddenPoints)
            message += 'There are ' + entry.hiddenPoints.count + ' hidden Points within a radius of ' + entry.hiddenPoints.radius + ' meters</br>';
        return message;
    }
    setNewFeedLayer(feedName){
        if(this.doesFeedExists(feedName)){
            return false;
        }
        this.layers.feeds[feedName] = {
            lines: [this.addNewLine(feedName)],
            markers: [],
            points: [],
            featureGroup: L.featureGroup(),
        };
        this.layers.feeds[feedName].featureGroup.addLayer(this.layers.feeds[feedName].lines[0]);
        return true;
    }

    addPoint(point){
        let feedName = point.feed_name;
        let coordinates = [point.latitude, point.longitude];
        if(!this.doesFeedExists(feedName)){
            this.setNewFeedLayer(feedName);
        }
        
        // this.getOption('lastPoint')
        
        let markerOptions= this.getMarkerOptions(point)
        let message = this.getPopupText(point);
        let marker = L.marker(coordinates , markerOptions).bindPopup(message);
        
        this.layers.feeds[feedName].points.push(point);
        this.layers.feeds[feedName].markers.push(marker);
        this.layers.feeds[feedName].featureGroup.addLayer(marker)
        jQuery("#spotmap_" + point.id).click(function () {
            marker.togglePopup();
            self.map.panTo(coordinates)
        });
        jQuery("#spotmap_" + point.id).dblclick(function () {
            marker.togglePopup();
            self.map.setView(coordinates, 14)
        });
    }
    
    getMarkerOptions(point){
        let zIndexOffset = 0;
        if(!lodash.includes(['UNLIMITED-TRACK', 'EXTREME-TRACK', 'TRACK'], point.type)){
            zIndexOffset += 1000;
        } else if(!lodash.includes(['CUSTOM', 'OK'], point.type)){
            zIndexOffset -= 2000;
        } else if(!lodash.includes(['HELP', 'HELP-CANCEL',], point.type)){
            zIndexOffset -= 3000;
        }
        
        let markerOptions = {
            icon: this.getMarkerIcon(point),
            zIndexOffset: zIndexOffset,
        };

        return markerOptions;
    }
    getMarkerIcon(point){
        let color = point.color ? point.color : this.getOption('color', { 'feed': point.feed_name });
        let iconOptions = {
            textColor: color,
            borderColor: color,
        }
        
        if(lodash.includes(['UNLIMITED-TRACK', 'EXTREME-TRACK', 'TRACK'], point.type)){
            iconOptions.iconShape = spotmapjsobj.marker["UNLIMITED-TRACK"].iconShape;
            iconOptions.icon = spotmapjsobj.marker["UNLIMITED-TRACK"].icon;
            iconOptions.iconAnchor= [4,4];
            iconOptions.iconSize= [8,8];
            iconOptions.borderWith = 8;
        }
        // Is the point.type configured?
        if(spotmapjsobj.marker[point.type]){
            iconOptions.iconShape = spotmapjsobj.marker[point.type].iconShape;
            iconOptions.icon = spotmapjsobj.marker[point.type].icon;
            if(iconOptions.iconShape == 'circle-dot'){
                iconOptions.iconAnchor= [4,4];
                iconOptions.iconSize= [8,8];
                iconOptions.borderWith = 8;
            }
        } else {
            iconOptions.iconShape = "marker";
            iconOptions.icon = "circle";
        }
        return L.BeautifyIcon.icon(iconOptions)
    }
    addPointToLine(point){
        let feedName = point.feed_name;
        let coordinates = [point.latitude, point.longitude];
        let splitLines = this.getOption('splitLines', { 'feed': feedName });
        if(!splitLines){
            return false;
        }
        let numberOfPointsAddedToMap = this.layers.feeds[feedName].points.length;
        let lastPoint;
        if(numberOfPointsAddedToMap == 2){
            //  TODO
            lastPoint = this.layers.feeds[feedName].points[ numberOfPointsAddedToMap - 1 ];
            // compare with given point if it's the same exit
        }
        if(numberOfPointsAddedToMap >= 2){
            lastPoint = this.layers.feeds[feedName].points[ numberOfPointsAddedToMap - 2 ];
        }
        let length = this.layers.feeds[feedName].lines.length;
        if(lastPoint && point.unixtime - lastPoint.unixtime >= splitLines * 60 * 60){
            // start new line and add to map
            let line = this.addNewLine(feedName);
            line.addLatLng(coordinates);
            this.layers.feeds[feedName].lines.push(line)
            this.layers.feeds[feedName].featureGroup.addLayer(line);
        } else {
            this.layers.feeds[feedName].lines[length-1].addLatLng(coordinates);
        }
        
        return true;
    }
    /**
     * Creates an empty polyline according to the settings gathered from the feedname
     * @param {string} feedName 
     * @returns {L.polyline} line 
     */
    addNewLine(feedName){
        let color = this.getOption('color', { 'feed': feedName });
        let line = L.polyline([],{ color: color });
        
        line.setText('  \u25BA  ', {
            repeat: true,
            offset: 2, 
            attributes: {
                'fill': 'black',
                'font-size': 7
            }
        });
        return line;
        // this.layers.feeds[feedName].lines.push(line);
    }
    /**
     * 
     * @param {string} option
     */
    setBounds(option){
        this.map.fitBounds(this.getBounds(option));
    }
    /**
     * Calculates the bounds to the given option
     * @param {string} option - all,last,last-trip,gpx
     * @returns {L.latLngBounds}
     */
    getBounds(option){        
        let bounds = L.latLngBounds();
        let coordinates =[];
        var self = this;
        let latestPoint;
        if(option == "last" || option == "last-trip"){
            let unixtime = 0;
            lodash.forEach(self.layers.feeds, function(value, feedName) {
                let point = lodash.last(self.layers.feeds[feedName].points);
                
                if( point.unixtime > unixtime){
                    latestPoint = lodash.last(self.layers.feeds[feedName].points);
                }
            });
            bounds.extend( [latestPoint.latitude, latestPoint.longitude]);
            if(option == "last"){
                return bounds;
            }
            // get bounds for last-trip 
            let line = lodash.last(self.layers.feeds[latestPoint.feed_name].lines);
            return line.getBounds();
        }

        let feedBounds = L.latLngBounds();
        var self = this;
        lodash.forEach(self.layers.feeds, function(value, feedName) {
            let layerBounds = self.layers.feeds[feedName].featureGroup.getBounds();
            feedBounds.extend(layerBounds);
        });
        if(option == "feeds"){
            return feedBounds;
        }
        let gpxBounds = L.latLngBounds();
        lodash.forEach(self.layers.gpx, function(value, key) {
            let layerBounds = self.layers.gpx[key].featureGroup.getBounds();
            gpxBounds.extend(layerBounds);
            
        });
        if(option == "gpx"){
            return gpxBounds;
        }
        if(option == "all"){
            bounds.extend(gpxBounds);
            bounds.extend(feedBounds);
            return bounds;
        }
        
    }
}
