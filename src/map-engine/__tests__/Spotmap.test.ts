import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
} from '@jest/globals';
import { BoundsManager } from '../BoundsManager';
import type { SpotmapOptions } from '../types';

// ---------------------------------------------------------------------------
// leaflet-easybutton adds itself as a side effect to the L global at import
// time — mock it so ButtonManager can be imported without errors.
// ---------------------------------------------------------------------------
jest.mock( 'leaflet-easybutton', () => ( {} ) );

const mockFullScreenAddTo = jest.fn();
const MockFullScreen = jest.fn().mockImplementation( () => ( {
    addTo: mockFullScreenAddTo,
} ) );
jest.mock( 'leaflet.fullscreen', () => ( {
    FullScreen: MockFullScreen,
    default: MockFullScreen,
} ) );

// ---------------------------------------------------------------------------
// Minimal Leaflet mock
// ---------------------------------------------------------------------------

type EventHandler = ( e?: unknown ) => void;

/** Creates a simple event emitter that also captures .on() calls. */
function createEventEmitter() {
    const listeners: Record< string, EventHandler[] > = {};
    return {
        on( event: string, handler: EventHandler ) {
            ( listeners[ event ] ??= [] ).push( handler );
            return this;
        },
        _fire( event: string, e?: unknown ) {
            listeners[ event ]?.forEach( ( h ) => h( e ) );
        },
    };
}

function invalidBounds() {
    return {
        isValid: () => false,
        extend: jest.fn().mockReturnThis(),
        toBBoxString: () => '0,0,0,0',
    };
}

let capturedGpxEmitter: ReturnType< typeof createEventEmitter > | null;

function buildLeafletMock() {
    capturedGpxEmitter = null;

    const mockPane = Object.assign( document.createElement( 'div' ), {
        style: { zIndex: '' },
    } );

    const mockMap = {
        scrollWheelZoom: { enable: jest.fn(), disable: jest.fn() },
        once: jest.fn(),
        fitBounds: jest.fn(),
        setView: jest.fn(),
        hasLayer: jest.fn().mockReturnValue( true ),
        getContainer: jest
            .fn()
            .mockReturnValue( document.createElement( 'div' ) ),
        invalidateSize: jest.fn(),
        removeLayer: jest.fn(),
        attributionControl: { setPrefix: jest.fn() },
        createPane: jest.fn(),
        getPane: jest.fn().mockReturnValue( mockPane ),
    };

    const mockLayerControl = {
        addBaseLayer: jest.fn().mockReturnThis(),
        addOverlay: jest.fn().mockReturnThis(),
        removeLayer: jest.fn().mockReturnThis(),
        addTo: jest.fn().mockReturnThis(),
    };

    const mockFeatureGroup = {
        addLayer: jest.fn().mockReturnThis(),
        addTo: jest.fn().mockReturnThis(),
        getBounds: jest.fn().mockReturnValue( invalidBounds() ),
    };

    return {
        mockMap,
        L: {
            map: jest.fn().mockReturnValue( mockMap ),
            control: {
                layers: jest.fn().mockReturnValue( mockLayerControl ),
                scale: jest.fn().mockReturnValue( { addTo: jest.fn() } ),
            },
            Control: {},
            tileLayer: Object.assign(
                jest
                    .fn()
                    .mockReturnValue( { addTo: jest.fn().mockReturnThis() } ),
                {
                    wms: jest.fn().mockReturnValue( {
                        addTo: jest.fn().mockReturnThis(),
                    } ),
                }
            ),
            featureGroup: jest.fn().mockReturnValue( mockFeatureGroup ),
            latLngBounds: jest.fn().mockImplementation( () => invalidBounds() ),
            GPX: jest.fn().mockImplementation( () => {
                const emitter = createEventEmitter();
                capturedGpxEmitter = emitter;
                return Object.assign( emitter, {
                    addTo: jest.fn().mockReturnThis(),
                    get_distance: jest.fn().mockReturnValue( 0 ),
                    get_moving_time: jest.fn().mockReturnValue( 0 ),
                    get_total_time: jest.fn().mockReturnValue( 0 ),
                    get_elevation_gain: jest.fn().mockReturnValue( 0 ),
                    get_elevation_loss: jest.fn().mockReturnValue( 0 ),
                    get_elevation_max: jest.fn().mockReturnValue( 0 ),
                    get_elevation_min: jest.fn().mockReturnValue( 0 ),
                    get_moving_speed: jest.fn().mockReturnValue( 0 ),
                    get_duration_string: jest.fn().mockReturnValue( '' ),
                    m_to_km: jest.fn().mockReturnValue( 0 ),
                } );
            } ),
            BeautifyIcon: {
                icon: jest.fn().mockReturnValue( {} ),
            },
            easyBar: jest
                .fn()
                .mockReturnValue( { addTo: jest.fn().mockReturnThis() } ),
            easyButton: jest
                .fn()
                .mockReturnValue( { addTo: jest.fn().mockReturnThis() } ),
            polyline: jest
                .fn()
                .mockReturnValue( { addTo: jest.fn().mockReturnThis() } ),
            canvas: jest.fn().mockReturnValue( {} ),
            svg: jest.fn().mockReturnValue( {} ),
        },
    };
}

function buildSpotmapjsobj() {
    return {
        ajaxUrl: 'http://localhost/wp-admin/admin-ajax.php',
        maps: {
            openstreetmap: {
                label: 'OpenStreetMap',
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                options: {},
                wms: false,
            },
        },
        overlays: {},
        url: 'http://localhost/wp-content/plugins/spotmap/public/',
        feeds: [ 'timo' ],
        defaultValues: { color: 'blue', splitlines: '12' },
        marker: {},
    };
}

function mockFetch( data: unknown ) {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: jest.fn().mockResolvedValue( data ),
    } ) as unknown as typeof fetch;
}

function makeOptions(
    overrides: Partial< SpotmapOptions > = {}
): SpotmapOptions {
    const el = document.createElement( 'div' );
    document.body.appendChild( el );
    return {
        mapElement: el,
        maps: [ 'openstreetmap' ],
        feeds: [ 'timo' ],
        gpx: [],
        styles: {},
        height: 500,
        mapcenter: 'all',
        filterPoints: 0,
        autoReload: false,
        debug: false,
        dateRange: { from: null, to: null },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach( () => {
    const { L } = buildLeafletMock();
    ( global as Record< string, unknown > ).L = L;
    ( global as Record< string, unknown > ).spotmapjsobj = buildSpotmapjsobj();
    MockFullScreen.mockClear();
    mockFullScreenAddTo.mockClear();
} );

afterEach( () => {
    delete ( global as Record< string, unknown > ).L;
    delete ( global as Record< string, unknown > ).spotmapjsobj;
    jest.restoreAllMocks();
} );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe( 'Spotmap.initMap — error response handling', () => {
    it( 'resolves without throwing when AJAX returns an error response (regression: TypeError t is not iterable)', async () => {
        mockFetch( {
            error: true,
            title: 'timo not found in DB',
            message: "Change the 'devices' attribute of your Shortcode",
        } );
        const { Spotmap } = await import( '../Spotmap' );
        const s = new Spotmap( makeOptions() );
        await expect( s.initMap() ).resolves.toBeUndefined();
    } );

    it( 'calls fitBounds after GPX loaded event when feed returns an error (regression: no map tiles shown)', async () => {
        mockFetch( {
            error: true,
            title: 'timo not found in DB',
            message: "Change the 'devices' attribute of your Shortcode",
        } );

        const fitBoundsSpy = jest.spyOn( BoundsManager.prototype, 'fitBounds' );

        const { Spotmap } = await import( '../Spotmap' );
        const s = new Spotmap(
            makeOptions( {
                gpx: [
                    {
                        url: 'http://example.com/track.gpx',
                        name: 'My Track',
                        visible: true,
                    },
                ],
            } )
        );

        await s.initMap();

        // Before GPX loads: fitBounds was called once during initMap but
        // found no valid bounds (no points, GPX not yet loaded).
        const callsBeforeGpxLoad = fitBoundsSpy.mock.calls.length;

        // Simulate the GPX 'loaded' event firing asynchronously.
        expect( capturedGpxEmitter ).not.toBeNull();
        capturedGpxEmitter!._fire( 'loaded' );

        // fitBounds must have been called again after GPX loaded.
        expect( fitBoundsSpy.mock.calls.length ).toBeGreaterThan(
            callsBeforeGpxLoad
        );
        expect( fitBoundsSpy ).toHaveBeenCalledWith( 'all' );
    } );
} );

describe( 'Spotmap.initMap — fullscreen button', () => {
    beforeEach( () => {
        mockFetch( { error: true, title: 'no feed', message: '' } );
    } );

    it( 'adds the fullscreen control by default', async () => {
        const { Spotmap } = await import( '../Spotmap' );
        const s = new Spotmap( makeOptions() );
        await s.initMap();
        expect( MockFullScreen ).toHaveBeenCalledTimes( 1 );
        expect( mockFullScreenAddTo ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'adds the fullscreen control when fullscreenButton is true', async () => {
        const { Spotmap } = await import( '../Spotmap' );
        const s = new Spotmap( makeOptions( { fullscreenButton: true } ) );
        await s.initMap();
        expect( MockFullScreen ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'omits the fullscreen control when fullscreenButton is false', async () => {
        const { Spotmap } = await import( '../Spotmap' );
        const s = new Spotmap( makeOptions( { fullscreenButton: false } ) );
        await s.initMap();
        expect( MockFullScreen ).not.toHaveBeenCalled();
    } );
} );
