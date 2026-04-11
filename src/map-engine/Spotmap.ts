import type {
    SpotmapOptions,
    SpotmapLayers,
    AjaxRequestBody,
    AjaxResponse,
    TableOptions,
    SpotPoint,
} from './types';
import {
    AUTO_RELOAD_INTERVAL_MS,
    MAX_RELOAD_BACKOFF_MS,
    SINGLE_POINT_ZOOM,
    Z_INDEX_LAST_POINT,
} from './constants';
import { debug as debugLog, getColorDot } from './utils';

const DOWNLOAD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;fill:currentColor"><path d="M18 11.3l-1-1.1-4 3.9V4h-1.7v10.1l-4-3.9-1.1 1.1 5.9 5.8 5.9-5.8zm-2.9 7.2H8.9v1.5h6.2v-1.5z"/></svg>';
import { DataFetcher } from './DataFetcher';
import { LayerManager } from './LayerManager';
import { MarkerManager } from './MarkerManager';
import { LineManager } from './LineManager';
import { BoundsManager } from './BoundsManager';
import { ButtonManager } from './ButtonManager';
import { TableRenderer } from './TableRenderer';

/**
 * Main Spotmap orchestrator.
 *
 * Coordinates map initialization, data fetching, and all sub-managers.
 * Used both in the Gutenberg editor preview and the public frontend.
 */
export class Spotmap {
    readonly options: SpotmapOptions;
    map!: L.Map;
    layers: SpotmapLayers = { feeds: {}, gpx: {} };

    private dataFetcher!: DataFetcher;
    private layerManager!: LayerManager;
    private markerManager!: MarkerManager;
    private lineManager!: LineManager;
    private boundsManager!: BoundsManager;
    private buttonManager!: ButtonManager;
    private tableRenderer: TableRenderer | null = null;

    private _destroyed = false;
    private autoReloadTimeoutId: ReturnType< typeof setTimeout > | null = null;
    private latestUnixtimeByFeed: Map< string, number > = new Map();
    private onVisibilityChange: ( () => void ) | null = null;
    private reloadBody: AjaxRequestBody | null = null;

    constructor( options: SpotmapOptions ) {
        this.options = options;
        this.debug( 'Spotmap obj created.' );
        this.debug( this.options );
    }

    /**
     * Swap the base tile layers without rebuilding the map or re-fetching data.
     */
    updateMaps( maps: string[], activeMap?: string ): void {
        if ( ! this.layerManager ) {
            return;
        }
        this.layerManager.updateBaseLayers( maps, activeMap );
    }

    updateOverlays( overlays: string[] ): void {
        if ( ! this.layerManager ) {
            return;
        }
        this.layerManager.updateOverlays( overlays );
    }

    updateHeight( height: number ): void {
        const el = this.map?.getContainer();
        if ( ! el ) {
            return;
        }
        el.style.height = `${ height }px`;
        this.map.invalidateSize();
    }

    updateButtons(
        locateButton: boolean | undefined,
        navigationButtons: import('./types').NavigationButtonsConfig | undefined
    ): void {
        if ( ! this.buttonManager ) {
            return;
        }
        this.buttonManager.updateButtons( locateButton, navigationButtons );
    }

    updateAutoReload( enabled: boolean ): void {
        if ( enabled ) {
            if ( this.autoReloadTimeoutId !== null || ! this.reloadBody ) {
                return;
            }
            for ( const [ feedName, feed ] of Object.entries(
                this.layers.feeds
            ) ) {
                this.latestUnixtimeByFeed.set(
                    feedName,
                    feed.points.at( -1 )?.unixtime ?? 0
                );
            }
            this.startAutoReload( this.reloadBody );
        } else {
            if ( this.autoReloadTimeoutId !== null ) {
                clearTimeout( this.autoReloadTimeoutId );
                this.autoReloadTimeoutId = null;
            }
            if ( this.onVisibilityChange ) {
                document.removeEventListener(
                    'visibilitychange',
                    this.onVisibilityChange
                );
                this.onVisibilityChange = null;
            }
        }
    }

    updateScrollWheelZoom( enabled: boolean ): void {
        if ( ! this.map ) {
            return;
        }
        if ( enabled ) {
            this.map.scrollWheelZoom.enable();
        } else {
            this.map.scrollWheelZoom.disable();
        }
    }

    /**
     * Initialize the Leaflet map and load data.
     */
    async initMap(): Promise< void > {
        if ( ! this.options.maps ) {
            console.error(
                // eslint-disable-line no-console
                'Spotmap: missing required "maps" option. options:',
                JSON.stringify( this.options )
            );
        }

        const el =
            this.options.mapElement ??
            document.getElementById( this.options.mapId ?? '' );

        if ( ! el ) {
            throw new Error( 'Map container not found.' );
        }

        el.style.height = `${ this.options.height }px`;

        // If the element already has a Leaflet map and options haven't changed,
        // skip re-initialization.
        const oldOptions = (
            el as HTMLElement & { _spotmapOptions?: SpotmapOptions }
         )._spotmapOptions;
        (
            el as HTMLElement & { _spotmapOptions?: SpotmapOptions }
         )._spotmapOptions = this.options;

        // Remove any empty-state overlay left over from a previous render
        el.querySelectorAll( '.spotmap-empty-state' ).forEach( ( n ) =>
            n.remove()
        );

        if ( ( el as HTMLElement & { _leaflet_id?: number } )._leaflet_id ) {
            if (
                JSON.stringify( this.options ) === JSON.stringify( oldOptions )
            ) {
                return;
            }
            // Reset the Leaflet instance on the element
            (
                el as HTMLElement & { _leaflet_id?: number | null }
             )._leaflet_id = null;
            // Clear child panes
            el.querySelectorAll( '.leaflet-control-container' ).forEach(
                ( c ) => {
                    c.innerHTML = '';
                }
            );
            el.querySelectorAll( '.leaflet-pane' ).forEach( ( p ) => {
                p.innerHTML = '';
            } );
        }

        // Create the Leaflet map
        this.map = L.map( el, {
            scrollWheelZoom: this.options.scrollWheelZoom ?? true,
            dragging: this.options.enablePanning ?? true,
            zoomControl: this.options.zoomControl ?? true,
        } );
        this.map.attributionControl.setPrefix( '' );

        // Optional controls
        if ( this.options.fullscreenButton !== false && L.Control.FullScreen ) {
            new L.Control.FullScreen().addTo( this.map );
        }
        if ( this.options.scaleControl !== false ) {
            L.control.scale().addTo( this.map );
        }

        // Enable scroll wheel zoom on focus, but only if the option allows it
        if ( this.options.scrollWheelZoom ) {
            this.map.once( 'focus', () => {
                this.map.scrollWheelZoom.enable();
            } );
        }

        // Initialize sub-managers
        const dbg = !! this.options.debug;
        this.dataFetcher = new DataFetcher( spotmapjsobj.ajaxUrl, dbg );
        this.layerManager = new LayerManager(
            this.map,
            this.options,
            this.layers,
            dbg
        );
        const canvasRenderer = L.svg( { pane: 'markerPane' } );
        this.markerManager = new MarkerManager(
            this.map,
            this.layers,
            this.layerManager,
            canvasRenderer,
            dbg
        );
        this.lineManager = new LineManager(
            this.layers,
            this.layerManager,
            dbg
        );
        this.boundsManager = new BoundsManager( this.map, this.layers, dbg );
        this.buttonManager = new ButtonManager(
            this.map,
            this.options,
            this.boundsManager
        );

        // Add tile layers and controls
        this.layerManager.addBaseLayers();
        this.buttonManager.addButtons();
        this.layerManager.layerControl.addTo( this.map );

        // Fetch and render data
        const body: AjaxRequestBody = {
            action: 'spotmap_get_positions',
            select: '*',
            feeds: this.options.feeds ?? '',
            'date-range': this.options.dateRange,
            date: this.options.date,
            orderBy: 'feed_name, time',
            groupBy: '',
        };
        this.reloadBody = body;

        try {
            const response = await this.dataFetcher.fetchPoints(
                body,
                this.options.filterPoints
            );

            if ( this._destroyed || ! this.map ) {
                return;
            }

            if ( response.error ) {
                this.debug(
                    'Feed error:',
                    ( response as { title?: string } ).title
                );
            } else if ( ! response.empty ) {
                for ( const entry of response as import('./types').SpotPoint[] ) {
                    this.ensureFeedLayer( entry.feed_name );
                    this.markerManager.addPoint( entry );
                    this.lineManager.addPointToLine( entry );
                }
            }

            this.loadGpxTracks( response );
            this.layerManager.addFeedsToMap();
            this.addLastPointMarkers();

            if (
                response.empty &&
                ( ! this.options.gpx || this.options.gpx.length === 0 )
            ) {
                this.showEmptyState();
            } else {
                this.boundsManager.fitBounds( this.options.mapcenter );
            }

            this.lineManager.applyArrows();
            this.layerManager.addOverlays();

            if ( this.options.autoReload && ! response.empty ) {
                for ( const [ feedName, feed ] of Object.entries(
                    this.layers.feeds
                ) ) {
                    this.latestUnixtimeByFeed.set(
                        feedName,
                        feed.points.at( -1 )?.unixtime ?? 0
                    );
                }
                this.startAutoReload( body );
            }
        } catch ( err ) {
            this.debug( 'Error loading map data:' );
            this.debug( err );
        }
    }

    /**
     * Initialize the [spotmessages] table view.
     */
    async initTable( elementId: string ): Promise< void > {
        const tableOptions: TableOptions = {
            feeds: this.options.feeds,
            dateRange: this.options.dateRange,
            date: this.options.date,
            autoReload: this.options.autoReload,
            filterPoints: this.options.filterPoints,
            debug: this.options.debug,
            ...( ( this.options as unknown as TableOptions ).type && {
                type: ( this.options as unknown as TableOptions ).type,
            } ),
            ...( ( this.options as unknown as TableOptions ).orderBy && {
                orderBy: ( this.options as unknown as TableOptions ).orderBy,
            } ),
            ...( ( this.options as unknown as TableOptions ).limit && {
                limit: ( this.options as unknown as TableOptions ).limit,
            } ),
            ...( ( this.options as unknown as TableOptions ).groupBy && {
                groupBy: ( this.options as unknown as TableOptions ).groupBy,
            } ),
        };

        if ( ( this.options as unknown as TableOptions ).tableElement ) {
            tableOptions.tableElement = (
                this.options as unknown as TableOptions
             ).tableElement;
        }

        this.dataFetcher = new DataFetcher( spotmapjsobj.ajaxUrl );
        this.tableRenderer = new TableRenderer(
            tableOptions,
            this.dataFetcher
        );
        await this.tableRenderer.initTable( elementId );
    }

    /**
     * Clean up all resources: intervals, event listeners, map instance.
     */
    destroy(): void {
        this._destroyed = true;

        if ( this.autoReloadTimeoutId !== null ) {
            clearTimeout( this.autoReloadTimeoutId );
            this.autoReloadTimeoutId = null;
        }

        if ( this.onVisibilityChange ) {
            document.removeEventListener(
                'visibilitychange',
                this.onVisibilityChange
            );
            this.onVisibilityChange = null;
        }

        this.tableRenderer?.destroy();
        this.markerManager?.destroy();
        this.dataFetcher?.abort();

        if ( this.map ) {
            // Clear textpath text before removal: map.remove() internally calls
            // _stop() which fires _updatePaths, which invokes textpath's setText
            // during teardown and crashes. Setting text to null first makes
            // _textRedraw a no-op for that final render pass.
            this.lineManager?.clearArrows();
            this.map.remove();
        }
    }

    // ------- Private helpers -------

    private ensureFeedLayer( feedName: string ): void {
        if ( ! this.layerManager.doesFeedExist( feedName ) ) {
            const line = this.lineManager.createLine( feedName );
            this.layerManager.initFeedLayer( feedName, line );
        }
    }

    private loadGpxTracks( response: AjaxResponse ): void {
        if ( ! this.options.gpx ) {
            return;
        }

        for ( const entry of this.options.gpx ) {
            const color = this.layerManager.getGpxColor( entry.color );
            const gpxOptions = {
                async: true,
                markers: {
                    startIcon: null,
                    endIcon: null,
                    wptIcons: {
                        '': this.markerManager.getMarkerIcon( {
                            color,
                        } ),
                    },
                    wptTypeIcons: {
                        '': this.markerManager.getMarkerIcon( {
                            color,
                        } ),
                    },
                },
                polyline_options: { color },
            };

            const downloadLink = entry.download
                ? ` <a href="${ entry.url }" download title="Download GPX" style="text-decoration:none;color:inherit;vertical-align:middle;" onclick="event.stopPropagation()">${ DOWNLOAD_SVG }</a>`
                : '';

            const lines: L.Polyline[] = [];
            const track = new L.GPX( entry.url, gpxOptions )
                .on( 'loaded', () => {
                    if ( this._destroyed || ! this.map ) {
                        return;
                    }
                    if (
                        this.options.mapcenter === 'gpx' ||
                        response.empty ||
                        response.error
                    ) {
                        this.boundsManager.fitBounds(
                            this.options.mapcenter === 'gpx' ? 'gpx' : 'all'
                        );
                    }
                    const statsHtml = buildGpxStatsHtml(
                        track as unknown as GpxTrackStats
                    );
                    const fullHtml =
                        `<b>${ entry.name }</b>${ downloadLink }` + statsHtml;
                    for ( const line of lines ) {
                        line.setPopupContent( fullHtml );
                    }
                } )
                .on( 'addline', ( e: L.LeafletEvent ) => {
                    const line = ( e as L.LeafletEvent & { line: L.Polyline } )
                        .line;
                    line.bindPopup( entry.name + downloadLink );
                    lines.push( line );
                } );

            const html = ` ${ getColorDot( color ) }${ downloadLink }`;
            this.layers.gpx[ entry.name ] = {
                featureGroup: L.featureGroup( [ track ] ),
            };
            if ( entry.visible !== false ) {
                this.layers.gpx[ entry.name ].featureGroup.addTo( this.map );
            }
            this.layerManager.layerControl.addOverlay(
                this.layers.gpx[ entry.name ].featureGroup,
                entry.name + html
            );
        }
    }

    private refreshLastPointMarkerForFeed( feedName: string ): void {
        const feed = this.layers.feeds[ feedName ];
        if ( ! feed ) {
            return;
        }

        // Remove old pin marker if one was previously placed.
        if ( feed.lastPointMarker ) {
            feed.featureGroup.removeLayer( feed.lastPointMarker );
            feed.lastPointMarker = undefined;
        }

        const lp = feed.points.at( -1 );
        if ( ! lp ) {
            return;
        }

        // Replace the regular circle-dot marker for the last point with the pin.
        const lastMarker = feed.markers.at( -1 );
        if ( lastMarker ) {
            feed.featureGroup.removeLayer( lastMarker );
            feed.markers.pop();
        }

        const icon = this.markerManager.getMarkerIcon( lp, {
            iconShape: 'marker',
            customClasses: 'spotmap_last_marker',
        } );
        feed.lastPointMarker = L.marker( [ lp.latitude, lp.longitude ], {
            icon,
            zIndexOffset: Z_INDEX_LAST_POINT,
        } )
            .bindPopup( MarkerManager.getPopupHtml( lp ) )
            .addTo( feed.featureGroup );
    }

    private addLastPointMarkers(): void {
        for ( const feedName of Object.keys( this.layers.feeds ) ) {
            if ( ! this.options.styles?.[ feedName ]?.lastPoint ) {
                continue;
            }
            this.refreshLastPointMarkerForFeed( feedName );
        }
    }

    private showEmptyState(): void {
        const container = this.map.getContainer();

        // Build a human-readable summary of active filters
        const parts: string[] = [];

        let feeds: string[];
        if ( Array.isArray( this.options.feeds ) ) {
            feeds = this.options.feeds;
        } else if ( this.options.feeds ) {
            feeds = String( this.options.feeds )
                .split( ',' )
                .map( ( f ) => f.trim() )
                .filter( Boolean );
        } else {
            feeds = [];
        }

        if ( feeds.length > 0 ) {
            parts.push( `Feeds: ${ feeds.join( ', ' ) }` );
        }

        const { from, to } = this.options.dateRange ?? {};
        if ( from || to ) {
            const range = [ from, to ].filter( Boolean ).join( ' – ' );
            parts.push( `Date range: ${ range }` );
        }

        const overlay = document.createElement( 'div' );
        overlay.className = 'spotmap-empty-state';
        overlay.style.cssText = [
            'position:absolute',
            'inset:0',
            'z-index:1000',
            'display:flex',
            'flex-direction:column',
            'align-items:center',
            'justify-content:center',
            'background:#f0f0f0',
            'color:#666',
            'gap:8px',
            'text-align:center',
            'padding:16px',
            'font-size:14px',
            'line-height:1.4',
        ].join( ';' );

        const title = document.createElement( 'strong' );
        title.textContent = 'No points to display';
        overlay.appendChild( title );

        const detail = document.createElement( 'span' );
        detail.textContent =
            parts.length > 0
                ? `No tracking data was found for ${ parts.join( ', ' ) }.`
                : 'No tracking data has been stored yet.';
        overlay.appendChild( detail );

        // Leaflet already sets position:relative on the container
        container.appendChild( overlay );
    }

    private startAutoReload( body: AjaxRequestBody ): void {
        const reloadBody: AjaxRequestBody = {
            ...body,
            groupBy: 'feed_name',
            orderBy: 'time DESC',
        };

        const poll = ( delay: number ): void => {
            this.autoReloadTimeoutId = setTimeout( async () => {
                if ( document.hidden ) {
                    return;
                }

                try {
                    const response = await this.dataFetcher.fetchPoints(
                        reloadBody,
                        this.options.filterPoints
                    );

                    if ( ! response.error && ! response.empty ) {
                        for ( const entry of response as SpotPoint[] ) {
                            const feedName = entry.feed_name;
                            const feed = this.layers.feeds[ feedName ];
                            if ( ! feed ) {
                                continue;
                            }

                            const lastUnixtime =
                                this.latestUnixtimeByFeed.get( feedName ) ?? 0;
                            if ( entry.unixtime > lastUnixtime ) {
                                this.latestUnixtimeByFeed.set(
                                    feedName,
                                    entry.unixtime
                                );
                                this.debug(
                                    `Found a new point for Feed: ${ feedName }`
                                );
                                this.markerManager.addPoint( entry );
                                this.lineManager.addPointToLine( entry );
                                if (
                                    this.options.styles?.[ feedName ]?.lastPoint
                                ) {
                                    this.refreshLastPointMarkerForFeed(
                                        feedName
                                    );
                                }

                                if ( this.options.mapcenter === 'last' ) {
                                    this.map.setView(
                                        [ entry.latitude, entry.longitude ],
                                        SINGLE_POINT_ZOOM
                                    );
                                }
                            }
                        }
                    }

                    poll( AUTO_RELOAD_INTERVAL_MS );
                } catch ( err ) {
                    this.debug( 'Auto-reload error:', err );
                    poll( Math.min( delay * 2, MAX_RELOAD_BACKOFF_MS ) );
                }
            }, delay );
        };

        if ( this.onVisibilityChange ) {
            document.removeEventListener(
                'visibilitychange',
                this.onVisibilityChange
            );
        }
        this.onVisibilityChange = () => {
            if ( ! document.hidden ) {
                if ( this.autoReloadTimeoutId !== null ) {
                    clearTimeout( this.autoReloadTimeoutId );
                    this.autoReloadTimeoutId = null;
                }
                poll( 0 );
            }
        };
        document.addEventListener(
            'visibilitychange',
            this.onVisibilityChange
        );

        poll( AUTO_RELOAD_INTERVAL_MS );
    }

    private debug( ...args: unknown[] ): void {
        debugLog( !! this.options?.debug, ...args );
    }
}

interface GpxTrackStats {
    get_distance: () => number;
    get_moving_time: () => number;
    get_total_time: () => number;
    get_elevation_gain: () => number;
    get_elevation_loss: () => number;
    get_elevation_max: () => number;
    get_elevation_min: () => number;
    get_moving_speed: () => number;
    get_duration_string: ( duration: number, hidems?: boolean ) => string;
    m_to_km: ( v: number ) => number;
}

function buildGpxStatsHtml( track: GpxTrackStats ): string {
    const rows: Array< [ string, string ] > = [];

    const dist = track.get_distance();
    if ( dist > 0 ) {
        rows.push( [
            'Distance',
            `${ track.m_to_km( dist ).toFixed( 1 ) } km`,
        ] );
    }

    const movingTime = track.get_moving_time();
    if ( movingTime > 0 ) {
        rows.push( [
            'Moving time',
            track.get_duration_string( movingTime, true ),
        ] );
    }

    const totalTime = track.get_total_time();
    if ( totalTime > 0 && totalTime !== movingTime ) {
        rows.push( [
            'Total time',
            track.get_duration_string( totalTime, true ),
        ] );
    }

    const speed = track.get_moving_speed();
    if ( speed > 0 && isFinite( speed ) ) {
        rows.push( [ 'Avg speed', `${ speed.toFixed( 1 ) } km/h` ] );
    }

    const gain = track.get_elevation_gain();
    const loss = track.get_elevation_loss();
    if ( gain > 0 || loss > 0 ) {
        rows.push( [
            '\u2191\u202fGain\u2002/\u2002\u2193\u202fLoss',
            `${ Math.round( gain ) }\u202fm\u2002/\u2002${ Math.round(
                loss
            ) }\u202fm`,
        ] );
    }

    const elevMin = track.get_elevation_min();
    const elevMax = track.get_elevation_max();
    if ( elevMax > 0 || elevMin > 0 ) {
        rows.push( [
            'Elevation',
            `${ Math.round( elevMin ) }\u202f\u2013\u202f${ Math.round(
                elevMax
            ) }\u202fm`,
        ] );
    }

    if ( rows.length === 0 ) {
        return '';
    }

    const tableRows = rows
        .map(
            ( [ label, value ] ) =>
                `<tr><td style="padding:1px 8px 1px 0;color:#666">${ label }</td>` +
                `<td style="padding:1px 0;white-space:nowrap">${ value }</td></tr>`
        )
        .join( '' );
    return `<table style="margin-top:6px;font-size:0.85em;border-collapse:collapse">${ tableRows }</table>`;
}
