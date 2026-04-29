import { useState, useEffect, useRef } from '@wordpress/element';
import {
    Button,
    ColorPalette,
    Dropdown,
    Flex,
    FlexItem,
    Modal,
    Notice,
    SelectControl,
    TextControl,
    ToggleControl,
    Toolbar,
    ToolbarButton,
    ToolbarGroup,
} from '@wordpress/components';
import { settings } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import MapsToolbarGroup from '../../spotmap/components/MapsToolbarGroup';
import TimeToolbarGroup from '../../spotmap/components/TimeToolbarGroup';
import NavigationButtonsControl from '../../spotmap/components/NavigationButtonsControl';
import GpxManagerModal from '../../spotmap/components/GpxManagerModal';
import FeedsToolbarGroup from '../components/FeedsToolbarGroup';
import { COLORS } from '../../spotmap/constants';
import { SATELLITE_ICON } from '../../spotmap/icons';
import { getDefaultMaps } from '../mapDefaults';

const ALL_FEEDS = ( window.spotmapAdminData?.feeds ?? [] ).filter( Boolean );

const DEFAULT_FEED_STYLE = { color: 'blue', splitLines: 0 };

// Feed style modal — color and split lines only.
// lastPoint is a global shortcode flag (applies to all feeds), so it lives
// in the Settings dropdown rather than here.
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
                        'Draws a line connecting GPS points. If the gap between two consecutive points exceeds this many hours, a new line segment starts.'
                    ) }
                />
            </div>
        </Modal>
    );
}

function buildShortcode( {
    feeds,
    styles,
    maps,
    mapOverlays,
    height,
    mapcenter,
    filterPoints,
    lastPoint,
    autoReload,
    locateButton,
    fullscreenButton,
    scrollWheelZoom,
    enablePanning,
    navigationButtons,
    debug,
    dateRange,
    gpx,
} ) {
    const parts = [ '[spotmap' ];

    if ( feeds.length > 0 ) {
        parts.push( `feeds="${ feeds.join( ',' ) }"` );

        const colors = feeds.map(
            ( f ) => styles[ f ]?.color ?? DEFAULT_FEED_STYLE.color
        );
        parts.push( `colors="${ colors.join( ',' ) }"` );

        const splits = feeds.map(
            ( f ) => styles[ f ]?.splitLines ?? DEFAULT_FEED_STYLE.splitLines
        );
        if ( splits.some( ( v ) => v !== 0 ) ) {
            parts.push( `splitlines="${ splits.join( ',' ) }"` );
        }
    }

    // Always include maps — no safe default to omit against.
    if ( maps.length > 0 ) {
        parts.push( `maps="${ maps.join( ',' ) }"` );
    }
    if ( mapOverlays.length > 0 ) {
        parts.push( `map-overlays="${ mapOverlays.join( ',' ) }"` );
    }
    if ( height !== 500 ) {
        parts.push( `height="${ height }"` );
    }
    if ( mapcenter !== 'all' ) {
        parts.push( `mapcenter="${ mapcenter }"` );
    }
    if ( filterPoints !== 5 ) {
        parts.push( `filter-points="${ filterPoints }"` );
    }

    // Global flag — applies last-point highlight to all feeds uniformly.
    if ( lastPoint ) {
        parts.push( 'last-point' );
    }
    if ( autoReload ) {
        parts.push( 'auto-reload' );
    }
    if ( locateButton ) {
        parts.push( 'locate-button' );
    }
    if ( ! fullscreenButton ) {
        parts.push( 'fullscreen-button="false"' );
    }
    if ( ! scrollWheelZoom ) {
        parts.push( 'scroll-wheel-zoom="false"' );
    }
    if ( ! enablePanning ) {
        parts.push( 'enable-panning="false"' );
    }
    if ( ! navigationButtons.enabled ) {
        parts.push( 'navigation-buttons="false"' );
    }
    if ( dateRange?.from ) {
        parts.push( `date-range-from="${ dateRange.from }"` );
    }
    if ( dateRange?.to ) {
        parts.push( `date-range-to="${ dateRange.to }"` );
    }
    if ( gpx.length > 0 ) {
        parts.push( `gpx-name="${ gpx.map( ( t ) => t.name ).join( ',' ) }"` );
        parts.push( `gpx-url="${ gpx.map( ( t ) => t.url ).join( ',' ) }"` );
        parts.push(
            `gpx-color="${ gpx.map( ( t ) => t.color || '#FFD700' ).join( ',' ) }"`
        );
    }
    if ( debug ) {
        parts.push( 'debug' );
    }

    return parts.join( ' ' ) + ']';
}

export default function ShortcodeTab() {
    const [ feeds, setFeeds ] = useState( [] );
    const [ styles, setStyles ] = useState( {} );
    const [ maps, setMaps ] = useState( getDefaultMaps );
    const [ mapOverlays, setMapOverlays ] = useState( [] );
    const [ dateRange, setDateRange ] = useState( { from: '', to: '' } );
    const [ height, setHeight ] = useState( 500 );
    const [ mapcenter, setMapcenter ] = useState( 'all' );
    const [ filterPoints, setFilterPoints ] = useState( 5 );
    const [ lastPoint, setLastPoint ] = useState( false );
    const [ autoReload, setAutoReload ] = useState( false );
    const [ locateButton, setLocateButton ] = useState( false );
    const [ fullscreenButton, setFullscreenButton ] = useState( true );
    const [ scrollWheelZoom, setScrollWheelZoom ] = useState( true );
    const [ enablePanning, setEnablePanning ] = useState( true );
    const [ navigationButtons, setNavigationButtons ] = useState( {
        enabled: true,
        allPoints: true,
        latestPoint: true,
        gpxTracks: true,
    } );
    const [ debug, setDebug ] = useState( false );
    const [ gpx, setGpx ] = useState( [] );
    const [ feedStyleModal, setFeedStyleModal ] = useState( null );
    const [ gpxModalOpen, setGpxModalOpen ] = useState( false );
    const [ copied, setCopied ] = useState( false );

    const mapContainerRef = useRef( null );
    const spotmapRef = useRef( null );

    useEffect( () => {
        return () => {
            spotmapRef.current?.destroy();
            spotmapRef.current = null;
        };
    }, [] );

    // height excluded — it only affects the shortcode string, not the preview.
    // feeds=[] means "all feeds" in shortcode terms, so preview uses ALL_FEEDS.
    useEffect( () => {
        const previewFeeds = feeds.length > 0 ? feeds : ALL_FEEDS;

        const timer = setTimeout( () => {
            if ( typeof window.Spotmap === 'undefined' ) {
                return;
            }

            spotmapRef.current?.destroy();
            if ( mapContainerRef.current ) {
                delete mapContainerRef.current._spotmapOptions;
            }
            spotmapRef.current = null;

            const previewStyles = {};
            previewFeeds.forEach( ( f ) => {
                previewStyles[ f ] = {
                    ...( styles[ f ] ?? DEFAULT_FEED_STYLE ),
                    lastPoint,
                };
            } );

            const sm = new window.Spotmap( {
                feeds: previewFeeds,
                styles: previewStyles,
                maps,
                mapOverlays,
                mapElement: mapContainerRef.current,
                mapcenter,
                filterPoints,
                autoReload: false, // never auto-reload in preview
                locateButton,
                fullscreenButton,
                scrollWheelZoom,
                enablePanning,
                navigationButtons,
                debug,
                dateRange,
                gpx,
            } );
            spotmapRef.current = sm;
            sm.initMap()
                .then( () => {
                    setTimeout( () => sm.map?.invalidateSize?.(), 150 );
                } )
                .catch( ( err ) => {
                    // eslint-disable-next-line no-console
                    console.error( 'Spotmap preview init failed:', err );
                    spotmapRef.current = null;
                } );
        }, 500 );

        return () => clearTimeout( timer );
    }, [
        feeds,
        styles,
        maps,
        mapOverlays,
        dateRange,
        mapcenter,
        filterPoints,
        lastPoint,
        locateButton,
        fullscreenButton,
        scrollWheelZoom,
        enablePanning,
        navigationButtons,
        debug,
        gpx,
    ] );

    const toggleFeed = ( feed, checked ) => {
        const next = checked
            ? [ ...feeds, feed ]
            : feeds.filter( ( f ) => f !== feed );
        const newStyles = { ...styles };
        if ( checked && ! newStyles[ feed ] ) {
            newStyles[ feed ] = { ...DEFAULT_FEED_STYLE };
        }
        setFeeds( next );
        setStyles( newStyles );
    };

    const updateStyle = ( feed, key, value ) => {
        setStyles( ( prev ) => ( {
            ...prev,
            [ feed ]: { ...( prev[ feed ] ?? DEFAULT_FEED_STYLE ), [ key ]: value },
        } ) );
    };

    const navPartial =
        navigationButtons.enabled &&
        ( ! navigationButtons.allPoints ||
            ! navigationButtons.latestPoint ||
            ! navigationButtons.gpxTracks );

    const copyShortcode = ( shortcode ) => {
        const markCopied = () => {
            setCopied( true );
            setTimeout( () => setCopied( false ), 2000 );
        };
        if ( navigator.clipboard ) {
            navigator.clipboard.writeText( shortcode ).then( markCopied );
        } else {
            const el = document.createElement( 'textarea' );
            el.value = shortcode;
            document.body.appendChild( el );
            el.select();
            document.execCommand( 'copy' );
            document.body.removeChild( el );
            markCopied();
        }
    };

    const shortcode = buildShortcode( {
        feeds,
        styles,
        maps,
        mapOverlays,
        height,
        mapcenter,
        filterPoints,
        lastPoint,
        autoReload,
        locateButton,
        fullscreenButton,
        scrollWheelZoom,
        enablePanning,
        navigationButtons,
        debug,
        dateRange,
        gpx,
    } );

    if ( ALL_FEEDS.length === 0 ) {
        return (
            <div style={ { marginTop: '1rem' } }>
                <Notice status="warning" isDismissible={ false }>
                    { __(
                        'No feeds configured yet. Add a feed in the Feeds tab first.'
                    ) }
                </Notice>
            </div>
        );
    }

    return (
        <div style={ { marginTop: '1rem' } }>
            { feedStyleModal && (
                <FeedStyleModal
                    feed={ feedStyleModal }
                    style={ styles[ feedStyleModal ] }
                    onUpdate={ ( key, value ) =>
                        updateStyle( feedStyleModal, key, value )
                    }
                    onClose={ () => setFeedStyleModal( null ) }
                />
            ) }
            { gpxModalOpen && (
                <GpxManagerModal
                    gpx={ gpx }
                    onChange={ setGpx }
                    onClose={ () => setGpxModalOpen( false ) }
                />
            ) }

            <Toolbar label={ __( 'Shortcode generator controls' ) }>
                <FeedsToolbarGroup
                    feeds={ feeds }
                    allFeeds={ ALL_FEEDS }
                    styles={ styles }
                    onToggle={ toggleFeed }
                    onStyle={ setFeedStyleModal }
                />
                <MapsToolbarGroup
                    maps={ maps }
                    mapOverlays={ mapOverlays }
                    onChangeMaps={ setMaps }
                    onChangeOverlays={ setMapOverlays }
                />

                <TimeToolbarGroup
                    dateRange={ dateRange }
                    onChangeDateRange={ setDateRange }
                />

                { /* GPX tracks */ }
                <ToolbarGroup>
                    <ToolbarButton
                        icon={ SATELLITE_ICON }
                        label={ __( 'GPX tracks' ) }
                        onClick={ () => setGpxModalOpen( true ) }
                        isPressed={ gpxModalOpen }
                    >
                        { gpx.length > 0
                            ? `GPX (${ gpx.length })`
                            : __( 'GPX' ) }
                    </ToolbarButton>
                </ToolbarGroup>

                { /* Settings */ }
                <ToolbarGroup>
                    <Dropdown
                        popoverProps={ { placement: 'bottom-end' } }
                        renderToggle={ ( { isOpen, onToggle } ) => (
                            <ToolbarButton
                                icon={ settings }
                                label={ __( 'Map settings' ) }
                                onClick={ onToggle }
                                isPressed={ isOpen }
                            />
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
                                <TextControl
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                    type="number"
                                    min="200"
                                    max="1200"
                                    step="50"
                                    label={ __( 'Height (px)' ) }
                                    value={ height }
                                    onChange={ ( v ) => {
                                        const n = parseInt( v, 10 );
                                        if ( n >= 200 && n <= 1200 ) {
                                            setHeight( n );
                                        }
                                    } }
                                    help={ __(
                                        'Frontend map height — does not affect the preview above.'
                                    ) }
                                />
                                <SelectControl
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                    label={ __( 'Zoom to' ) }
                                    value={ mapcenter }
                                    options={ [
                                        {
                                            label: __( 'All points' ),
                                            value: 'all',
                                        },
                                        {
                                            label: __( 'Last trip' ),
                                            value: 'last-trip',
                                        },
                                        {
                                            label: __( 'Last point' ),
                                            value: 'last',
                                        },
                                        {
                                            label: __( 'GPX tracks' ),
                                            value: 'gpx',
                                        },
                                    ] }
                                    onChange={ setMapcenter }
                                />
                                <TextControl
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                    type="number"
                                    min="0"
                                    label={ __( 'Filter nearby points (m)' ) }
                                    value={ filterPoints }
                                    onChange={ ( v ) => {
                                        const n = parseInt( v, 10 );
                                        setFilterPoints( n >= 0 ? n : 0 );
                                    } }
                                    help={ __(
                                        'Hide points within this many meters of the previous point.'
                                    ) }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Highlight last point' ) }
                                    checked={ lastPoint }
                                    onChange={ setLastPoint }
                                    help={ __(
                                        'Applies to all feeds — the shortcode last-point flag is global.'
                                    ) }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Enable panning' ) }
                                    checked={ enablePanning }
                                    onChange={ setEnablePanning }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Scroll wheel zoom' ) }
                                    checked={ scrollWheelZoom }
                                    onChange={ setScrollWheelZoom }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Fullscreen button' ) }
                                    checked={ fullscreenButton }
                                    onChange={ setFullscreenButton }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Location button' ) }
                                    checked={ locateButton }
                                    onChange={ setLocateButton }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Auto-reload' ) }
                                    checked={ autoReload }
                                    onChange={ setAutoReload }
                                />
                                <NavigationButtonsControl
                                    value={ navigationButtons }
                                    onChange={ setNavigationButtons }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Debug' ) }
                                    checked={ debug }
                                    onChange={ setDebug }
                                />
                            </div>
                        ) }
                    />
                </ToolbarGroup>
            </Toolbar>

            { feeds.length === 0 && (
                <p
                    style={ {
                        margin: '8px 0',
                        color: '#757575',
                        fontSize: '13px',
                    } }
                >
                    { __(
                        'No feeds selected — previewing all feeds. Add feeds= to the shortcode to limit which feeds appear.'
                    ) }
                </p>
            ) }

            <div
                ref={ mapContainerRef }
                style={ {
                    height: '400px',
                    border: '1px solid #c3c4c7',
                    borderRadius: '4px',
                    marginTop: '8px',
                } }
            />

            <div style={ { marginTop: '12px' } }>
                <p
                    style={ {
                        margin: '0 0 4px',
                        fontWeight: 600,
                        fontSize: '13px',
                    } }
                >
                    { __( 'Shortcode' ) }
                </p>
                <Flex align="flex-start" gap={ 2 }>
                    <FlexItem isBlock>
                        <textarea
                            readOnly
                            value={ shortcode }
                            onClick={ ( e ) => e.target.select() }
                            rows={ 3 }
                            style={ {
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                padding: '8px',
                                border: '1px solid #c3c4c7',
                                borderRadius: '4px',
                                background: '#f6f7f7',
                                color: '#1d2327',
                                resize: 'vertical',
                                boxSizing: 'border-box',
                                wordBreak: 'break-all',
                            } }
                        />
                    </FlexItem>
                    <FlexItem>
                        <Button
                            variant="secondary"
                            onClick={ () => copyShortcode( shortcode ) }
                        >
                            { copied ? __( 'Copied!' ) : __( 'Copy' ) }
                        </Button>
                    </FlexItem>
                </Flex>
                { navPartial && (
                    <p
                        style={ {
                            margin: '4px 0 0',
                            fontSize: '12px',
                            color: '#996800',
                        } }
                    >
                        { __(
                            'Note: the shortcode format only supports enabling or disabling all navigation buttons together. Individual button selection is not included in the shortcode.'
                        ) }
                    </p>
                ) }
            </div>
        </div>
    );
}
