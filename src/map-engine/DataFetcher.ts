import type { AjaxRequestBody, AjaxResponse, SpotPoint } from './types';
import { debug as debugLog } from './utils';

/**
 * Handles AJAX communication with the WordPress backend.
 * Replaces jQuery.post with the native fetch API.
 */
export class DataFetcher {
    private readonly ajaxUrl: string;
    private abortController: AbortController | null = null;
    private readonly dbg: ( ...args: unknown[] ) => void;

    constructor( ajaxUrl: string, debugEnabled = false ) {
        this.ajaxUrl = ajaxUrl;
        this.dbg = ( ...args ) => debugLog( debugEnabled, ...args );
    }

    /**
     * Fetch points from the server.
     *
     * @param body   - The request body for the AJAX endpoint.
     * @param filter - Optional minimum distance (meters) for point filtering.
     * @returns The array of points, possibly filtered. An empty array signals "empty: true".
     */
    async fetchPoints(
        body: AjaxRequestBody,
        filter?: number
    ): Promise< AjaxResponse > {
        this.abortController = new AbortController();

        // Use URLSearchParams to match jQuery.post's
        // application/x-www-form-urlencoded format.
        const params = new URLSearchParams();
        for ( const [ key, value ] of Object.entries( body ) ) {
            if ( value === undefined || value === null ) {
                continue;
            }
            if ( Array.isArray( value ) ) {
                value.forEach( ( item ) => {
                    params.append( `${ key }[]`, String( item ) );
                } );
            } else if ( typeof value === 'object' ) {
                for ( const [ subKey, subVal ] of Object.entries(
                    value as Record< string, unknown >
                ) ) {
                    params.append( `${ key }[${ subKey }]`, String( subVal ) );
                }
            } else {
                params.append( key, String( value ) );
            }
        }

        this.dbg( 'DataFetcher: POST', this.ajaxUrl, body );

        const res = await fetch( this.ajaxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
            signal: this.abortController.signal,
        } );

        if ( ! res.ok ) {
            this.dbg( `DataFetcher: HTTP ${ res.status } ${ res.statusText }` );
        }

        const response = ( await res.json() ) as AjaxResponse;

        if ( response.empty ) {
            this.dbg( 'DataFetcher: empty response' );
            return response;
        }

        if ( response.error ) {
            this.dbg( 'DataFetcher: error response', response );
            return response;
        }

        if ( filter && ! response.empty ) {
            const before = ( response as SpotPoint[] ).length;
            const filtered = DataFetcher.removeClosePoints(
                response as SpotPoint[],
                filter
            ) as AjaxResponse;
            this.dbg(
                `DataFetcher: filterPoints=${ filter }m — ${ before } → ${
                    ( filtered as SpotPoint[] ).length
                } points`
            );
            return filtered;
        }

        this.dbg(
            `DataFetcher: received ${
                ( response as SpotPoint[] ).length
            } points`
        );
        DataFetcher.applyServerHiddenCounts( response as SpotPoint[] );
        return response;
    }

    /**
     * Simplify a polyline using the Ramer-Douglas-Peucker algorithm.
     *
     * Non-track points (OK, HELP, SOS, etc.) are always kept; only consecutive
     * runs of TRACK points are simplified.
     * Removed points are not annotated — this is purely a render optimisation.
     *
     * @param points        - Input array in time order.
     * @param epsilonMeters - Maximum allowed perpendicular deviation (metres).
     */
    static rdpSimplify(
        points: SpotPoint[],
        epsilonMeters: number
    ): SpotPoint[] {
        if ( points.length <= 2 || epsilonMeters <= 0 ) {
            return points;
        }

        const isTrack = ( p: SpotPoint ) => p.type === 'TRACK';

        const result: SpotPoint[] = [];
        let i = 0;

        while ( i < points.length ) {
            if ( ! isTrack( points[ i ] ) ) {
                result.push( points[ i ] );
                i++;
            } else {
                const runStart = i;
                const runFeed = points[ i ].feed_name;
                while (
                    i < points.length &&
                    isTrack( points[ i ] ) &&
                    points[ i ].feed_name === runFeed
                ) {
                    i++;
                }
                const simplified = DataFetcher.rdpReduce(
                    points.slice( runStart, i ),
                    epsilonMeters
                );
                result.push( ...simplified );
            }
        }

        return result;
    }

    /** Recursive RDP core — assumes all points in the slice are track-type. */
    private static rdpReduce(
        points: SpotPoint[],
        epsilon: number
    ): SpotPoint[] {
        if ( points.length <= 2 ) {
            return points;
        }

        let maxDist = 0;
        let maxIdx = 0;
        const start = points[ 0 ];
        const end = points[ points.length - 1 ];

        for ( let i = 1; i < points.length - 1; i++ ) {
            const d = DataFetcher.pointToSegmentMeters(
                points[ i ],
                start,
                end
            );
            if ( d > maxDist ) {
                maxDist = d;
                maxIdx = i;
            }
        }

        if ( maxDist > epsilon ) {
            const left = DataFetcher.rdpReduce(
                points.slice( 0, maxIdx + 1 ),
                epsilon
            );
            const right = DataFetcher.rdpReduce(
                points.slice( maxIdx ),
                epsilon
            );
            return [ ...left.slice( 0, -1 ), ...right ];
        }

        return [ start, end ];
    }

    /**
     * Perpendicular distance (metres) from point `p` to the segment `a→b`,
     * using an equirectangular projection centred on the segment midpoint.
     * Accurate to <1 % for segments shorter than ~100 km.
     */
    private static pointToSegmentMeters(
        p: SpotPoint,
        a: SpotPoint,
        b: SpotPoint
    ): number {
        const DEG_TO_M = 111_320;
        const cosLat = Math.cos(
            ( ( a.latitude + b.latitude ) / 2 ) * ( Math.PI / 180 )
        );

        const ax = a.longitude * cosLat * DEG_TO_M;
        const ay = a.latitude * DEG_TO_M;
        const bx = b.longitude * cosLat * DEG_TO_M;
        const by = b.latitude * DEG_TO_M;
        const px = p.longitude * cosLat * DEG_TO_M;
        const py = p.latitude * DEG_TO_M;

        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;

        if ( lenSq === 0 ) {
            return Math.sqrt( ( px - ax ) ** 2 + ( py - ay ) ** 2 );
        }

        const t = Math.max(
            0,
            Math.min( 1, ( ( px - ax ) * dx + ( py - ay ) * dy ) / lenSq )
        );
        return Math.sqrt(
            ( px - ( ax + t * dx ) ) ** 2 + ( py - ( ay + t * dy ) ) ** 2
        );
    }

    /**
     * Remove points that are within `radius` meters of each other
     * and share the same type. Runs in O(n) by comparing each point
     * only to its nearest surviving predecessor.
     *
     * When a run of close points is collapsed, the first point in the
     * run gets a `hiddenPoints` annotation with the count and radius.
     */
    static removeClosePoints(
        points: SpotPoint[],
        radius: number
    ): SpotPoint[] {
        if ( points.length === 0 ) {
            return points;
        }

        // We build the result forward.
        // `anchor` is the last point we decided to keep.
        const result: SpotPoint[] = [ points[ 0 ] ];
        let anchor = points[ 0 ];
        let hiddenCount = 0;

        for ( let i = 1; i < points.length; i++ ) {
            const point = points[ i ];

            const distance = DataFetcher.haversineMeters(
                anchor.latitude,
                anchor.longitude,
                point.latitude,
                point.longitude
            );

            if (
                distance <= radius &&
                anchor.type === point.type &&
                anchor.feed_name === point.feed_name &&
                point.type !== 'MEDIA'
            ) {
                // Too close — hide this point behind the anchor
                hiddenCount++;
            } else {
                // Far enough (or different type) — flush the hidden count onto the anchor
                if ( hiddenCount > 0 ) {
                    anchor.hiddenPoints = { count: hiddenCount, radius };
                    hiddenCount = 0;
                }
                result.push( point );
                anchor = point;
            }
        }

        // Flush any remaining hidden points for the last anchor
        if ( hiddenCount > 0 ) {
            anchor.hiddenPoints = { count: hiddenCount, radius };
        }

        DataFetcher.applyServerHiddenCounts( result );
        return result;
    }

    /**
     * Folds server-side `hidden_points` (rolling-anchor suppression count)
     * into each point's `hiddenPoints` annotation so both server-suppressed
     * and client-filtered pings are reflected in the map popup.
     */
    static applyServerHiddenCounts( points: SpotPoint[] ): void {
        for ( const pt of points ) {
            const n = pt.hidden_points ?? 0;
            if ( n > 0 ) {
                pt.hiddenPoints = {
                    count: ( pt.hiddenPoints?.count ?? 0 ) + n,
                    radius: pt.hiddenPoints?.radius ?? 0,
                };
                pt.hidden_points = 0; // consumed — prevent double-adding on re-runs
            }
        }
    }

    /**
     * Fast great-circle distance approximation (Haversine) in metres.
     * Avoids constructing Leaflet objects in a tight loop.
     */
    private static haversineMeters(
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number
    ): number {
        const R = 6_371_000; // Earth radius in metres
        const toRad = ( deg: number ) => ( deg * Math.PI ) / 180;
        const dLat = toRad( lat2 - lat1 );
        const dLng = toRad( lng2 - lng1 );
        const a =
            Math.sin( dLat / 2 ) ** 2 +
            Math.cos( toRad( lat1 ) ) *
                Math.cos( toRad( lat2 ) ) *
                Math.sin( dLng / 2 ) ** 2;
        return R * 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) );
    }

    /**
     * Abort any in-flight requests.
     */
    abort(): void {
        this.abortController?.abort();
        this.abortController = null;
    }
}
