// block.js
(function (blocks, element, i18n, blockEditor, components, compose) {
    var el = element.createElement;
    const { __ } = i18n;
    const { InspectorControls, MediaUpload } = blockEditor;
    const { FormTokenField } = components;
    const { SelectControl, TextControl, Button, ToggleControl, ColorPalette, PanelBody, PanelRow, DateTimePicker, RadioGroup, UnitControl, } = components;

    blocks.registerBlockType('spotmap/spotmap', {
        title: 'Spotmap',
        supports: {
            align: ['full', 'wide']
        },
        icon: 'location-alt',
        category: 'embed',
        edit: function (props) {
            // if block has just been created
            if (!props.attributes.height) {
                let mapId = 'spotmap-container-' + Math.random() * 10E17;
                let defaultProps = {
                    mapId: mapId,
                    maps: ['opentopomap', 'openstreetmap',],
                    feeds: spotmapjsobj.feeds,
                    styles: lodash.zipObject(spotmapjsobj.feeds, lodash.fill(new Array(spotmapjsobj.feeds.length), { color: 'blue', splitLines: '0' })),
                    autoReload: false,
                    debug: false,
                    lastPoint: false,
                    filterPoints: '10',
                    height: '500',
                    dateRange: { to: '', from: '', },
                    mapcenter: 'all',
                    gpx: [],
                };
                props.setAttributes(defaultProps);
                return [el('div', {
                    id: mapId,
                    style: {
                        class: 'align' + props.attributes.align,
                        'z-index': 0,
                    },
                }, ''
                ),]
            }
            var spotmap = new Spotmap(props.attributes);
            try {
                setTimeout(function () {
                    spotmap.initMap();
                }, 500);
            } catch (e) {
                console.log(e)
            }
            return [el('div', {
                id: props.attributes.mapId,
                style: {
                    'height': props.attributes.height + 'px',
                    class: 'align' + props.attributes.align,
                    'z-index': 0,
                },
            }, ''
            ),
            el(InspectorControls, {},
                generalSettings(props),
                feedPanel(props),
                gpxPanel(props),
                el(PanelBody, { title: 'Experimental Settings', initialOpen: false },
                    // /* Toggle Field TODO: use form toggle instead
                    el(PanelRow, {},
                        el(ToggleControl,
                            {
                                label: 'Show Last Point',
                                onChange: (value) => {
                                    props.setAttributes({ lastPoint: value });
                                },
                                checked: props.attributes.lastPoint,
                                help: "Show the latest point as a big marker.",
                            }
                        )
                    ),
                    el(TextControl,
                        {
                            label: 'Hide nearby points',
                            onChange: (value) => {
                                props.setAttributes({ filterPoints: value });
                            },
                            value: props.attributes.filterPoints,
                            help: "Try to reduce point cluster by only showing the latest point per type. Input a radius in meter."
                        }
                    ),
                    el(PanelRow, {},
                        el(ToggleControl,
                            {
                                label: 'automatic reload',
                                onChange: (value) => {
                                    props.setAttributes({ 'autoReload': value });
                                },
                                checked: props.attributes["autoReload"],
                                help: "If enabled this will update the map without reloading the whole webpage. Not tested very much. Will have unexpected results with 'Last Point'"
                            }
                        )
                    ),
                    el(PanelRow, {},
                        el(ToggleControl,
                            {
                                label: 'Debug',
                                onChange: (value) => {
                                    props.setAttributes({ debug: value });
                                },
                                checked: props.attributes.debug,
                            }
                        )
                    ),
                ),
            )]
        },
        attributes: {
            maps: {
                type: 'array',
            },
            feeds: {
                type: 'array',
            },
            styles: {
                type: 'object',
            },
            dateRange: {
                type: 'object',
            },
            gpx: {
                type: 'array',
            },
            mapcenter: {
                type: 'string',
            },
            height: {
                type: 'string',
            },
            filterPoints: {
                type: 'string',
            },
            debug: {
                type: 'boolean',
            },
            lastPoint: {
                type: 'string',
            },
            autoReload: {
                type: 'boolean',
            },
            mapId: {
                type: 'string',
            },
        },
        keywords: ['findmespot', 'spot', 'gps', 'spotmap', 'gpx', __('map')],
    });

    function generalSettings(props) {
        let panels = [];
        let general = el(PanelBody, { title: __('General Settings'), initialOpen: false },
            el(PanelRow, {},
                el(FormTokenField, {
                    label: "Feeds",
                    suggestions: Object.keys(spotmapjsobj.feeds),
                    onChange: (value) => {
                        props.setAttributes({ feeds: value });
                    },
                    value: props.attributes.feeds,
                })
            ),

            el(PanelRow, {},
                el(FormTokenField, {
                    label: "maps",
                    suggestions: Object.keys(spotmapjsobj.maps),
                    onChange: (value) => {
                        props.setAttributes({ maps: value });
                    },
                    value: props.attributes.maps,
                    help: "test"
                })
            ),

            /* Text Field */
            el(PanelRow, {},
                el(SelectControl,
                    {
                        label: 'Zoom to',
                        onChange: (value) => {
                            props.setAttributes({ mapcenter: value });
                        },
                        value: props.attributes.mapcenter,
                        options: [
                            { label: 'all points', value: 'all' },
                            { label: 'last trip', value: 'last-trip' },
                            { label: 'latest point', value: 'last' },
                            { label: 'GPX tracks', value: 'gpx' }
                        ],
                        labelPosition: "side",

                    }
                )
            ),

            /* Text Field */
            el(PanelRow, {},
                el(TextControl,
                    {
                        label: 'height',
                        onChange: (value) => {
                            props.setAttributes({ height: value });
                        },
                        value: props.attributes.height
                    }
                )
            ),
        );
        panels.push(general);
        let options = [
            { label: 'don\'t filter', value: '' },
            { label: 'last week', value: 'last-1-week' },
            { label: 'last 10 days', value: 'last-10-days' },
            { label: 'last 2 weeks', value: 'last-2-weeks' },
            { label: 'last month', value: 'last-1-month' },
            { label: 'last year', value: 'last-1-year' },
            { label: 'a specific date', value: 'specific' },
        ];
        // if option is set to sth else (aka custom date)
        if (!lodash.findKey(options, function (o) { return o.value === props.attributes.dateRange.from })) {
            options[lodash.last(options)] = { label: 'choose new date', value: 'specific' };
            options.push({ label: props.attributes.dateRange.from, value: props.attributes.dateRange.from })
        }
        let dateFrom = [
            el(PanelRow, {},
                el(SelectControl,
                    {
                        label: 'Show points from',
                        onChange: (value) => {
                            let returnArray = lodash.cloneDeep(props.attributes.dateRange);
                            returnArray.from = value;
                            props.setAttributes({ dateRange: returnArray });
                        },
                        value: props.attributes.dateRange.from,
                        options: options,
                        labelPosition: "side",
                    }
                )
            ),];

        if (props.attributes.dateRange.from === 'specific' || !lodash.findKey(options, function (o) { return o.value === props.attributes.dateRange.from })) {
            dateFrom.push(
                el(DateTimePicker,
                    {
                        onChange: (currentDate) => {
                            console.log(currentDate);
                            let returnArray = lodash.cloneDeep(props.attributes.dateRange);
                            returnArray.from = currentDate;
                            props.setAttributes({ dateRange: returnArray });
                        },
                        currentDate: new Date(),
                    }
                )
            )
        }

        options = [
            { label: 'don\'t filter', value: '' },
            { label: 'last 30 minutes', value: 'last-30-minutes' },
            { label: 'last hour', value: 'last-1-hour' },
            { label: 'last 2 hours', value: 'last-2-hour' },
            { label: 'last day', value: 'last-1-day' },
            { label: 'a specific date', value: 'specific' },
        ];
        if (!lodash.findKey(options, function (o) { return o.value === props.attributes.dateRange.to })) {
            options.push({ label: props.attributes.dateRange.to, value: props.attributes.dateRange.to })
        }
        let dateTo = [
            el(PanelRow, {},
                el(SelectControl,
                    {
                        label: 'Show points to',
                        onChange: (value) => {
                            let returnArray = lodash.cloneDeep(props.attributes.dateRange);
                            returnArray.to = value;
                            props.setAttributes({ dateRange: returnArray });
                        },
                        value: props.attributes.dateRange.to,
                        options: options,
                        labelPosition: "side",
                    }
                )
            ),];

        if (props.attributes.dateRange.to === 'specific') {
            dateTo.push(
                el(DateTimePicker,
                    {
                        onChange: (currentDate) => {
                            console.log(currentDate);
                            let returnArray = lodash.cloneDeep(props.attributes.dateRange);
                            returnArray.to = currentDate;
                            props.setAttributes({ dateRange: returnArray });
                        },
                        currentDate: new Date(),
                    }
                )
            )
        }
        panels.push(el(PanelBody, { title: 'Time filter of points', initialOpen: false }, dateFrom, dateTo));
        return panels;
    }

    function feedPanel(props) {
        let panel;
        let panels = [];
        if (!props.attributes.feeds) {
            return [];
        }
        // console.log(props)
        for (let i = 0; i < props.attributes.feeds.length; i++) {
            const feed = props.attributes.feeds[i];
            // console.log(feed);
            let options = [];
            if (!props.attributes.styles[feed]) {
                let returnArray = lodash.cloneDeep(props.attributes.styles);
                returnArray[feed] = { color: 'blue', splitLines: 12 };
                props.setAttributes({ styles: returnArray });
            }
            options.push(el(PanelRow, {},
                el(ColorPalette, {
                    label: "Colors",
                    colors: [
                        { name: "black", color: "black" },
                        { name: "blue", color: "blue" },
                        { name: "gold", color: "gold" },
                        { name: "green", color: "green" },
                        { name: "grey", color: "grey" },
                        { name: "red", color: "red" },
                        { name: "violet", color: "violet" },
                        { name: "yellow", color: "yellow" },
                    ],
                    onChange: (value) => {
                        let returnArray = lodash.cloneDeep(props.attributes.styles);
                        console.log(value, returnArray)
                        returnArray[feed]['color'] = value;
                        props.setAttributes({ styles: returnArray });
                    },
                    value: props.attributes.styles[feed]['color'] || 'blue',
                    disableCustomColors: true,
                })
            ),

                // /* Toggle Field TODO: use form toggle instead
                el(PanelRow, {},
                    el(ToggleControl,
                        {
                            label: 'connect points wih line',
                            onChange: (value) => {
                                let returnArray = lodash.cloneDeep(props.attributes.styles);
                                console.log(value, returnArray)
                                returnArray[feed]['splitLinesEnabled'] = value;

                                if (value && !returnArray[feed]['splitLines']) {
                                    returnArray[feed]['splitLines'] = 12;
                                }
                                props.setAttributes({ styles: returnArray });
                            },
                            checked: props.attributes.styles[feed]['splitLinesEnabled'],
                        }
                    )
                ));

            if (props.attributes.styles[feed]['splitLinesEnabled'] === true) {
                options.push(
                    el(PanelRow, {},
                        el(TextControl,
                            {
                                label: 'Splitlines',
                                onChange: (value) => {
                                    let returnArray = lodash.cloneDeep(props.attributes.styles);
                                    console.log(value, returnArray)
                                    returnArray[feed]['splitLines'] = value;
                                    props.setAttributes({ styles: returnArray });
                                },
                                value: props.attributes.styles[feed]['splitLines'],
                            }
                        )
                    ))
            }
            panel = el(PanelBody, { title: feed + ' Feed', initialOpen: false }, options);


            panels.push(panel);

        }
        return panels;
    }
    function gpxPanel(props) {
        let panels = [];
        if (!props.attributes.feeds) {
            return [];
        }

        // console.log(feed);
        let options = [];

        options.push(
            el(PanelRow, {},
                el(MediaUpload, {
                    allowedTypes: ['text/xml'],
                    multiple: true,
                    value: props.attributes.gpx.map(entry => entry.id),
                    title: "Choose gpx tracks (Hint: press ctrl to select multiple)",
                    onSelect: function (gpx) {
                        let returnArray = [];
                        lodash.forEach(gpx, (track) => {
                            track = lodash.pick(track, ['id', 'url', 'title']);
                            returnArray.push(track);
                        })
                        props.setAttributes({ gpx: returnArray });
                    },
                    render: function (callback) {
                        return el(Button,
                            {
                                onClick: callback.open,
                                isPrimary: true,
                            },
                            "Select from Media Library"
                        )
                    }
                })
            ),
            el(PanelRow, {},
                el("em", {}, "Select a color:"),
                el(PanelRow, {},
                    el(ColorPalette, {
                        label: "Colors",
                        colors: [
                            { name: "blue", color: "blue" },
                            { name: "gold", color: "gold" },
                            { name: "green", color: "green" },
                            { name: "red", color: "red" },
                            { name: "black", color: "black" },
                            { name: "violet", color: "violet" },
                        ],
                        onChange: (value) => {
                            let returnArray = [];
                            let gpx = lodash.cloneDeep(props.attributes.gpx);
                            lodash.forEach(gpx, (track) => {
                                track.color = value;
                                returnArray.push(track);
                            })
                            props.setAttributes({ gpx: returnArray });
                        },
                        value: props.attributes.gpx[0] ? props.attributes.gpx[0].color : 'gold',
                        disableCustomColors: false,
                        clearable: false,
                    })
                ))
        );


        panels.push(el(PanelBody, { title: 'GPX', initialOpen: false }, options));

        return panels;
    }

})(
    window.wp.blocks,
    window.wp.element,
    window.wp.i18n,
    window.wp.blockEditor,
    window.wp.components,
    window.wp.compose,
);


