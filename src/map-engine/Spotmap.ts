import type {
    SpotmapOptions,
    SpotmapLayers,
    AjaxRequestBody,
    AjaxResponse,
    TableOptions,
    SpotPoint,
} from './types';
import {
    DEFAULT_CENTER,
    DEFAULT_ZOOM,
    AUTO_RELOAD_INTERVAL_MS,
    MAX_RELOAD_BACKOFF_MS,
    SINGLE_POINT_ZOOM,
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
        if ( ! options.maps ) {
            console.error( 'Missing important options!!' ); // eslint-disable-line no-console
        }
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
            scrollWheelZoom: this.options.scrollWheelZoom ?? false,
            dragging: this.options.enablePanning ?? true,
            zoomControl: this.options.zoomControl ?? true,
        } );

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
        const canvasRenderer = L.canvas( { pane: 'markerPane' } );
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
                marker_options: {
                    wptIcons: {
                        '': this.markerManager.getMarkerIcon( {
                            color,
                        } ),
                    },
                    wptIconsType: {
                        '': this.markerManager.getMarkerIcon( {
                            color,
                        } ),
                    },
                    startIconUrl: '',
                    endIconUrl: '',
                    shadowUrl: spotmapjsobj.url + 'leaflet-gpx/pin-shadow.png',
                },
                polyline_options: { color },
            };

            const downloadLink = entry.download
                ? ` <a href="${ entry.url }" download title="Download GPX" style="text-decoration:none;color:inherit;vertical-align:middle;" onclick="event.stopPropagation()">${ DOWNLOAD_SVG }</a>`
                : '';

            const track = new L.GPX( entry.url, gpxOptions )
                .on( 'loaded', () => {
                    if (
                        this.options.mapcenter === 'gpx' ||
                        response.empty ||
                        response.error
                    ) {
                        this.boundsManager.fitBounds(
                            this.options.mapcenter === 'gpx' ? 'gpx' : 'all'
                        );
                    }
                } )
                .on( 'addline', ( e: L.LeafletEvent ) => {
                    (
                        e as L.LeafletEvent & { line: L.Polyline }
                     ).line.bindPopup( entry.name + downloadLink );
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
            zIndexOffset: 1000,
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
        this.map.setView( DEFAULT_CENTER, DEFAULT_ZOOM );
        L.popup()
            .setLatLng( [ DEFAULT_CENTER[ 0 ] + 0.008, DEFAULT_CENTER[ 1 ] ] )
            .setContent( 'There is nothing to show here yet.' )
            .openOn( this.map );
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
