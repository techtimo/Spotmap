import { useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import {
    BlockControls,
    InspectorAdvancedControls,
    MediaUpload,
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
import { brush, settings, upload, trash } from '@wordpress/icons';
import { uploadMedia } from '@wordpress/media-utils';
import { __ } from '@wordpress/i18n';
import MapsToolbarGroup from './components/MapsToolbarGroup';
import TimeToolbarGroup from './components/TimeToolbarGroup';

const COLORS = [
    { name: 'crimson', color: '#DC143C' },
    { name: 'blue', color: '#0000FF' },
    { name: 'lime green', color: '#32CD32' },
    { name: 'orange', color: '#FF8C00' },
    { name: 'magenta', color: '#FF00FF' },
    { name: 'cyan', color: '#00CED1' },
    { name: 'gold', color: '#FFD700' },
    { name: 'coral', color: '#FF6347' },
    { name: 'medium purple', color: '#9370DB' },
    { name: 'white', color: '#FFFFFF' },
    { name: 'black', color: '#000000' },
];

// Satellite icon (inline SVG)
const SATELLITE_ICON = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 203.556 203.556"
        width="20"
        height="20"
        fill="currentColor"
    >
        <g>
            <path d="M201.359,137.3l-43.831-43.831l11.453-11.452c1.407-1.407,2.197-3.314,2.197-5.304c0-1.989-0.79-3.896-2.197-5.304l-36.835-36.834c-2.929-2.928-7.677-2.928-10.606,0l-11.452,11.452L66.253,2.196c-2.93-2.928-7.678-2.928-10.606,0L18.813,39.03c-2.929,2.93-2.929,7.678,0,10.607l43.831,43.831l-11.453,11.452c-1.407,1.407-2.197,3.314-2.197,5.304s0.79,3.896,2.197,5.304l36.837,36.836c1.464,1.464,3.384,2.196,5.303,2.196c1.919,0,3.839-0.732,5.303-2.196l11.453-11.453l43.83,43.83c1.465,1.464,3.384,2.196,5.303,2.196c1.919,0,3.839-0.732,5.303-2.196l36.835-36.834c1.407-1.407,2.197-3.314,2.197-5.304C203.556,140.614,202.766,138.707,201.359,137.3z M34.723,44.334L60.95,18.107l38.53,38.526L82.314,73.799l-9.063,9.063L34.723,44.334z M93.331,136.454l-26.23-26.229l11.448-11.447c0.002-0.002,0.003-0.003,0.005-0.005l12.443-12.443l35.845-35.844l26.229,26.228l-11.446,11.446c-0.003,0.003-0.005,0.005-0.007,0.007l-18.417,18.418L93.331,136.454z M159.221,168.831l-38.527-38.526l26.229-26.229l38.527,38.527L159.221,168.831z" />
            <path d="M72.344,188.555c-15.317,0.001-29.717-5.964-40.548-16.795C20.965,160.929,15,146.528,15,131.211c0-4.143-3.358-7.5-7.5-7.5c-4.143,0-7.5,3.358-7.5,7.5c0,19.324,7.526,37.491,21.189,51.155c13.663,13.664,31.829,21.189,51.152,21.189c0.001,0,0.002,0,0.004,0c4.142,0,7.499-3.358,7.499-7.5C79.845,191.912,76.486,188.555,72.344,188.555z" />
            <path d="M69.346,174.133c4.142,0,7.5-3.357,7.5-7.5c0-4.143-3.358-7.5-7.5-7.5c-6.658,0-12.916-2.593-17.624-7.3c-4.707-4.707-7.299-10.965-7.299-17.622c0-4.142-3.357-7.5-7.5-7.5h0c-4.142,0-7.5,3.358-7.5,7.5c-0.001,10.663,4.152,20.688,11.693,28.229C48.656,169.981,58.682,174.133,69.346,174.133z" />
        </g>
    </svg>
);

const DEFAULT_FEED_STYLE = {
    color: 'blue',
    splitLines: 8,
    lineWidth: 2,
    lineOpacity: 1.0,
    visible: true,
};

// Toggle with a flyout sub-popover that reveals on hover.
function NavigationButtonsControl( { value, onChange } ) {
    const [ open, setOpen ] = useState( false );
    const anchorRef = useRef( null );
    const closeTimer = useRef( null );
    const update = ( key, v ) => onChange( { ...value, [ key ]: v } );

    const scheduleClose = () => {
        closeTimer.current = setTimeout( () => setOpen( false ), 150 );
    };
    const cancelClose = () => {
        if ( closeTimer.current ) {
            clearTimeout( closeTimer.current );
        }
    };

    return (
        <div
            ref={ anchorRef }
            onMouseEnter={ () => {
                cancelClose();
                setOpen( true );
            } }
            onMouseLeave={ scheduleClose }
        >
            <ToggleControl
                __nextHasNoMarginBottom
                label={ __( 'Zoom-to navigation buttons' ) }
                checked={ value.enabled }
                onChange={ ( v ) => update( 'enabled', v ) }
            />
            { open && (
                <Popover
                    anchor={ anchorRef.current }
                    placement="left-end"
                    focusOnMount={ false }
                    onClose={ () => setOpen( false ) }
                >
                    <div
                        style={ {
                            padding: '8px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            minWidth: '140px',
                        } }
                        onMouseEnter={ cancelClose }
                        onMouseLeave={ scheduleClose }
                    >
                        <CheckboxControl
                            __nextHasNoMarginBottom
                            label={ __( 'All points' ) }
                            checked={ value.allPoints }
                            onChange={ ( v ) => update( 'allPoints', v ) }
                        />
                        <CheckboxControl
                            __nextHasNoMarginBottom
                            label={ __( 'Latest point' ) }
                            checked={ value.latestPoint }
                            onChange={ ( v ) => update( 'latestPoint', v ) }
                        />
                        <CheckboxControl
                            __nextHasNoMarginBottom
                            label={ __( 'GPX tracks' ) }
                            checked={ value.gpxTracks }
                            onChange={ ( v ) => update( 'gpxTracks', v ) }
                        />
                    </div>
                </Popover>
            ) }
        </div>
    );
}

const GPX_PAGE_SIZE = 10;

// GPX manager modal — central hub for managing GPX tracks.
function GpxManagerModal( {
    gpx,
    onAdd,
    onUpload,
    onRemoveAll,
    onRemoveOne,
    setAttributes,
    onClose,
} ) {
    const uploadInputRef = useRef( null );
    const [ page, setPage ] = useState( 0 );
    const [ isDragging, setIsDragging ] = useState( false );
    const [ styleTarget, setStyleTarget ] = useState( null );
    const dragCounter = useRef( 0 );

    const updateGpxProp = ( key, value ) => {
        const updated =
            styleTarget === 'all'
                ? gpx.map( ( t ) => ( { ...t, [ key ]: value } ) )
                : gpx.map( ( t, i ) =>
                      i === styleTarget ? { ...t, [ key ]: value } : t
                  );
        setAttributes( { gpx: updated } );
    };

    const totalPages = Math.ceil( gpx.length / GPX_PAGE_SIZE );
    // Clamp page when tracks are removed and current page becomes empty.
    const safePage = Math.min( page, Math.max( 0, totalPages - 1 ) );
    const pageStart = safePage * GPX_PAGE_SIZE;
    const pageTracks = gpx.slice( pageStart, pageStart + GPX_PAGE_SIZE );

    const uploadFiles = ( files ) => {
        if ( ! files || ! files.length ) {
            return;
        }
        uploadMedia( {
            filesList: files,
            allowedTypes: [ 'text/xml' ],
            onFileChange: ( uploaded ) => {
                onUpload( uploaded.filter( ( f ) => ! f.errorCode ) );
            },
            onError: () => {},
        } );
    };

    const handleFileChange = ( e ) => {
        uploadFiles( e.target.files );
        // Reset input so same file can be re-uploaded
        e.target.value = '';
    };

    const handleDragEnter = ( e ) => {
        e.preventDefault();
        dragCounter.current++;
        setIsDragging( true );
    };

    const handleDragLeave = ( e ) => {
        e.preventDefault();
        dragCounter.current--;
        if ( dragCounter.current === 0 ) {
            setIsDragging( false );
        }
    };

    const handleDragOver = ( e ) => {
        e.preventDefault();
    };

    const handleDrop = ( e ) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging( false );
        uploadFiles( e.dataTransfer.files );
    };

    // Resolve style target values for the inline style panel.
    const styleTrack = styleTarget === 'all' ? gpx[ 0 ] : gpx[ styleTarget ];

    return (
        <Modal
            title={
                styleTarget !== null ? __( 'GPX — Style' ) : __( 'GPX Tracks' )
            }
            onRequestClose={
                styleTarget !== null ? () => setStyleTarget( null ) : onClose
            }
            size="medium"
        >
            { styleTarget !== null ? (
                <div
                    style={ {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        padding: '8px 0',
                    } }
                >
                    <Button
                        variant="tertiary"
                        icon="arrow-left-alt2"
                        onClick={ () => setStyleTarget( null ) }
                        style={ { alignSelf: 'flex-start' } }
                    >
                        { __( 'Back to tracks' ) }
                    </Button>
                    <p style={ { margin: 0 } }>
                        { styleTarget === 'all'
                            ? gpx.map( ( t ) => t.name ).join( ', ' )
                            : styleTrack?.name }
                    </p>
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
                            value={ styleTrack?.color || 'gold' }
                            onChange={ ( v ) =>
                                v && updateGpxProp( 'color', v )
                            }
                            disableCustomColors={ false }
                            clearable={ false }
                        />
                    </div>
                    <ToggleControl
                        __nextHasNoMarginBottom
                        label={ __( 'Show on map' ) }
                        checked={ styleTrack?.visible !== false }
                        onChange={ ( v ) => updateGpxProp( 'visible', v ) }
                        help={ __(
                            'Uncheck to hide this track without removing it'
                        ) }
                    />
                    <ToggleControl
                        __nextHasNoMarginBottom
                        label={ __( 'Show download button' ) }
                        checked={ !! styleTrack?.download }
                        onChange={ ( v ) => updateGpxProp( 'download', v ) }
                        help={ __(
                            'Show a download icon in the layer control and popup'
                        ) }
                    />
                </div>
            ) : (
                <div
                    onDragEnter={ handleDragEnter }
                    onDragLeave={ handleDragLeave }
                    onDragOver={ handleDragOver }
                    onDrop={ handleDrop }
                    style={ {
                        position: 'relative',
                        outline: isDragging
                            ? '2px dashed #007cba'
                            : '2px dashed transparent',
                        borderRadius: '4px',
                        padding: '4px',
                        transition: 'outline-color 0.1s',
                    } }
                >
                    { isDragging && (
                        <div
                            style={ {
                                position: 'absolute',
                                inset: 0,
                                zIndex: 10,
                                background: 'rgba(0, 124, 186, 0.08)',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                            } }
                        >
                            <span
                                style={ {
                                    fontWeight: 600,
                                    color: '#007cba',
                                    fontSize: '14px',
                                } }
                            >
                                { __( 'Drop GPX files here' ) }
                            </span>
                        </div>
                    ) }

                    { /* Top action bar */ }
                    <div
                        style={ {
                            display: 'flex',
                            gap: '8px',
                            marginBottom: '16px',
                            alignItems: 'center',
                        } }
                    >
                        <Button
                            variant="primary"
                            icon={ upload }
                            onClick={ () => uploadInputRef.current?.click() }
                        >
                            { __( 'Upload' ) }
                        </Button>
                        <MediaUpload
                            allowedTypes={ [ 'text/xml' ] }
                            multiple
                            value={ gpx.map( ( t ) => t.id ) }
                            onSelect={ ( selection ) => {
                                setPage( 0 );
                                onAdd( selection );
                            } }
                            render={ ( { open } ) => (
                                <Button variant="secondary" onClick={ open }>
                                    { __( 'Media Library' ) }
                                </Button>
                            ) }
                        />
                        <input
                            ref={ uploadInputRef }
                            type="file"
                            accept=".gpx,.xml"
                            multiple
                            style={ { display: 'none' } }
                            onChange={ handleFileChange }
                        />
                        { gpx.length > 0 && (
                            <>
                                <Button
                                    icon={ brush }
                                    label={ __( 'Style all tracks' ) }
                                    onClick={ () => setStyleTarget( 'all' ) }
                                />
                                <Button
                                    icon={ trash }
                                    label={ __( 'Remove all tracks' ) }
                                    isDestructive
                                    onClick={ () => {
                                        onRemoveAll();
                                        onClose();
                                    } }
                                />
                            </>
                        ) }
                    </div>

                    { /* Track table */ }
                    { gpx.length > 0 && (
                        <>
                            <table
                                style={ {
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                } }
                            >
                                <tbody>
                                    { pageTracks.map( ( track, localIdx ) => {
                                        const globalIdx = pageStart + localIdx;
                                        return (
                                            <tr
                                                key={ track.id }
                                                style={ {
                                                    borderBottom:
                                                        '1px solid #ddd',
                                                } }
                                            >
                                                <td
                                                    style={ {
                                                        padding:
                                                            '6px 8px 6px 0',
                                                    } }
                                                >
                                                    <div
                                                        style={ {
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            gap: '4px',
                                                        } }
                                                    >
                                                        <Button
                                                            icon={ brush }
                                                            label={ __(
                                                                'Style this track'
                                                            ) }
                                                            onClick={ () =>
                                                                setStyleTarget(
                                                                    globalIdx
                                                                )
                                                            }
                                                        />
                                                        <span
                                                            style={ {
                                                                display:
                                                                    'block',
                                                                width: '16px',
                                                                height: '16px',
                                                                borderRadius:
                                                                    '50%',
                                                                background:
                                                                    track.color ||
                                                                    'gold',
                                                                flexShrink: 0,
                                                            } }
                                                        />
                                                    </div>
                                                </td>
                                                <td
                                                    style={ {
                                                        padding: '6px 4px',
                                                        width: '100%',
                                                    } }
                                                >
                                                    { track.name }
                                                </td>
                                                <td
                                                    style={ {
                                                        padding:
                                                            '6px 0 6px 8px',
                                                        width: '32px',
                                                        textAlign: 'right',
                                                    } }
                                                >
                                                    <Button
                                                        icon={ trash }
                                                        label={ __(
                                                            'Remove track'
                                                        ) }
                                                        isDestructive
                                                        onClick={ () =>
                                                            onRemoveOne(
                                                                globalIdx
                                                            )
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    } ) }
                                </tbody>
                            </table>
                            { totalPages > 1 && (
                                <div
                                    style={ {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginTop: '12px',
                                    } }
                                >
                                    <Button
                                        variant="secondary"
                                        disabled={ safePage === 0 }
                                        onClick={ () =>
                                            setPage( safePage - 1 )
                                        }
                                    >
                                        { __( '← Prev' ) }
                                    </Button>
                                    <span
                                        style={ {
                                            fontSize: '12px',
                                            color: '#757575',
                                        } }
                                    >
                                        { pageStart + 1 }–
                                        { Math.min(
                                            pageStart + GPX_PAGE_SIZE,
                                            gpx.length
                                        ) }{ ' ' }
                                        { __( 'of' ) } { gpx.length }
                                    </span>
                                    <Button
                                        variant="secondary"
                                        disabled={ safePage >= totalPages - 1 }
                                        onClick={ () =>
                                            setPage( safePage + 1 )
                                        }
                                    >
                                        { __( 'Next →' ) }
                                    </Button>
                                </div>
                            ) }
                        </>
                    ) }

                    { gpx.length === 0 && (
                        <p style={ { color: '#757575', margin: 0 } }>
                            { __(
                                'No GPX tracks selected. Use Library or Upload to add tracks.'
                            ) }
                        </p>
                    ) }
                </div>
            ) }
        </Modal>
    );
}

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

    // Points for the currently selected feeds only (null while loading)
    const selectedPoints =
        feedPointCounts === null
            ? null
            : attributes.feeds.reduce(
                  ( s, f ) => s + ( feedPointCounts.get( f ) || 0 ),
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

    // On first insert (when styles is empty, meaning never initialized), populate from admin-configured defaults.
    // We intentionally do NOT re-trigger when feeds is empty, so the user can choose to show no feeds.
    // Waits for feedPointCounts to load so we can decide whether to default to all feeds or none.
    useEffect( () => {
        // Wait until point counts are loaded before initialising defaults.
        if ( feedPointCounts === null ) {
            return;
        }
        if (
            ( Object.keys( attributes.styles ).length === 0 ||
                attributes.maps.length === 0 ) &&
            window.spotmapjsobj?.feeds
        ) {
            const feedNames = Array.isArray( window.spotmapjsobj.feeds )
                ? window.spotmapjsobj.feeds
                : Object.keys( window.spotmapjsobj.feeds );

            const dv = window.spotmapjsobj?.defaultValues ?? {};
            const adminColors = ( dv.color || '' )
                .split( ',' )
                .map( ( c ) => c.trim() )
                .filter( Boolean );
            const numColors = adminColors.length || 1;
            const defaultStyles = {};
            feedNames.forEach( ( name, i ) => {
                const color =
                    adminColors[ i % numColors ] || DEFAULT_FEED_STYLE.color;
                defaultStyles[ name ] = { ...DEFAULT_FEED_STYLE, color };
            } );
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

            // If the DB already holds more than 10 000 points, default to no feeds
            // so the editor doesn't immediately try to render a huge dataset.
            const defaultFeeds = totalPoints > 10000 ? [] : feedNames;

            setAttributes( {
                feeds: defaultFeeds,
                styles: defaultStyles,
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
        if ( selectedPoints === null || selectedPoints > 10000 ) {
            return;
        }

        const options = {
            ...attributes,
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
        attributes.styles,
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
                attributes.scrollWheelZoom ?? false
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
        const newStyles = { ...attributes.styles };
        newStyles[ feed ] = { ...( newStyles[ feed ] || {} ), [ key ]: value };
        setAttributes( { styles: newStyles } );
    };

    const toggleFeed = ( feed, checked ) => {
        const next = checked
            ? [ ...attributes.feeds, feed ]
            : attributes.feeds.filter( ( f ) => f !== feed );
        const newStyles = { ...attributes.styles };
        if ( checked && ! newStyles[ feed ] ) {
            newStyles[ feed ] = { ...DEFAULT_FEED_STYLE };
        }
        setAttributes( { feeds: next, styles: newStyles } );
    };

    const mergeGpxTracks = ( newTracks, getTitle ) => {
        const existing = attributes.gpx;
        const existingIds = new Set( existing.map( ( t ) => t.id ) );
        const merged = [
            ...existing,
            ...newTracks
                .filter( ( t ) => t.id && ! existingIds.has( t.id ) )
                .map( ( t ) => ( {
                    id: t.id,
                    url: t.url,
                    name: getTitle( t ),
                    color: existing[ 0 ]?.color || 'gold',
                } ) ),
        ];
        setAttributes( { gpx: merged } );
    };

    return (
        <>
            { gpxManagerOpen && (
                <GpxManagerModal
                    gpx={ attributes.gpx }
                    onAdd={ ( selection ) =>
                        mergeGpxTracks( selection, ( t ) => t.title )
                    }
                    onUpload={ ( uploaded ) =>
                        mergeGpxTracks(
                            uploaded,
                            ( t ) =>
                                t.title ||
                                t.filename ||
                                t.slug ||
                                String( t.id )
                        )
                    }
                    onRemoveAll={ () => setAttributes( { gpx: [] } ) }
                    onRemoveOne={ ( i ) => {
                        const next = attributes.gpx.filter(
                            ( _, idx ) => idx !== i
                        );
                        setAttributes( { gpx: next } );
                    } }
                    setAttributes={ setAttributes }
                    onClose={ () => setGpxManagerOpen( false ) }
                />
            ) }
            { feedStyleModal && (
                <FeedStyleModal
                    feed={ feedStyleModal }
                    style={ attributes.styles?.[ feedStyleModal ] }
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
                                                const newStyles = {
                                                    ...attributes.styles,
                                                };
                                                availableFeeds.forEach(
                                                    ( feed ) => {
                                                        if (
                                                            ! newStyles[ feed ]
                                                        ) {
                                                            newStyles[ feed ] =
                                                                {
                                                                    ...DEFAULT_FEED_STYLE,
                                                                };
                                                        }
                                                    }
                                                );
                                                setAttributes( {
                                                    feeds: [
                                                        ...availableFeeds,
                                                    ],
                                                    styles: newStyles,
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
                                { availableFeeds.map( ( feed ) => (
                                    <Flex key={ feed } gap={ 2 } align="center">
                                        <FlexItem isBlock>
                                            <CheckboxControl
                                                __nextHasNoMarginBottom
                                                label={ feed }
                                                checked={ attributes.feeds.includes(
                                                    feed
                                                ) }
                                                onChange={ ( checked ) =>
                                                    toggleFeed( feed, checked )
                                                }
                                            />
                                        </FlexItem>
                                        <Button
                                            icon={ brush }
                                            label={ __( 'Style' ) + ' ' + feed }
                                            size="small"
                                            variant="tertiary"
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
                                                    attributes.styles?.[ feed ]
                                                        ?.color || 'blue',
                                                flexShrink: 0,
                                            } }
                                        />
                                    </Flex>
                                ) ) }
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
                                    __nextHasNoMarginBottom
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
                                    __nextHasNoMarginBottom
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
                                    __nextHasNoMarginBottom
                                    label={ __( 'Enable panning' ) }
                                    checked={ attributes.enablePanning }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            enablePanning: value,
                                        } )
                                    }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
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
                                    __nextHasNoMarginBottom
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
                                    __nextHasNoMarginBottom
                                    label={ __( 'Location button' ) }
                                    checked={ attributes.locateButton }
                                    onChange={ ( value ) =>
                                        setAttributes( {
                                            locateButton: value,
                                        } )
                                    }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
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
                    __nextHasNoMarginBottom
                    label={ __( 'Debug' ) }
                    checked={ attributes.debug }
                    onChange={ ( value ) => setAttributes( { debug: value } ) }
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
                { selectedPoints !== null && selectedPoints > 10000 ? (
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
                            { __( 'points (limit: 10,000).' ) }
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
