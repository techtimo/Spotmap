// block.js
(function (blocks, element, i18n, editor, components, compose) {
    var el = element.createElement;
    const { __ } = i18n;
    const { RichText, InspectorControls } = editor;
    const { FormTokenField } = components;
    const { SelectControl, TextControl, ToggleControl, Panel, PanelBody, PanelRow, } = components;

    blocks.registerBlockType('spotmap/spotmap', {
        title: __('Spotmap'),
        supports: {
            align: true
        },
        icon: 'location-alt',
        category: 'embed',
        edit: function (props) {
            let feeds = props.attributes.feeds || spotmapjsobj.feeds;
            if(!props.attributes.feeds){
                props.setAttributes({ feeds: spotmapjsobj.feeds });
            }
            let styles = {};
            for (let i = 0; i < feeds.length; i++) {
                const element = feeds[i];
                let color;
                if(props.attributes.color && props.attributes.color[i]){
                    color = props.attributes.color[i]
                }
                let splitLines;
                if(props.attributes.splitLines && props.attributes.splitLines[i]){
                    splitLines = props.attributes.splitLines[i]
                }
                styles[element] = {
                    color: color || 'blue',
                    splitLines: splitLines || 10,
                    tinyTypes: null,
                }
            }
            // let gpx = [];
            // for (let i = 0; i < props.attributes["gpx-url"].length; i++) {
            //     const element = props.attributes["gpx-url"][i];
            //     gpx.push({
            //         name: props.attributes["gpx-name"][i],
            //         url: props.attributes["gpx-url"][i],
            //         color: props.attributes["gpx-color"][i],
            //     });
            // }
            var spotmap = new Spotmap({
                mapId: 'spotmap-container',
                feeds: props.attributes.feeds || spotmapjsobj.feeds,
                styles: styles,
                gpx: [],
                filterPoints: 5,
                mapcenter: props.attributes.mapcenter || 'all',
                maps: props.attributes.maps || 'opentopomap',
                
            });
            // jQuery("#spotmap-container").empty().removeClass();
            try {
                spotmap.initMap();
            } catch (e) {console.log(e) }
            return [el('div', {
                id: 'spotmap-container',
                style: {
                    'height': props.attributes.height + 'px'
                },
                "z-index": 0,
            },'Click here'
            ),
            el(InspectorControls, {},
                el(PanelBody, { title: 'General Settings', initialOpen: true },
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

                ),
                el(PanelBody, { title: 'Feed Settings', initialOpen: true },
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
                            label: "Colors",
                            suggestions: ["black", "blue", "gold", "green", "grey", "onratechange", "ReadableStream", "violet", "yellow"],
                            onChange: (value) => {
                                props.setAttributes({ colors: value });
                            },
                            value: props.attributes.colors,
                        })
                    ),

                    /* Text Field */
                    el(PanelRow, {},
                        el(FormTokenField,
                            {
                                label: 'Splitlines',
                                onChange: (value) => {
                                    props.setAttributes({ splitLines: value });
                                },
                                value: props.attributes.splitLines
                            }
                        )
                    ),

                    /* Toggle Field */
                    el(PanelRow, {},
                        el(ToggleControl,
                            {
                                label: 'enable automatic reload',
                                onChange: (value) => {
                                    props.setAttributes({ 'auto-reload': value });
                                },
                                checked: props.attributes["auto-reload"],
                            }
                        )
                    )
                ),
                el(PanelBody, { title: 'GPX Settings', initialOpen: false },
                    el(PanelRow, {},
                        el(FormTokenField, {
                            label: "Names",
                            suggestions: Object.keys(spotmapjsobj.feeds),
                            onChange: (value) => {
                                props.setAttributes({ "gpx-name": value });
                            },
                            value: props.attributes["gpx-name"],
                        }),
                    ),
                    el(PanelRow, {},
                        el(FormTokenField, {
                            label: "URLs",
                            suggestions: Object.keys(spotmapjsobj.feeds),
                            onChange: (value) => {
                                props.setAttributes({ "gpx-url": value });
                            },
                            value: props.attributes["gpx-url"],
                        })
                    ),
                    el(PanelRow, {},
                        el(FormTokenField, {
                            label: "Colors",
                            suggestions: Object.keys(spotmapjsobj.feeds),
                            onChange: (value) => {
                                props.setAttributes({ "gpx-color": value });
                            },
                            value: props.attributes["gpx-color"],
                        })
                    ),
                ),
                el(PanelBody, { title: 'Advanced', initialOpen: false },
                    /* Toggle Field */
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
                    )
                ),
            )]
        },
        attributes: {
            maps: {
                type: 'array',
                default: ['opentopomap', 'openstreetmap',],
            },
            feeds: {
                type: 'array',
            },
            colors: {
                type: 'array',
            },
            'gpx-color': {
                type: 'array',
            },
            'gpx-name': {
                type: 'array',
            },
            'gpx-url': {
                type: 'array',
            },
            mapcenter: {
                type: 'string',
                //default: 'all',
            },
            height: {
                type: 'string',
                default: '450',
            },
            debug: {
                type: 'string',
            },
            'auto-reload': {
                type: 'string',
            },
            splitLines: {
                type: 'array',
            },
        },
        keywords: ['findmespot', 'spot', 'gps', 'spotmap', 'gpx', __('map')],
    });
})(
    window.wp.blocks,
    window.wp.element,
    window.wp.i18n,
    window.wp.editor,
    window.wp.components,
    window.wp.compose,
);
