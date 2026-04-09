import type { SpotPoint, SpotmapLayers } from './types';
import { debug as debugLog } from './utils';
import {
    TRACK_TYPES,
    CIRCLE_DOT_ICON_SIZE,
    CIRCLE_DOT_ICON_ANCHOR,
    CIRCLE_DOT_BORDER_WIDTH,
    CIRCLE_DOT_RADIUS,
    CIRCLE_DOT_WEIGHT,
    Z_INDEX_TRACK,
    Z_INDEX_STATUS,
    Z_INDEX_HELP,
    SINGLE_POINT_ZOOM,
} from './constants';
import type { LayerManager } from './LayerManager';

/**
 * Manages marker creation, icon styling, and popup content.
 */
export class MarkerManager {
    private readonly map: L.Map;
    private readonly layers: SpotmapLayers;
    private readonly layerManager: LayerManager;
    private readonly canvasRenderer: L.Canvas;
    private readonly markerById = new Map<
        number,
        L.Marker | L.CircleMarker
    >();
    private readonly iconCache = new Map< string, L.Icon >();
    private readonly abortController = new AbortController();
    private readonly dbg: ( ...args: unknown[] ) => void;

    constructor(
        map: L.Map,
        layers: SpotmapLayers,
        layerManager: LayerManager,
        canvasRenderer: L.Canvas,
        debugEnabled = false
    ) {
        this.canvasRenderer = canvasRenderer;
        this.map = map;
        this.layers = layers;
        this.layerManager = layerManager;
        this.dbg = ( ...args ) => debugLog( debugEnabled, ...args );

        const { signal } = this.abortController;
        document.addEventListener(
            'spotmap:click-point',
            ( e: Event ) => {
                const { id, lat, lng } = ( e as CustomEvent ).detail;
                const marker = this.markerById.get( id );
                if ( marker ) {
                    marker.togglePopup();
                    this.map.panTo( [ lat, lng ] );
                }
            },
            { signal }
        );
        document.addEventListener(
            'spotmap:dblclick-point',
            ( e: Event ) => {
                const { id, lat, lng } = ( e as CustomEvent ).detail;
                const marker = this.markerById.get( id );
                if ( marker ) {
                    marker.togglePopup();
                    this.map.setView( [ lat, lng ], SINGLE_POINT_ZOOM );
                }
            },
            { signal }
        );
    }

    /**
     * Add a point to the map as a marker.
     * Points whose admin-configured iconShape is 'circle-dot' are rendered as
     * canvas L.circleMarker (white fill, feed-color stroke) — all others use
     * the BeautifyIcon DOM marker path.
     */
    addPoint( point: SpotPoint ): void {
        const feedName = point.feed_name;
        const coordinates: L.LatLngTuple = [ point.latitude, point.longitude ];

        const feed = this.layers.feeds[ feedName ];
        if ( ! feed ) {
            this.dbg(
                `MarkerManager: unknown feed "${ feedName }" for point id=${ point.id } — skipped`
            );
            return;
        }

        const iconShape = this.getIconShape( point );
        const popupHtml = MarkerManager.getPopupHtml( point );
        let marker: L.Marker | L.CircleMarker;

        if ( iconShape === 'circle-dot' ) {
            const color = this.layerManager.getFeedColor( feedName );
            marker = L.circleMarker( coordinates, {
                renderer: this.canvasRenderer,
                radius: CIRCLE_DOT_RADIUS,
                weight: CIRCLE_DOT_WEIGHT,
                color,
                fillColor: 'white',
                fillOpacity: 1,
            } ).bindPopup( popupHtml );
        } else {
            const markerOptions = this.getMarkerOptions( point );
            marker = L.marker( coordinates, markerOptions ).bindPopup(
                popupHtml
            );
        }

        feed.points.push( point );
        feed.markers.push( marker );
        feed.featureGroup.addLayer( marker );
        this.markerById.set( point.id, marker );
    }

    /**
     * Resolve the iconShape for a point from admin config.
     */
    private getIconShape( point: SpotPoint ): string {
        const pointType = point.type;
        if ( pointType && spotmapjsobj.marker[ pointType ] ) {
            return spotmapjsobj.marker[ pointType ].iconShape;
        }
        if ( pointType && TRACK_TYPES.includes( pointType ) ) {
            return spotmapjsobj.marker.TRACK?.iconShape ?? 'circle-dot';
        }
        return 'marker';
    }

    /**
     * Build marker options with the correct icon and z-index.
     */
    private getMarkerOptions( point: SpotPoint ): L.MarkerOptions {
        let zIndexOffset = Z_INDEX_TRACK;

        if ( ! TRACK_TYPES.includes( point.type ) ) {
            zIndexOffset = Z_INDEX_STATUS;
        }
        if ( [ 'HELP', 'HELP-CANCEL' ].includes( point.type ) ) {
            zIndexOffset = Z_INDEX_HELP;
        }

        return {
            icon: this.getMarkerIcon( point ),
            zIndexOffset,
        };
    }

    /**
     * Create a BeautifyIcon for a point or a GPX waypoint.
     *
     * @param point        - Either a SpotPoint (has feed_name/type) or a simple {color} object for GPX.
     * @param extraOptions - Additional BeautifyIcon options merged on top (e.g. className).
     */
    getMarkerIcon(
        point: SpotPoint | { color: string; feed_name?: string; type?: string },
        extraOptions: Partial< L.BeautifyIconOptions > = {}
    ): L.Icon {
        const color =
            ( 'color' in point ? point.color : undefined ) ??
            ( point.feed_name
                ? this.layerManager.getFeedColor( point.feed_name )
                : 'blue' );

        const iconOptions: L.BeautifyIconOptions = {
            textColor: color,
            borderColor: color,
        };

        const pointType = point.type;

        if ( pointType && spotmapjsobj.marker[ pointType ] ) {
            // Use the configured marker shape for this point type
            const config = spotmapjsobj.marker[ pointType ];
            iconOptions.iconShape = config.iconShape;
            iconOptions.icon = config.icon;

            if ( iconOptions.iconShape === 'circle-dot' ) {
                iconOptions.iconAnchor = CIRCLE_DOT_ICON_ANCHOR;
                iconOptions.iconSize = CIRCLE_DOT_ICON_SIZE;
                iconOptions.borderWith = CIRCLE_DOT_BORDER_WIDTH;
            }
        } else if (
            pointType &&
            TRACK_TYPES.includes( pointType as SpotPoint[ 'type' ] )
        ) {
            const trackMarker = spotmapjsobj.marker.TRACK;
            iconOptions.iconShape = trackMarker?.iconShape;
            iconOptions.icon = trackMarker?.icon;
            iconOptions.iconAnchor = CIRCLE_DOT_ICON_ANCHOR;
            iconOptions.iconSize = CIRCLE_DOT_ICON_SIZE;
            iconOptions.borderWith = CIRCLE_DOT_BORDER_WIDTH;
        } else {
            this.dbg(
                `MarkerManager: no marker config for type "${
                    pointType ?? '(none)'
                }" — using generic marker`
            );
            iconOptions.iconShape = 'marker';
            iconOptions.icon = 'circle';
        }

        // If the caller overrides iconShape, remove circle-dot-specific sizing
        // so it doesn't bleed through and affect the overridden shape.
        if (
            extraOptions.iconShape &&
            extraOptions.iconShape !== iconOptions.iconShape
        ) {
            delete iconOptions.iconAnchor;
            delete iconOptions.iconSize;
            delete iconOptions.borderWith;
        }

        const merged = { ...iconOptions, ...extraOptions };
        const cacheKey = JSON.stringify( merged );
        const cached = this.iconCache.get( cacheKey );
        if ( cached ) {
            return cached;
        }
        const icon = L.BeautifyIcon.icon( merged );
        this.iconCache.set( cacheKey, icon );
        return icon;
    }

    /**
     * Remove all document event listeners registered by this instance.
     */
    destroy(): void {
        this.abortController.abort();
        this.markerById.clear();
    }

    /**
     * Generate the popup HTML for a point.
     */
    static getPopupHtml( entry: SpotPoint ): string {
        let html = `<b>${ entry.type }</b><br>`;
        html += `Time: ${ entry.time }<br>Date: ${ entry.date }<br>`;

        if (
            entry.local_timezone &&
            ! (
                entry.localdate === entry.date && entry.localtime === entry.time
            )
        ) {
            html += `Local Time: ${ entry.localtime }<br>Local Date: ${ entry.localdate }<br>`;
        }

        if ( entry.message && entry.type === 'MEDIA' ) {
            html += `<img width="180" src="${ entry.message }" class="attachment-thumbnail size-thumbnail" alt="" decoding="async" loading="lazy" /><br>`;
        } else if ( entry.message ) {
            html += `${ entry.message }<br>`;
        }

        if ( entry.altitude > 0 ) {
            html += `Altitude: ${ Number( entry.altitude ) }m<br>`;
        }

        if ( entry.battery_status === 'LOW' ) {
            html += `Battery status is low!<br>`;
        }

        if ( entry.hiddenPoints ) {
            html += `There are ${ entry.hiddenPoints.count } hidden Points within a radius of ${ entry.hiddenPoints.radius } meters<br>`;
        }

        return html;
    }
}
