import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { useSelect } from '@wordpress/data';
import { useEntityProp } from '@wordpress/core-data';
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from '@wordpress/element';

const LS_KEY = 'spotmap_post_location_last_center';

function getLastCenter() {
    try {
        const stored = localStorage.getItem( LS_KEY );
        if ( stored ) {
            return JSON.parse( stored );
        }
    } catch ( e ) {}
    return { lat: 46.8, lng: 8.2, zoom: 5 };
}

function saveLastCenter( lat, lng, zoom ) {
    try {
        localStorage.setItem( LS_KEY, JSON.stringify( { lat, lng, zoom } ) );
    } catch ( e ) {}
}

const PostLocationMap = forwardRef( function PostLocationMap(
    { lat, lng, onChange },
    ref
) {
    const containerRef = useRef( null );
    const mapRef = useRef( null );
    const markerRef = useRef( null );

    useImperativeHandle( ref, () => ( {
        setView( viewLat, viewLng, zoom ) {
            if ( mapRef.current ) {
                mapRef.current.setView( [ viewLat, viewLng ], zoom );
            }
        },
    } ) );

    useEffect( () => {
        const el = containerRef.current;
        if ( ! el ) {
            return;
        }

        const L = window.L;
        if ( ! L ) {
            return;
        }

        const center = getLastCenter();
        const map = L.map( el ).setView(
            [ center.lat, center.lng ],
            center.zoom
        );
        mapRef.current = map;

        L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        } ).addTo( map );

        if ( lat && lng ) {
            const marker = L.marker( [ lat, lng ], { draggable: true } ).addTo(
                map
            );
            marker.on( 'dragend', () => {
                const pos = marker.getLatLng();
                saveLastCenter( pos.lat, pos.lng, map.getZoom() );
                onChange( pos.lat, pos.lng );
            } );
            markerRef.current = marker;
            map.setView( [ lat, lng ], center.zoom );
        }

        map.on( 'click', ( e ) => {
            const { lat: clickLat, lng: clickLng } = e.latlng;
            saveLastCenter( clickLat, clickLng, map.getZoom() );

            if ( markerRef.current ) {
                markerRef.current.setLatLng( [ clickLat, clickLng ] );
            } else {
                const marker = L.marker( [ clickLat, clickLng ], {
                    draggable: true,
                } ).addTo( map );
                marker.on( 'dragend', () => {
                    const pos = marker.getLatLng();
                    saveLastCenter( pos.lat, pos.lng, map.getZoom() );
                    onChange( pos.lat, pos.lng );
                } );
                markerRef.current = marker;
            }
            onChange( clickLat, clickLng );
        } );

        map.on( 'moveend', () => {
            const c = map.getCenter();
            saveLastCenter( c.lat, c.lng, map.getZoom() );
        } );

        const ro = new ResizeObserver( () => {
            map.invalidateSize();
        } );
        ro.observe( el );

        return () => {
            ro.disconnect();
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [] );

    // Sync marker when lat/lng cleared externally.
    useEffect( () => {
        const map = mapRef.current;
        const L = window.L;
        if ( ! map || ! L ) {
            return;
        }

        if ( ! lat || ! lng ) {
            if ( markerRef.current ) {
                markerRef.current.remove();
                markerRef.current = null;
            }
        } else if ( markerRef.current ) {
            markerRef.current.setLatLng( [ lat, lng ] );
        } else {
            const marker = L.marker( [ lat, lng ], { draggable: true } ).addTo(
                map
            );
            marker.on( 'dragend', () => {
                const pos = marker.getLatLng();
                saveLastCenter( pos.lat, pos.lng, map.getZoom() );
                onChange( pos.lat, pos.lng );
            } );
            markerRef.current = marker;
        }
    }, [ lat, lng ] ); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            ref={ containerRef }
            style={ {
                height: '240px',
                width: '100%',
                marginBottom: '8px',
            } }
        />
    );
} );

function PostLocationPanel() {
    const postsFeedNames = window.spotmapjsobj?.postsFeedNames ?? [];

    const postType = useSelect(
        ( select ) => select( 'core/editor' ).getCurrentPostType(),
        []
    );

    const [ meta, setMeta ] = useEntityProp(
        'postType',
        postType ?? 'post',
        'meta'
    );

    const [ locating, setLocating ] = useState( false );
    const [ locateError, setLocateError ] = useState( null );
    const mapComponentRef = useRef( null );

    if ( postsFeedNames.length === 0 ) {
        return null;
    }

    if ( ! [ 'post', 'page' ].includes( postType ) ) {
        return null;
    }

    const rawLat = meta?._spotmap_latitude;
    const rawLng = meta?._spotmap_longitude;
    const lat = rawLat ? parseFloat( rawLat ) : null;
    const lng = rawLng ? parseFloat( rawLng ) : null;
    const hasLocation =
        lat !== null && lng !== null && ! isNaN( lat ) && ! isNaN( lng );

    const handleChange = ( newLat, newLng ) => {
        setMeta( {
            ...meta,
            _spotmap_latitude: String( newLat ),
            _spotmap_longitude: String( newLng ),
        } );
    };

    const handleClear = () => {
        setMeta( {
            ...meta,
            _spotmap_latitude: '',
            _spotmap_longitude: '',
        } );
    };

    const handleLocate = () => {
        if ( ! navigator.geolocation ) {
            setLocateError( 'Geolocation is not supported by your browser.' );
            return;
        }
        setLocating( true );
        setLocateError( null );
        navigator.geolocation.getCurrentPosition(
            ( pos ) => {
                const { latitude, longitude } = pos.coords;
                setLocating( false );
                handleChange( latitude, longitude );
                if ( mapComponentRef.current ) {
                    mapComponentRef.current.setView( latitude, longitude, 15 );
                    saveLastCenter( latitude, longitude, 15 );
                }
            },
            ( err ) => {
                setLocating( false );
                setLocateError( err.message );
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <PluginDocumentSettingPanel
            name="spotmap-post-location"
            title="Post Location"
            icon="location-alt"
        >
            <PostLocationMap
                ref={ mapComponentRef }
                lat={ lat }
                lng={ lng }
                onChange={ handleChange }
            />
            { locateError && (
                <p
                    style={ {
                        margin: '0 0 6px',
                        fontSize: '12px',
                        color: '#cc1818',
                    } }
                >
                    { locateError }
                </p>
            ) }
            <p
                style={ {
                    margin: '0 0 8px',
                    fontSize: '12px',
                    color: '#757575',
                } }
            >
                { hasLocation
                    ? `${ lat.toFixed( 6 ) }, ${ lng.toFixed( 6 ) }`
                    : 'Click on the map to set a location for this post.' }
            </p>
            <div style={ { display: 'flex', gap: '8px' } }>
                <button
                    onClick={ handleLocate }
                    disabled={ locating }
                    className="components-button is-secondary is-small"
                    style={ { flex: 1 } }
                >
                    { locating ? 'Locating…' : 'Use current location' }
                </button>
                { hasLocation && (
                    <button
                        onClick={ handleClear }
                        className="components-button is-secondary is-destructive is-small"
                        style={ { flex: 1 } }
                    >
                        Clear location
                    </button>
                ) }
            </div>
        </PluginDocumentSettingPanel>
    );
}

registerPlugin( 'spotmap-post-location', { render: PostLocationPanel } );
