import { useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import {
    BlockControls,
    InspectorAdvancedControls,
    useBlockProps,
} from '@wordpress/block-editor';
import {
    TextControl,
    ToggleControl,
    SelectControl,
    ColorPalette,
    Button,
    RangeControl,
    Dropdown,
    Flex,
    FlexItem,
    ToolbarGroup,
    ToolbarButton,
    CheckboxControl,
    Modal,
    Popover,
    __experimentalUnitControl as UnitControl,
    ExternalLink,
} from '@wordpress/components';
import { brush, settings } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import MapsToolbarGroup from './components/MapsToolbarGroup';
import TimeToolbarGroup from './components/TimeToolbarGroup';
import NavigationButtonsControl from './components/NavigationButtonsControl';
import GpxManagerModal from './components/GpxManagerModal';
import { COLORS } from './constants';
import { SATELLITE_ICON } from './icons';

const EDITOR_POINT_LIMIT = 150000;

const DEFAULT_FEED_STYLE = {
    color: 'blue',
    splitLines: 8,
    lineWidth: 2,
    lineOpacity: 1.0,
    visible: true,
};

const getFeedName = ( f ) => ( typeof f === 'string' ? f : f.name );

// Feed styling modal opened via the brush icon in the Feeds dropdown.
function FeedStyleModal( { feed, style, onUpdate, onClose } ) {
    const s = { ...DEFAULT_FEED_STYLE, ...style };
    return (
        <Modal
            title={ feed + ' — ' + __( 'Style' ) }
            onRequestClose={ onClose }
            size="medium"
        >
            <div
                style={ {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    padding: '8px 0',
                } }
            >
                <div>
                    <p
                        style={ {
                            margin: '0 0 8px',
                            fontWeight: 600,
                            fontSize: '13px',
                        } }
                    >
                        { __( 'Color' ) }
                    </p>
                    <ColorPalette
                        colors={ COLORS }
                        value={ s.color || 'blue' }
                        onChange={ ( value ) =>
                            value && onUpdate( 'color', value )
                        }
                        disableCustomColors={ false }
                        clearable={ false }
                    />
                </div>
                <TextControl
                    __nextHasNoMarginBottom
                    __next40pxDefaultSize
                    type="number"
                    min="0"
                    label={ __( 'Split lines (hours)' ) }
                    value={ s.splitLines || '' }
                    placeholder={ __( '0 = disabled' ) }
                    onChange={ ( value ) => {
                        const n = parseInt( value, 10 );
                        onUpdate( 'splitLines', n > 0 ? n : 0 );
                    } }
                    help={ __(
                        'Draws a line connecting GPS points. If the gap between two consecutive points exceeds this many hours, a new line segment starts. Leave empty or 0 to draw no line.'
                    ) }
                />
                <RangeControl
                    __nextHasNoMarginBottom
                    __next40pxDefaultSize
                    label={ __( 'Line width (px)' ) }
                    value={ s.lineWidth ?? 2 }
                    onChange={ ( value ) => onUpdate( 'lineWidth', value ) }
                    min={ 1 }
                    max={ 6 }
                    step={ 1 }
                />
                <RangeControl
                    __nextHasNoMarginBottom
                    __next40pxDefaultSize
                    label={ __( 'Line opacity' ) }
                    value={ s.lineOpacity ?? 1.0 }
                    onChange={ ( value ) => onUpdate( 'lineOpacity', value ) }
                    min={ 0.2 }
                    max={ 1.0 }
                    step={ 0.1 }
                />
                <ToggleControl
                    __nextHasNoMarginBottom
                    label={ __( 'Show last point' ) }
                    checked={ !! s.lastPoint }
                    onChange={ ( value ) => onUpdate( 'lastPoint', value ) }
                    help={ __(
                        'Highlight the latest point with a large circle marker'
                    ) }
                />
                <ToggleControl
                    __nextHasNoMarginBottom
                    label={ __( 'Show on map' ) }
                    checked={ s.visible !== false }
                    onChange={ ( value ) => onUpdate( 'visible', value ) }
                    help={ __(
                        'Uncheck to hide this feed without removing it'
                    ) }
                />
            </div>
        </Modal>
    );
}

export default function Edit( { attributes, setAttributes } ) {
    const mapRef = useRef( null );
    const spotmapRef = useRef( null );
    const [ mapId ] = useState(
        () => 'spotmap-editor-' + Math.random().toString( 36 ).slice( 2, 10 )
    );

    // Feed style modal: null = closed, string = feed name open
    const [ feedStyleModal, setFeedStyleModal ] = useState( null );
    // GPX manager modal
    const [ gpxManagerOpen, setGpxManagerOpen ] = useState( false );
    // Per-feed point counts: null = loading, Map<feedName, count> = loaded
    const [ feedPointCounts, setFeedPointCounts ] = useState( null );

    // Fetch per-feed point counts, respecting the block's dateRange filter.
    // Re-runs whenever dateRange changes so the threshold check stays accurate.
    useEffect( () => {
        setFeedPointCounts( null );
        const params = new URLSearchParams();
        if ( attributes.dateRange?.from ) {
            params.set( 'from', attributes.dateRange.from );
        }
        if ( attributes.dateRange?.to ) {
            params.set( 'to', attributes.dateRange.to );
        }
        const query = params.toString();
        apiFetch( {
            path: '/spotmap/v1/db-feeds' + ( query ? '?' + query : '' ),
        } )
            .then( ( feeds ) => {
                const counts = new Map();
                feeds.forEach( ( f ) =>
                    counts.set( f.feed_name, f.point_count || 0 )
                );
                setFeedPointCounts( counts );
            } )
            .catch( () => setFeedPointCounts( new Map() ) );
    }, [ attributes.dateRange?.from, attributes.dateRange?.to ] );

    // Total points across all DB feeds (null while loading)
    const totalPoints =
        feedPointCounts === null
            ? null
            : Array.from( feedPointCounts.values() ).reduce(
                  ( s, c ) => s + c,
                  0
              );

    // Migrate old format: feeds was string[], styles was a separate Record<string, FeedStyle>
    useEffect( () => {
        if (
            attributes.feeds.length > 0 &&
            typeof attributes.feeds[ 0 ] === 'string'
        ) {
            const migrated = attributes.feeds.map( ( name ) => ( {
                name,
                ...DEFAULT_FEED_STYLE,
                ...( attributes.styles?.[ name ] || {} ),
            } ) );
            setAttributes( { feeds: migrated, styles: {} } );
        }
    }, [] ); // eslint-disable-line react-hooks/exhaustive-deps

    // Points for the currently selected feeds only (null while loading)
    const selectedPoints =
        feedPointCounts === null
            ? null
            : attributes.feeds.reduce(
                  ( s, f ) =>
                      s + ( feedPointCounts.get( getFeedName( f ) ) || 0 ),
                  0
              );

    // Inject Leaflet CSS into the editor document (handles iframe rendering)
    useEffect( () => {
        const el = mapRef.current;
        if ( ! el ) {
            return;
        }
        const doc = el.ownerDocument;
        const baseUrl = window.spotmapjsobj?.url || '';
        const cssFiles = [
            'leaflet/leaflet.css',
            'leafletfullscreen/leaflet.fullscreen.css',
            'leaflet-easy-button/easy-button.css',
            'leaflet-beautify-marker/leaflet-beautify-marker-icon.css',
            'css/custom.css',
            '../includes/css/font-awesome-all.min.css',
        ];
        const links = cssFiles
            .filter(
                ( file ) =>
                    ! doc.querySelector( `link[href="${ baseUrl + file }"]` )
            )
            .map( ( file ) => {
                const link = doc.createElement( 'link' );
                link.rel = 'stylesheet';
                link.href = baseUrl + file;
                doc.head.appendChild( link );
                return link;
            } );
        return () => links.forEach( ( l ) => l.remove() );
    }, [] );

    // On first insert (when maps is empty, meaning never initialized), populate from admin-configured defaults.
    // We intentionally do NOT re-trigger when feeds is empty, so the user can choose to show no feeds.
    // Waits for feedPointCounts to load so we can decide whether to default to all feeds or none.
    useEffect( () => {
        // Wait until point counts are loaded before initialising defaults.
        if ( feedPointCounts === null ) {
            return;
        }
        if ( attributes.maps.length === 0 && window.spotmapjsobj?.feeds ) {
            const feedNames = Array.isArray( window.spotmapjsobj.feeds )
                ? window.spotmapjsobj.feeds
                : Object.keys( window.spotmapjsobj.feeds );

            const dv = window.spotmapjsobj?.defaultValues ?? {};
            const adminColors = ( dv.color || '' )
                .split( ',' )
                .map( ( c ) => c.trim() )
                .filter( Boolean );
            const numColors = adminColors.length || 1;

            // If the DB already holds more than 150 000 points, default to no feeds
            // so the editor doesn't immediately try to render a huge dataset.
            const enabledNames =
                totalPoints > EDITOR_POINT_LIMIT ? [] : feedNames;
            const defaultFeedObjects = enabledNames.map( ( name, i ) => ( {
                name,
                ...DEFAULT_FEED_STYLE,
                color: adminColors[ i % numColors ] || DEFAULT_FEED_STYLE.color,
            } ) );

            const defaultMaps = dv.maps
                ? dv.maps
                      .split( ',' )
                      .map( ( m ) => m.trim() )
                      .filter( Boolean )
                : attributes.maps;
            const defaultHeight = dv.height
                ? parseInt( dv.height, 10 )
                : attributes.height;
            const defaultMapcenter = dv.mapcenter || attributes.mapcenter;
            const defaultFilterPoints = dv[ 'filter-points' ]
                ? parseInt( dv[ 'filter-points' ], 10 )
                : attributes.filterPoints;

            setAttributes( {
                feeds: defaultFeedObjects,
                styles: {},
                maps: defaultMaps,
                height: defaultHeight,
                mapcenter: defaultMapcenter,
                filterPoints: defaultFilterPoints,
            } );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        feedPointCounts,
        attributes.maps.length,
        attributes.filterPoints,
        attributes.height,
        attributes.mapcenter,
        setAttributes,
    ] );

    // Initialize / update the Leaflet map via the existing Spotmap class
    useEffect( () => {
        const container = mapRef.current;
        if ( ! container || typeof window.Spotmap === 'undefined' ) {
            return;
        }

        // Skip map init while point count is still loading, or if selected feeds exceed the editor threshold.
        if ( selectedPoints === null || selectedPoints > EDITOR_POINT_LIMIT ) {
            return;
        }

        const feedNames = [];
        const feedStyles = {};
        attributes.feeds.forEach( ( f ) => {
            const name = getFeedName( f );
            if ( ! name ) {
                return;
            }
            feedNames.push( name );
            if ( typeof f === 'object' ) {
                const { name: _n, ...style } = f;
                feedStyles[ name ] = style;
            }
        } );
        const options = {
            ...attributes,
            feeds: feedNames,
            styles: feedStyles,
            mapId,
            mapElement: container,
            enablePanning: false, // always disabled in editor preview
        };

        if ( spotmapRef.current ) {
            spotmapRef.current.destroy();
            spotmapRef.current = null;
        }

        let timer;
        try {
            const sm = new window.Spotmap( options );
            spotmapRef.current = sm;
            sm.initMap();
            timer = setTimeout( () => {
                if ( ! sm._destroyed ) {
                    sm.map?.invalidateSize?.();
                }
            }, 200 );
        } catch ( e ) {
            console.error( 'Spotmap init error:', e );
        }

        return () => {
            clearTimeout( timer );
            if ( spotmapRef.current ) {
                spotmapRef.current.destroy();
                spotmapRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        mapId,
        selectedPoints,
        attributes.feeds,
        attributes.mapcenter,
        attributes.filterPoints,
        attributes.dateRange,
        attributes.gpx,
        attributes.debug,
        attributes.fullscreenButton,
    ] );

    // When only the map tile layer selection changes, swap layers in-place
    // instead of rebuilding the entire map and re-fetching data.
    const mapsEffectMounted = useRef( false );
    const prevMapsRef = useRef( attributes.maps );
    useEffect( () => {
        if ( ! mapsEffectMounted.current ) {
            mapsEffectMounted.current = true;
            return;
        }
        if ( spotmapRef.current ) {
            const prevMaps = prevMapsRef.current;
            const newlyAdded = attributes.maps.find(
                ( m ) => ! prevMaps.includes( m )
            );
            prevMapsRef.current = attributes.maps;
            spotmapRef.current.updateMaps( attributes.maps, newlyAdded );
        }
    }, [ attributes.maps ] );

    const autoReloadEffectMounted = useRef( false );
    useEffect( () => {
        if ( ! autoReloadEffectMounted.current ) {
            autoReloadEffectMounted.current = true;
            return;
        }
        if ( spotmapRef.current ) {
            spotmapRef.current.updateAutoReload(
                attributes.autoReload ?? false
            );
        }
    }, [ attributes.autoReload ] );

    const buttonsEffectMounted = useRef( false );
    useEffect( () => {
        if ( ! buttonsEffectMounted.current ) {
            buttonsEffectMounted.current = true;
            return;
        }
        if ( spotmapRef.current ) {
            spotmapRef.current.updateButtons(
                attributes.locateButton,
                attributes.navigationButtons
            );
        }
    }, [ attributes.locateButton, attributes.navigationButtons ] );

    const overlaysEffectMounted = useRef( false );
    useEffect( () => {
        if ( ! overlaysEffectMounted.current ) {
            overlaysEffectMounted.current = true;
            return;
        }
        if ( spotmapRef.current ) {
            spotmapRef.current.updateOverlays( attributes.mapOverlays ?? [] );
        }
    }, [ attributes.mapOverlays ] );

    const heightEffectMounted = useRef( false );
    useEffect( () => {
        if ( ! heightEffectMounted.current ) {
            heightEffectMounted.current = true;
            return;
        }
        if ( spotmapRef.current ) {
            spotmapRef.current.updateHeight( attributes.height );
        }
    }, [ attributes.height ] );

    const scrollWheelZoomEffectMounted = useRef( false );
    useEffect( () => {
        if ( ! scrollWheelZoomEffectMounted.current ) {
            scrollWheelZoomEffectMounted.current = true;
            return;
        }
        if ( spotmapRef.current ) {
            spotmapRef.current.updateScrollWheelZoom(
                attributes.scrollWheelZoom ?? true
            );
        }
    }, [ attributes.scrollWheelZoom ] );

    let availableFeeds = [];
    if ( window.spotmapjsobj?.feeds ) {
        availableFeeds = Array.isArray( window.spotmapjsobj.feeds )
            ? window.spotmapjsobj.feeds
            : Object.keys( window.spotmapjsobj.feeds );
    }

    const updateStyle = ( feed, key, value ) => {
        const newFeeds = attributes.feeds.map( ( f ) => {
            const name = getFeedName( f );
            if ( name !== feed ) {
                return f;
            }
            return {
                ...( typeof f === 'object'
                    ? f
                    : { name: f, ...DEFAULT_FEED_STYLE } ),
                [ key ]: value,
            };
        } );
        setAttributes( { feeds: newFeeds } );
    };

    const toggleFeed = ( feed, checked ) => {
        const next = checked
            ? [ ...attributes.feeds, { name: feed, ...DEFAULT_FEED_STYLE } ]
            : attributes.feeds.filter( ( f ) => getFeedName( f ) !== feed );
        setAttributes( { feeds: next } );
    };

    return (
        <>
            { gpxManagerOpen && (
                <GpxManagerModal
                    gpx={ attributes.gpx }
                    onChange={ ( gpx ) => setAttributes( { gpx } ) }
                    onClose={ () => setGpxManagerOpen( false ) }
                />
            ) }
            { feedStyleModal && (
                <FeedStyleModal
                    feed={ feedStyleModal }
                    style={ attributes.feeds.find(
                        ( f ) => getFeedName( f ) === feedStyleModal
                    ) }
                    onUpdate={ ( key, value ) =>
                        updateStyle( feedStyleModal, key, value )
                    }
                    onClose={ () => setFeedStyleModal( null ) }
                />
            ) }

            { /* Block toolbar */ }
            <BlockControls>
                { /* Feeds */ }
                <ToolbarGroup>
                    <Dropdown
                        popoverProps={ { placement: 'bottom-start' } }
                        renderToggle={ ( { isOpen, onToggle } ) => (
                            <ToolbarButton
                                icon="rss"
                                label={ __( 'Feeds' ) }
                                onClick={ onToggle }
                                isPressed={ isOpen }
                            >
                                { __( 'Feeds' ) }
                            </ToolbarButton>
                        ) }
                        renderContent={ ( { onClose } ) => (
                            <div
                                style={ { padding: '8px', minWidth: '200px' } }
                            >
                                { availableFeeds.length === 0 && (
                                    <p>
                                        { __(
                                            'No feeds yet — your map is feeling lonely!'
                                        ) }
                                        <ExternalLink href="options-general.php?page=spotmap#add-feed">
                                            { __( 'Add a feed' ) }
                                        </ExternalLink>
                                    </p>
                                ) }
                                { availableFeeds.length > 0 && (
                                    <Flex
                                        gap={ 2 }
                                        style={ {
                                            marginBottom: '8px',
                                            paddingBottom: '8px',
                                            borderBottom: '1px solid #ddd',
                                        } }
                                    >
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={ () => {
                                                const byName = new Map(
                                                    attributes.feeds
                                                        .filter(
                                                            ( f ) =>
                                                                typeof f ===
                                                                'object'
                                                        )
                                                        .map( ( f ) => [
                                                            f.name,
                                                            f,
                                                        ] )
                                                );
                                                setAttributes( {
                                                    feeds: availableFeeds.map(
                                                        ( feed ) =>
                                                            byName.get(
                                                                feed
                                                            ) ?? {
                                                                name: feed,
                                                                ...DEFAULT_FEED_STYLE,
                                                            }
                                                    ),
                                                } );
                                            } }
                                        >
                                            { __( 'Select all' ) }
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={ () =>
                                                setAttributes( { feeds: [] } )
                                            }
                                        >
                                            { __( 'Select none' ) }
                                        </Button>
                                    </Flex>
                                ) }
                                { availableFeeds.map( ( feed ) => {
                                    const feedObj = attributes.feeds.find(
                                        ( f ) => getFeedName( f ) === feed
                                    );
                                    return (
                                        <Flex
                                            key={ feed }
                                            gap={ 2 }
                                            align="center"
                                        >
                                            <FlexItem isBlock>
                                                <CheckboxControl
                                                    __nextHasNoMarginBottom
                                                    label={ feed }
                                                    checked={
                                                        feedObj !== undefined
                                                    }
                                                    onChange={ ( checked ) =>
                                                        toggleFeed(
                                                            feed,
                                                            checked
                                                        )
                                                    }
                                                />
                                            </FlexItem>
                                            <Button
                                                icon={ brush }
                                                label={
                                                    __( 'Style' ) + ' ' + feed
                                                }
                                                size="small"
                                                variant="tertiary"
                                                style={ {
                                                    visibility: feedObj
                                                        ? 'visible'
                                                        : 'hidden',
                                                } }
                                                onClick={ () => {
                                                    onClose();
                                                    setFeedStyleModal( feed );
                                                } }
                                            />
                                            <span
                                                style={ {
                                                    display: 'block',
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    background:
                                                        feedObj?.color ||
                                                        'blue',
                                                    flexShrink: 0,
                                                    visibility: feedObj
                                                        ? 'visible'
                                                        : 'hidden',
                                                } }
                                            />
                                        </Flex>
                                    );
                                } ) }
                            </div>
                        ) }
                    />
                </ToolbarGroup>

                { /* Maps */ }
                <MapsToolbarGroup
                    maps={ attributes.maps }
                    mapOverlays={ attributes.mapOverlays }
                    onChangeMaps={ ( next ) => setAttributes( { maps: next } ) }
                    onChangeOverlays={ ( next ) =>
                        setAttributes( { mapOverlays: next } )
                    }
                />

                { /* GPX — opens manager modal */ }
                <ToolbarGroup>
                    <ToolbarButton
                        label={ __( 'GPX tracks' ) }
                        onClick={ () => setGpxManagerOpen( true ) }
                        icon={ SATELLITE_ICON }
                    >
                        { __( 'GPX' ) }
                    </ToolbarButton>
                </ToolbarGroup>

                { /* Time filter */ }
                <TimeToolbarGroup
                    dateRange={ attributes.dateRange }
                    onChangeDateRange={ ( next ) =>
                        setAttributes( { dateRange: next } )
                    }
                />

                { /* Map settings */ }
                <ToolbarGroup>
                    <Dropdown
                        popoverProps={ { placement: 'bottom-start' } }
                        renderToggle={ ( { isOpen, onToggle } ) => (
                            <ToolbarButton
                                label={ __( 'Map settings' ) }
                                icon={ settings }
                                onClick={ onToggle }
                                isPressed={ isOpen }
                            >
                                { __( 'Settings' ) }
                            </ToolbarButton>
                        ) }
                        renderContent={ () => (
                            <div
                                style={ {
                                    padding: '12px',
                                    minWidth: '280px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                } }
                            >
                                <SelectControl
                                    __next40pxDefaultSize
                                    label={ __( 'Zoom to' ) }
                                    value={ attributes.mapcenter }
                                    options={ [
                                        {
                                            label: 'All points',
                                            value: 'all',
                                        },
                                        {
                                            label: 'Last trip',
                                            value: 'last-trip',
                                        },
                                        {
                                            label: 'Latest point',
                                            value: 'last',
                                        },
                                        {
                                            label: 'GPX tracks',
                                            value: 'gpx',
                                        },
                                    ] }
                                    onChange={ ( value ) =>
                                        setAttributes( { mapcenter: value } )
                                    }
                                />
                                <RangeControl
                                    __next40pxDefaultSize
                                    label={ __( 'Height (px)' ) }
                                    value={ attributes.height }
                                    onChange={ ( value ) =>
                                        setAttributes( { height: value } )
                                    }
                                    min={ 200 }
                                    max={ 1200 }
                                    step={ 50 }
                                />
                                <ToggleControl
                                    label={ __( 'Enable panning' ) }
                                    checked={ attributes.enablePanning }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            enablePanning: value,
                                        } )
                                    }
                                />
                                <ToggleControl
                                    label={ __( 'Scroll wheel zoom' ) }
                                    checked={ attributes.scrollWheelZoom }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            scrollWheelZoom: value,
                                        } )
                                    }
                                />
                                <UnitControl
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                    label={ __( 'Hide nearby points' ) }
                                    value={ `${ attributes.filterPoints }m` }
                                    units={ [
                                        {
                                            value: 'm',
                                            label: 'Meter',
                                            default: 10,
                                        },
                                    ] }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            filterPoints:
                                                parseInt( value ) || 0,
                                        } )
                                    }
                                    help={ __(
                                        'Hide points within this radius to reduce clutter'
                                    ) }
                                />
                                <ToggleControl
                                    label={ __( 'Auto-reload' ) }
                                    checked={ attributes.autoReload }
                                    onChange={ ( value ) =>
                                        setAttributes( { autoReload: value } )
                                    }
                                    help={ __(
                                        'Refresh map data every 30 seconds'
                                    ) }
                                />
                                <ToggleControl
                                    label={ __( 'Location button' ) }
                                    checked={ attributes.locateButton }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            locateButton: value,
                                        } )
                                    }
                                />
                                <ToggleControl
                                    label={ __( 'Fullscreen button' ) }
                                    checked={ attributes.fullscreenButton }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            fullscreenButton: value,
                                        } )
                                    }
                                />
                                <NavigationButtonsControl
                                    value={ attributes.navigationButtons }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            navigationButtons: value,
                                        } )
                                    }
                                />
                            </div>
                        ) }
                    />
                </ToolbarGroup>
            </BlockControls>

            { /* Sidebar — Advanced only */ }
            <InspectorAdvancedControls>
                <ToggleControl
                    label={ __( 'Debug' ) }
                    checked={ attributes.debug }
                    onChange={ ( value ) => setAttributes( { debug: value } ) }
                    help={ __(
                        'Log map engine decisions (data fetching, point filtering, layer updates) to the browser console.'
                    ) }
                />
            </InspectorAdvancedControls>

            { /* Block preview */ }
            <div
                { ...useBlockProps( {
                    style: {
                        height: attributes.height + 'px',
                        zIndex: 0,
                        overflow: 'hidden',
                        fontSize: 'initial',
                        lineHeight: 'initial',
                    },
                } ) }
            >
                { selectedPoints !== null &&
                selectedPoints > EDITOR_POINT_LIMIT ? (
                    <div
                        style={ {
                            height: '100%',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f0f0f0',
                            color: '#666',
                            flexDirection: 'column',
                            gap: '8px',
                            textAlign: 'center',
                            padding: '16px',
                        } }
                    >
                        <strong>
                            { __(
                                'Map preview disabled — selected feeds contain'
                            ) }{ ' ' }
                            { selectedPoints.toLocaleString() }{ ' ' }
                            { __( 'points (limit: 150,000).' ) }
                        </strong>
                        <span>
                            { __(
                                'Deselect some feeds to enable the preview. The map loads normally for visitors.'
                            ) }
                        </span>
                    </div>
                ) : (
                    <div
                        ref={ mapRef }
                        id={ mapId }
                        style={ { height: '100%', width: '100%' } }
                    />
                ) }
            </div>
        </>
    );
}
