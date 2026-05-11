import type { SpotmapLayers, SpotPoint } from './types';
import type { MarkerManager } from './MarkerManager';
import {
    LOD_DEBOUNCE_MS,
    LINE_SMOOTH_FACTOR,
    LOD_MIN_TRACK_POINTS,
} from './constants';
import { debug as debugLog } from './utils';

interface FeedLodState {
    visibleTrackIds: Set< number >;
}

/**
 * Zoom-driven TRACK marker visibility using the same screen-space simplification
 * as the polyline's smoothFactor (L.LineUtil.simplify).
 *
 * A marker is visible iff its point would be kept by Leaflet when rendering the
 * polyline at the current zoom.  Markers stay in the featureGroup at all times —
 * visibility is toggled via opacity (CircleMarker) or display style (DOM Marker).
 */
export class LodManager {
    private readonly map: L.Map;
    private readonly layers: SpotmapLayers;
    private readonly markerManager: MarkerManager;
    private readonly dbg: ( ...args: unknown[] ) => void;
    private readonly feedState = new Map< string, FeedLodState >();
    private debounceTimer: ReturnType< typeof setTimeout > | null = null;
    private started = false;
    private readonly onZoomEnd: () => void;

    constructor(
        map: L.Map,
        layers: SpotmapLayers,
        markerManager: MarkerManager,
        debugEnabled = false
    ) {
        this.map = map;
        this.layers = layers;
        this.markerManager = markerManager;
        this.dbg = ( ...args ) => debugLog( debugEnabled, ...args );

        this.onZoomEnd = () => {
            if ( this.debounceTimer !== null ) {
                clearTimeout( this.debounceTimer );
            }
            this.debounceTimer = setTimeout( () => {
                this.debounceTimer = null;
                this.refresh();
            }, LOD_DEBOUNCE_MS );
        };
    }

    start(): void {
        if ( this.started ) {
            return;
        }
        this.started = true;
        this.map.on( 'zoomend', this.onZoomEnd );
        this.refresh();
    }

    refresh(): void {
        let totalTrack = 0;
        outer: for ( const feed of Object.values( this.layers.feeds ) ) {
            for ( const p of feed.points ) {
                if (
                    p.type === 'TRACK' &&
                    ++totalTrack >= LOD_MIN_TRACK_POINTS
                ) {
                    break outer;
                }
            }
        }
        if ( totalTrack < LOD_MIN_TRACK_POINTS ) {
            return;
        }
        for ( const feedName of Object.keys( this.layers.feeds ) ) {
            this.applyLodForFeed( feedName );
        }
    }

    onPointAppended( point: SpotPoint ): void {
        if ( point.type === 'TRACK' && this.feedState.size > 0 ) {
            this.applyLodForFeed( point.feed_name );
        }
    }

    destroy(): void {
        if ( this.debounceTimer !== null ) {
            clearTimeout( this.debounceTimer );
            this.debounceTimer = null;
        }
        if ( this.started ) {
            this.map.off( 'zoomend', this.onZoomEnd );
        }
    }

    private setMarkerVisible(
        marker: L.Marker | L.CircleMarker,
        visible: boolean
    ): void {
        if ( marker instanceof L.CircleMarker ) {
            marker.setStyle(
                visible
                    ? { opacity: 1, fillOpacity: 1 }
                    : { opacity: 0, fillOpacity: 0 }
            );
        } else {
            const el = ( marker as L.Marker ).getElement();
            if ( el ) {
                ( el as HTMLElement ).style.display = visible ? '' : 'none';
            }
        }
    }

    private applyLodForFeed( feedName: string ): void {
        const feed = this.layers.feeds[ feedName ];
        if ( ! feed || feed.points.length === 0 ) {
            return;
        }

        // Compute the set of TRACK point IDs that are geometrically significant
        // at the current zoom, using the same screen-space RDP that Leaflet uses
        // to render the polyline.  Process each consecutive TRACK run independently
        // so the simplification matches the polyline's per-segment rendering.
        const newVisibleIds = new Set< number >();
        let i = 0;

        while ( i < feed.points.length ) {
            if ( feed.points[ i ].type !== 'TRACK' ) {
                i++;
                continue;
            }

            const runStart = i;
            while (
                i < feed.points.length &&
                feed.points[ i ].type === 'TRACK'
            ) {
                i++;
            }
            const run = feed.points.slice( runStart, i );

            if ( run.length <= 2 ) {
                for ( const p of run ) {
                    newVisibleIds.add( p.id );
                }
                continue;
            }

            // Project to screen-pixel coordinates
            const px: L.Point[] = run.map( ( p ) =>
                this.map.latLngToLayerPoint( [ p.latitude, p.longitude ] )
            );

            // Simplify with the same tolerance as the polyline's smoothFactor
            const kept = new Set(
                L.LineUtil.simplify( px, LINE_SMOOTH_FACTOR )
            );

            for ( let j = 0; j < px.length; j++ ) {
                if ( kept.has( px[ j ] ) ) {
                    newVisibleIds.add( run[ j ].id );
                }
            }
        }

        // Always keep the last TRACK point and everything within 24 h of it visible,
        // regardless of zoom level.
        let lastTrackPoint: SpotPoint | undefined;
        for ( let k = feed.points.length - 1; k >= 0; k-- ) {
            if ( feed.points[ k ].type === 'TRACK' ) {
                lastTrackPoint = feed.points[ k ];
                break;
            }
        }
        if ( lastTrackPoint ) {
            const cutoff = lastTrackPoint.unixtime - 24 * 3600;
            for ( const p of feed.points ) {
                if ( p.type === 'TRACK' && p.unixtime >= cutoff ) {
                    newVisibleIds.add( p.id );
                }
            }
        }

        const state = this.feedState.get( feedName );
        const prevVisibleIds =
            state?.visibleTrackIds ??
            new Set< number >(
                feed.points
                    .filter( ( p ) => p.type === 'TRACK' )
                    .map( ( p ) => p.id )
            );

        const pinnedId =
            feed.lastPointMarker !== undefined
                ? feed.points.at( -1 )?.id
                : undefined;

        for ( const id of prevVisibleIds ) {
            if ( ! newVisibleIds.has( id ) ) {
                const marker = this.markerManager.getMarkerForPoint( id );
                if ( marker ) {
                    this.setMarkerVisible( marker, false );
                }
            }
        }

        for ( const id of newVisibleIds ) {
            if ( id === pinnedId ) {
                continue;
            }
            if ( ! prevVisibleIds.has( id ) ) {
                const marker = this.markerManager.getMarkerForPoint( id );
                if ( marker ) {
                    this.setMarkerVisible( marker, true );
                }
            }
        }

        this.feedState.set( feedName, { visibleTrackIds: newVisibleIds } );

        this.dbg(
            `LodManager: "${ feedName }" zoom=${ this.map.getZoom() } ` +
                `${ prevVisibleIds.size }→${ newVisibleIds.size } track markers`
        );
    }
}
