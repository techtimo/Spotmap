import type { SpotPoint, SpotmapLayers } from './types';
import { debug as debugLog } from './utils';
import {
    TRACK_TYPES,
    CIRCLE_DOT_ICON_SIZE,
    CIRCLE_DOT_ICON_ANCHOR,
    CIRCLE_DOT_BORDER_WIDTH,
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
    private readonly tableCellControllers: AbortController[] = [];
    private readonly dbg: ( ...args: unknown[] ) => void;

    constructor(
        map: L.Map,
        layers: SpotmapLayers,
        layerManager: LayerManager,
        debugEnabled = false
    ) {
        this.map = map;
        this.layers = layers;
        this.layerManager = layerManager;
        this.dbg = ( ...args ) => debugLog( debugEnabled, ...args );
    }

    /**
     * Add a point to the map as a marker.
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

        const markerOptions = this.getMarkerOptions( point );
        const popupHtml = MarkerManager.getPopupHtml( point );
        const marker = L.marker( coordinates, markerOptions ).bindPopup(
            popupHtml
        );

        feed.points.push( point );
        feed.markers.push( marker );
        feed.featureGroup.addLayer( marker );

        // Bind click handlers for the corresponding table row (if it exists).
        // Use an AbortController so all listeners can be removed on destroy().
        const tableCell = document.getElementById( `spotmap_${ point.id }` );
        if ( tableCell ) {
            const controller = new AbortController();
            this.tableCellControllers.push( controller );
            const { signal } = controller;
            tableCell.addEventListener(
                'click',
                () => {
                    marker.togglePopup();
                    this.map.panTo( coordinates );
                },
                { signal }
            );
            tableCell.addEventListener(
                'dblclick',
                () => {
                    marker.togglePopup();
                    this.map.setView( coordinates, SINGLE_POINT_ZOOM );
                },
                { signal }
            );
        }
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

        return L.BeautifyIcon.icon( { ...iconOptions, ...extraOptions } );
    }

    /**
     * Remove all table-cell event listeners added by addPoint().
     */
    destroy(): void {
        for ( const controller of this.tableCellControllers ) {
            controller.abort();
        }
        this.tableCellControllers.length = 0;
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
