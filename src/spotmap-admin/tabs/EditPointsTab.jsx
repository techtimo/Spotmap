import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import {
    Button,
    CheckboxControl,
    Dropdown,
    Flex,
    FlexItem,
    Notice,
    Toolbar,
    ToolbarButton,
    ToolbarGroup,
} from '@wordpress/components';
import { undo } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import MapsToolbarGroup from '../../spotmap/components/MapsToolbarGroup';
import TimeToolbarGroup from '../../spotmap/components/TimeToolbarGroup';
import * as api from '../api';

const ALL_FEEDS = ( window.spotmapAdminData.feeds ?? [] ).filter( Boolean );

const DEFAULT_FEED_STYLE = {
    color: 'blue',
    splitLines: 0,
    lineWidth: 2,
    lineOpacity: 1.0,
    visible: true,
};

function getDefaultMaps() {
    const dv = window.spotmapjsobj?.defaultValues?.maps;
    if ( dv ) {
        return dv
            .split( ',' )
            .map( ( m ) => m.trim() )
            .filter( Boolean );
    }
    return Object.keys( window.spotmapjsobj?.maps ?? {} ).slice( 0, 1 );
}

export default function EditPointsTab( { onNoticeChange } ) {
    const [ feeds, setFeeds ] = useState( ALL_FEEDS.slice( 0, 1 ) );
    const [ styles, setStyles ] = useState( () => {
        const s = {};
        ALL_FEEDS.slice( 0, 1 ).forEach( ( f ) => {
            s[ f ] = { ...DEFAULT_FEED_STYLE };
        } );
        return s;
    } );
    const [ maps, setMaps ] = useState( getDefaultMaps );
    const [ mapOverlays, setMapOverlays ] = useState( [] );
    const [ dateRange, setDateRange ] = useState( { from: '', to: '' } );

    const [ loading, setLoading ] = useState( false );
    const [ pointCount, setPointCount ] = useState( null );
    const [ undoCount, setUndoCount ] = useState( 0 );

    const mapContainerRef = useRef( null );
    const spotmapRef = useRef( null );
    // Stack of { pointId, marker, prevLat, prevLng } — stored in a ref so
    // dragend closures always see the current stack without stale captures.
    const undoStackRef = useRef( [] );

    // Destroy map instance on tab unmount.
    useEffect( () => {
        return () => {
            spotmapRef.current?.destroy();
            spotmapRef.current = null;
        };
    }, [] );

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

    const handleUndo = useCallback( async () => {
        const stack = undoStackRef.current;
        if ( stack.length === 0 ) {
            return;
        }
        const last = stack[ stack.length - 1 ];
        try {
            await api.updatePoint( last.pointId, {
                latitude: last.prevLat,
                longitude: last.prevLng,
            } );
            last.marker.setLatLng( [ last.prevLat, last.prevLng ] );
            undoStackRef.current = stack.slice( 0, -1 );
            setUndoCount( undoStackRef.current.length );
            onNoticeChange( {
                status: 'success',
                text: `Undid move of point #${ last.pointId }.`,
            } );
        } catch ( err ) {
            onNoticeChange( {
                status: 'error',
                text: `Failed to undo: ${ err.message }`,
            } );
        }
    }, [ onNoticeChange ] );

    const handleLoad = useCallback( async () => {
        if ( feeds.length === 0 ) {
            return;
        }
        if ( typeof window.Spotmap === 'undefined' ) {
            onNoticeChange( {
                status: 'error',
                text: 'Map engine not loaded. Try refreshing the page.',
            } );
            return;
        }

        if ( spotmapRef.current ) {
            spotmapRef.current.destroy();
            // Clear the cached options so initMap() doesn't skip re-initialization.
            if ( mapContainerRef.current ) {
                delete mapContainerRef.current._spotmapOptions;
            }
            spotmapRef.current = null;
        }

        setLoading( true );
        onNoticeChange( null );
        setPointCount( null );
        undoStackRef.current = [];
        setUndoCount( 0 );

        const options = {
            feeds,
            styles,
            maps,
            mapOverlays,
            mapElement: mapContainerRef.current,
            enablePanning: true,
            scrollWheelZoom: true,
            autoReload: false,
            debug: false,
            mapcenter: 'all',
            filterPoints: 0,
            gpx: [],
            dateRange,
            fullscreenButton: false,
            locateButton: false,
        };

        try {
            const sm = new window.Spotmap( options );
            spotmapRef.current = sm;
            await sm.initMap();

            setTimeout( () => sm.map?.invalidateSize?.(), 150 );

            // Make every marker draggable and wire the save handler.
            let total = 0;
            for ( const feedLayer of Object.values( sm.layers.feeds ) ) {
                feedLayer.markers.forEach( ( marker, i ) => {
                    const point = feedLayer.points[ i ];
                    if ( ! point ) {
                        return;
                    }
                    total++;

                    const wireDragging = ( m ) => {
                        m.dragging.enable();
                        // Leaflet suppresses popup-on-click after a drag; wire
                        // it explicitly so it always works.
                        m.on( 'click', () => {
                            if ( m.getPopup() ) {
                                m.openPopup();
                            }
                        } );
                        let prevLatLng = m.getLatLng();
                        m.on( 'dragstart', ( e ) => {
                            prevLatLng = e.target.getLatLng();
                            if ( m._icon ) {
                                m._icon.style.cursor = 'grabbing';
                            }
                        } );
                        m.on( 'dragend', async ( e ) => {
                            // Re-enable both after dragend — Leaflet's
                            // MarkerDrag and our own disable() can leave these
                            // in an inconsistent state.
                            sm.map.dragging.enable();
                            m.dragging.enable();
                            if ( m._icon ) {
                                m._icon.style.cursor = 'pointer';
                            }
                            const { lat, lng } = e.target.getLatLng();
                            const prev = prevLatLng;
                            try {
                                await api.updatePoint( point.id, {
                                    latitude: lat,
                                    longitude: lng,
                                } );
                                onNoticeChange( {
                                    status: 'success',
                                    text:
                                        'Point #' +
                                        point.id +
                                        ' saved at ' +
                                        lat.toFixed( 5 ) +
                                        ', ' +
                                        lng.toFixed( 5 ) +
                                        '.',
                                } );
                                undoStackRef.current = [
                                    ...undoStackRef.current,
                                    {
                                        pointId: point.id,
                                        marker: m,
                                        prevLat: prev.lat,
                                        prevLng: prev.lng,
                                    },
                                ];
                                setUndoCount( undoStackRef.current.length );
                            } catch ( err ) {
                                onNoticeChange( {
                                    status: 'error',
                                    text: `Failed to save point #${ point.id }: ${ err.message }`,
                                } );
                                e.target.setLatLng( [ prev.lat, prev.lng ] );
                            }
                        } );
                    };

                    // L.CircleMarker has no dragging support.
                    // On mousedown we wait to see if the user actually moves the
                    // mouse (drag) or just clicks (popup).  The swap only happens
                    // on the first mousemove so the drag starts seamlessly.
                    if ( ! marker.dragging ) {
                        marker.on( 'mousedown', ( e ) => {
                            window.L.DomEvent.stopPropagation( e );
                            const nativeEvent = e.originalEvent;
                            let swapped = false;

                            // Disable map panning immediately so that any
                            // mousemoves before/during the swap don't pan the
                            // map. Always restored on mouseup.
                            sm.map.dragging.disable();

                            const doSwap = () => {
                                swapped = true;
                                document.removeEventListener(
                                    'mousemove',
                                    onMove // eslint-disable-line no-use-before-define
                                );
                                const color = marker.options.color ?? 'blue';
                                const replacement = window.L.marker(
                                    marker.getLatLng(),
                                    {
                                        icon: window.L.divIcon( {
                                            className: '',
                                            html: `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;"><div style="width:10px;height:10px;border-radius:50%;background:white;border:2px solid ${ color };box-sizing:border-box;flex-shrink:0;"></div></div>`,
                                            iconSize: [ 20, 20 ],
                                            iconAnchor: [ 10, 10 ],
                                        } ),
                                    }
                                );
                                const popup = marker.getPopup();
                                if ( popup ) {
                                    replacement.bindPopup( popup.getContent() );
                                }
                                feedLayer.featureGroup.removeLayer( marker );
                                feedLayer.featureGroup.addLayer( replacement );
                                feedLayer.markers[ i ] = replacement;
                                wireDragging( replacement );
                                // Re-fire the original mousedown on the new
                                // icon so Leaflet's drag handler starts.
                                if ( replacement._icon && nativeEvent ) {
                                    replacement._icon.dispatchEvent(
                                        new MouseEvent( 'mousedown', {
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: nativeEvent.clientX,
                                            clientY: nativeEvent.clientY,
                                            button: nativeEvent.button,
                                        } )
                                    );
                                }
                            };

                            const onMove = () => {
                                if ( ! swapped ) {
                                    doSwap();
                                }
                            };
                            // Always restore map dragging on mouseup, whether
                            // it was a click or a drag.
                            const onUp = () => {
                                document.removeEventListener(
                                    'mousemove',
                                    onMove
                                );
                                sm.map.dragging.enable();
                                if ( ! swapped ) {
                                    // Pure click — open popup.
                                    marker.openPopup();
                                }
                            };

                            document.addEventListener( 'mousemove', onMove );
                            document.addEventListener( 'mouseup', onUp, {
                                once: true,
                            } );
                        } );
                        return;
                    }

                    wireDragging( marker );
                } );
            }

            setPointCount( total );
            if ( total === 0 ) {
                onNoticeChange( {
                    status: 'warning',
                    text: 'No points found for this selection.',
                } );
            }
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        } finally {
            setLoading( false );
        }
    }, [ feeds, styles, maps, mapOverlays, dateRange, onNoticeChange ] );

    if ( ALL_FEEDS.length === 0 ) {
        return (
            <div style={ { marginTop: '1rem' } }>
                <Notice status="warning" isDismissible={ false }>
                    No feeds configured yet. Add a feed in the Feeds tab first.
                </Notice>
            </div>
        );
    }

    return (
        <div
            style={ {
                marginTop: '1rem',
                height: 'calc(100vh - 240px)',
                display: 'flex',
                flexDirection: 'column',
            } }
        >
            <div
                style={ {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: 'fit-content',
                } }
            >
                <Toolbar label={ __( 'Edit points controls' ) }>
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
                            renderContent={ () => (
                                <div
                                    style={ {
                                        padding: '8px',
                                        minWidth: '200px',
                                    } }
                                >
                                    { ALL_FEEDS.map( ( feed ) => (
                                        <Flex
                                            key={ feed }
                                            gap={ 2 }
                                            align="center"
                                            style={ { marginBottom: '4px' } }
                                        >
                                            <FlexItem isBlock>
                                                <CheckboxControl
                                                    __nextHasNoMarginBottom
                                                    label={ feed }
                                                    checked={ feeds.includes(
                                                        feed
                                                    ) }
                                                    onChange={ ( checked ) =>
                                                        toggleFeed(
                                                            feed,
                                                            checked
                                                        )
                                                    }
                                                />
                                            </FlexItem>
                                            <span
                                                style={ {
                                                    display: 'block',
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    background:
                                                        styles?.[ feed ]
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

                    { /* Maps + overlays */ }
                    <MapsToolbarGroup
                        maps={ maps }
                        mapOverlays={ mapOverlays }
                        onChangeMaps={ setMaps }
                        onChangeOverlays={ setMapOverlays }
                    />

                    { /* Time filter */ }
                    <TimeToolbarGroup
                        dateRange={ dateRange }
                        onChangeDateRange={ setDateRange }
                    />
                </Toolbar>
                <Button
                    variant="primary"
                    onClick={ handleLoad }
                    isBusy={ loading }
                    disabled={ feeds.length === 0 || loading }
                >
                    { __( 'Load Points' ) }
                </Button>
                { undoCount > 0 && (
                    <Button icon={ undo } onClick={ handleUndo }>
                        { __( 'Undo' ) }
                    </Button>
                ) }
            </div>

            { pointCount !== null && ! loading && (
                <p
                    style={ {
                        margin: '8px 0',
                        color: '#666',
                        fontSize: '13px',
                    } }
                >
                    { `${ pointCount } point${
                        pointCount !== 1 ? 's' : ''
                    } loaded - drag any marker to correct its position. Changes save immediately.` }
                </p>
            ) }
            { pointCount === null && ! loading && (
                <p
                    style={ {
                        margin: '8px 0',
                        color: '#666',
                        fontSize: '13px',
                    } }
                >
                    Select feeds, map layers and time range, then click Load
                    Points.
                </p>
            ) }

            <div
                ref={ mapContainerRef }
                style={ {
                    flex: 1,
                    minHeight: 0,
                    border: '1px solid #c3c4c7',
                    borderRadius: '4px',
                } }
            />
        </div>
    );
}
