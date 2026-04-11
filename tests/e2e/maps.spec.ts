import { test, expect } from '@playwright/test';

/**
 * Geographic center coordinates used to trigger tile loading for each map.
 * Maps with regional coverage need coordinates inside their coverage area,
 * otherwise the tile request is still made but may 404. Using the right
 * center avoids ambiguity between "auth failed" and "tile doesn't exist here".
 */
const MAP_VIEW: Record< string, { lat: number; lng: number; zoom: number } > = {
    'uk-os-outdoor': { lat: 51.5074, lng: -0.1278, zoom: 8 }, // London
    'uk-os-road': { lat: 51.5074, lng: -0.1278, zoom: 8 },
    'uk-os-light': { lat: 51.5074, lng: -0.1278, zoom: 8 },
    'usgs-topo': { lat: 38.9072, lng: -77.0369, zoom: 8 }, // Washington DC
    'usgs-topo-sat': { lat: 38.9072, lng: -77.0369, zoom: 8 },
    'usgs-sat': { lat: 38.9072, lng: -77.0369, zoom: 8 },
    'newzealand-topo50': { lat: -36.8485, lng: 174.7633, zoom: 8 }, // Auckland
    'newzealand-topo250': { lat: -36.8485, lng: 174.7633, zoom: 8 },
    'spain-ign-topo': { lat: 40.4168, lng: -3.7038, zoom: 8 }, // Madrid
};

const DEFAULT_VIEW = { lat: 48.8566, lng: 2.3522, zoom: 5 }; // Paris

/**
 * HTTP status codes that indicate the token or URL is invalid.
 * 404 is accepted — tile may not exist at these coordinates, but auth worked.
 */
const AUTH_ERROR_STATUSES = [ 400, 401, 403 ];

test.describe( 'Tile layer URL validation', () => {
    test.beforeEach( async ( { page } ) => {
        await page.goto( '/?p=1' );
        await page.waitForFunction(
            () =>
                typeof ( window as any ).L !== 'undefined' &&
                typeof ( window as any ).spotmapjsobj !== 'undefined' &&
                typeof ( window as any ).Spotmap !== 'undefined'
        );
    } );

    test( 'every base layer tile URL is reachable and authenticates', async ( {
        page,
        request,
    } ) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const maps: Record< string, any > = await page.evaluate(
            () => ( window as any ).spotmapjsobj.maps
        );

        for ( const [ mapKey, mapConfig ] of Object.entries( maps ) ) {
            await test.step( `${ mapKey } — ${ mapConfig.label }`, async () => {
                const view = MAP_VIEW[ mapKey ] ?? DEFAULT_VIEW;

                /**
                 * Create a real Leaflet map in the browser, add the tile layer,
                 * and capture the first tile URL by patching Image.prototype.src.
                 * Leaflet always creates <img> elements (for both TileLayer and
                 * TileLayer.WMS), so this works for all layer types.
                 */
                const { url, setupError } = await page.evaluate(
                    async ( args: {
                        key: string;
                        config: any;
                        view: { lat: number; lng: number; zoom: number };
                    } ) => {
                        const L = ( window as any ).L;
                        const capturedUrls: string[] = [];

                        // Patch Image.src to intercept every tile URL Leaflet creates
                        const origDescriptor = Object.getOwnPropertyDescriptor(
                            HTMLImageElement.prototype,
                            'src'
                        )!;
                        Object.defineProperty(
                            HTMLImageElement.prototype,
                            'src',
                            {
                                set( val: string ) {
                                    if (
                                        typeof val === 'string' &&
                                        val.startsWith( 'http' )
                                    ) {
                                        capturedUrls.push( val );
                                    }
                                    origDescriptor.set!.call( this, val );
                                },
                                get() {
                                    return origDescriptor.get!.call( this );
                                },
                                configurable: true,
                            }
                        );

                        const el = document.createElement( 'div' );
                        el.id = `tile-test-${ args.key }`;
                        el.style.cssText =
                            'width:512px;height:512px;position:fixed;left:0;top:0;z-index:9999;';
                        document.body.appendChild( el );

                        let layerError: string | null = null;

                        try {
                            const map = L.map( el );
                            const c = args.config as any;
                            const layer = c.wms
                                ? L.tileLayer.wms( c.url, c.options )
                                : L.tileLayer( c.url, c.options );
                            layer.addTo( map );
                            map.setView(
                                [ args.view.lat, args.view.lng ],
                                args.view.zoom
                            );

                            // Give Leaflet time to create tile <img> elements
                            await new Promise( ( resolve ) =>
                                setTimeout( resolve, 500 )
                            );

                            map.remove();
                        } catch ( e: any ) {
                            layerError = e?.message ?? String( e );
                        } finally {
                            Object.defineProperty(
                                HTMLImageElement.prototype,
                                'src',
                                origDescriptor
                            );
                            document
                                .getElementById( `tile-test-${ args.key }` )
                                ?.remove();
                        }

                        return {
                            url: capturedUrls[ 0 ] ?? null,
                            setupError: layerError,
                        };
                    },
                    { key: mapKey, config: mapConfig, view }
                );

                expect
                    .soft( setupError, `threw during setup: ${ setupError }` )
                    .toBeNull();
                expect
                    .soft(
                        url,
                        'no tile URL was captured — layer may not have rendered'
                    )
                    .not.toBeNull();

                if ( setupError || ! url ) {
                    return;
                }

                // Fetch the tile URL from Node.js — no CORS restrictions here
                let status: number;
                try {
                    const response = await request.get( url, {
                        timeout: 15000,
                    } );
                    status = response.status();
                } catch ( e: any ) {
                    // Network-level failure: DNS, connection refused, timeout
                    throw new Error(
                        `network error fetching tile: ${ e.message }\n  URL: ${ url }`
                    );
                }

                expect
                    .soft(
                        AUTH_ERROR_STATUSES.includes( status ),
                        `HTTP ${ status } — token or URL is invalid\n  URL: ${ url }`
                    )
                    .toBe( false );
            } );
        }
    } );

    test( 'every overlay in spotmapjsobj.overlays creates a tile layer without error', async ( {
        page,
    } ) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const overlays: Record< string, any > = await page.evaluate(
            () => ( window as any ).spotmapjsobj.overlays
        );

        if ( ! overlays || Object.keys( overlays ).length === 0 ) {
            test.skip();
            return;
        }

        const results: Array< {
            key: string;
            label: string;
            error: string | null;
        } > = await page.evaluate( () => {
            const allOverlays: Record< string, any > = ( window as any )
                .spotmapjsobj.overlays;
            const overlayResults: Array< {
                key: string;
                label: string;
                error: string | null;
            } > = [];

            for ( const [ mapKey, config ] of Object.entries( allOverlays ) ) {
                const el = document.createElement( 'div' );
                el.id = `test-overlay-${ mapKey }`;
                el.style.cssText =
                    'width:300px;height:300px;position:fixed;left:-9999px;top:0;';
                document.body.appendChild( el );

                let error: string | null = null;
                let spotmap: any = null;

                try {
                    spotmap = new ( window as any ).Spotmap( {
                        mapId: el.id,
                        maps: [ 'openstreetmap' ],
                        mapOverlays: [ mapKey ],
                        feeds: [],
                        gpx: [],
                        styles: {},
                        height: 300,
                        mapcenter: 'all',
                        filterPoints: 0,
                        autoReload: false,
                        debug: false,
                        dateRange: { from: '', to: '' },
                    } );
                    spotmap.initMap();
                } catch ( e: any ) {
                    error = e?.message ?? String( e );
                } finally {
                    spotmap?.destroy();
                    document
                        .getElementById( `test-overlay-${ mapKey }` )
                        ?.remove();
                }

                overlayResults.push( {
                    key: mapKey,
                    label: config.label,
                    error,
                } );
            }

            return overlayResults;
        } );

        // eslint-disable-next-line no-console
        console.log(
            `Testing ${ results.length } overlay(s): ${ results
                .map( ( r ) => r.key )
                .join( ', ' ) }`
        );

        for ( const r of results ) {
            expect(
                r.error,
                `[${ r.key }] "${ r.label }" threw: "${ r.error }"`
            ).toBeNull();
        }
    } );
} );
