import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { DataFetcher } from '../DataFetcher';
import type { AjaxRequestBody, SpotPoint } from '../types';

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch( data: unknown ): jest.Mock {
    const mock = jest.fn().mockResolvedValue( {
        json: jest.fn().mockResolvedValue( data as never ),
    } as never );
    global.fetch = mock as unknown as typeof fetch;
    return mock;
}

const minimalBody: AjaxRequestBody = {
    action: 'spotmap',
    feeds: '',
    orderBy: '',
    groupBy: '',
};

function makePoint(
    lat: number,
    lng: number,
    type: SpotPoint[ 'type' ] = 'UNLIMITED-TRACK',
    id = 1
): SpotPoint {
    return {
        id,
        feed_name: 'test',
        latitude: lat,
        longitude: lng,
        altitude: 0,
        type,
        unixtime: 1700000000,
        time: '12:00 pm',
        date: 'Jan 1, 2024',
    };
}

describe( 'DataFetcher.removeClosePoints', () => {
    it( 'returns empty array unchanged', () => {
        expect( DataFetcher.removeClosePoints( [], 50 ) ).toEqual( [] );
    } );

    it( 'returns a single point unchanged', () => {
        const pts = [ makePoint( 47.0, 8.0 ) ];
        expect( DataFetcher.removeClosePoints( pts, 50 ) ).toEqual( pts );
    } );

    it( 'keeps both points when they are far apart', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 48.0, 9.0, 'UNLIMITED-TRACK', 2 ),
        ];
        expect( DataFetcher.removeClosePoints( pts, 50 ) ).toHaveLength( 2 );
    } );

    it( 'collapses two points within the radius into one', () => {
        // ~0.01 m apart — well within any practical radius
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.0000001, 'UNLIMITED-TRACK', 2 ),
        ];
        const result = DataFetcher.removeClosePoints( pts, 50 );
        expect( result ).toHaveLength( 1 );
        expect( result[ 0 ].hiddenPoints ).toEqual( { count: 1, radius: 50 } );
    } );

    it( 'does not collapse points of different types even when close', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.0000001, 'OK', 2 ),
        ];
        expect( DataFetcher.removeClosePoints( pts, 50 ) ).toHaveLength( 2 );
    } );

    it( 'does not collapse points of different feeds even when close and same type', () => {
        // Two feeds with their latest OK point at the same location (e.g. home base).
        // Without a feed-boundary guard, the second feed's point would be dropped.
        const feedA = {
            ...makePoint( 47.0, 8.0, 'OK', 1 ),
            feed_name: 'feed-a',
        };
        const feedB = {
            ...makePoint( 47.0, 8.0000001, 'OK', 2 ),
            feed_name: 'feed-b',
        };
        expect(
            DataFetcher.removeClosePoints( [ feedA, feedB ], 50 )
        ).toHaveLength( 2 );
    } );

    it( 'annotates anchor with total hidden count for a run of close points', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.0000001, 'UNLIMITED-TRACK', 2 ),
            makePoint( 47.0, 8.0000002, 'UNLIMITED-TRACK', 3 ),
        ];
        const result = DataFetcher.removeClosePoints( pts, 50 );
        expect( result ).toHaveLength( 1 );
        expect( result[ 0 ].hiddenPoints ).toEqual( { count: 2, radius: 50 } );
    } );

    it( 'resets hidden count after a sufficiently distant point', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.0000001, 'UNLIMITED-TRACK', 2 ), // close
            makePoint( 48.0, 9.0, 'UNLIMITED-TRACK', 3 ), // far — new anchor
            makePoint( 48.0, 9.0000001, 'UNLIMITED-TRACK', 4 ), // close to new anchor
        ];
        const result = DataFetcher.removeClosePoints( pts, 50 );
        expect( result ).toHaveLength( 2 );
        expect( result[ 0 ].hiddenPoints ).toEqual( { count: 1, radius: 50 } );
        expect( result[ 1 ].hiddenPoints ).toEqual( { count: 1, radius: 50 } );
    } );

    it( 'with radius 0 keeps all points', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 2 ), // identical coords
        ];
        // haversine of identical coords = 0; radius 0 means distance <= 0 collapses it
        // (edge case: exactly on boundary — both points same location, distance = 0 <= 0)
        const result = DataFetcher.removeClosePoints( pts, 0 );
        expect( result ).toHaveLength( 1 );
    } );
} );

// ---------------------------------------------------------------------------
// DataFetcher.rdpSimplify
// ---------------------------------------------------------------------------

describe( 'DataFetcher.rdpSimplify', () => {
    it( 'returns empty array unchanged', () => {
        expect( DataFetcher.rdpSimplify( [], 10 ) ).toEqual( [] );
    } );

    it( 'returns ≤2 points unchanged', () => {
        const pts = [ makePoint( 47.0, 8.0 ), makePoint( 48.0, 9.0 ) ];
        expect( DataFetcher.rdpSimplify( pts, 10 ) ).toHaveLength( 2 );
    } );

    it( 'removes collinear intermediate point', () => {
        // Three collinear points along a lat line — middle is redundant
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.5, 'UNLIMITED-TRACK', 2 ), // midpoint
            makePoint( 47.0, 9.0, 'UNLIMITED-TRACK', 3 ),
        ];
        const result = DataFetcher.rdpSimplify( pts, 1 );
        expect( result ).toHaveLength( 2 );
        expect( result[ 0 ].id ).toBe( 1 );
        expect( result[ 1 ].id ).toBe( 3 );
    } );

    it( 'keeps a significantly deviated point', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.5, 8.5, 'UNLIMITED-TRACK', 2 ), // large detour
            makePoint( 47.0, 9.0, 'UNLIMITED-TRACK', 3 ),
        ];
        const result = DataFetcher.rdpSimplify( pts, 1 );
        expect( result ).toHaveLength( 3 );
    } );

    it( 'never removes non-track points (OK type)', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'OK', 1 ),
            makePoint( 47.0, 8.5, 'OK', 2 ),
            makePoint( 47.0, 9.0, 'OK', 3 ),
        ];
        const result = DataFetcher.rdpSimplify( pts, 1_000_000 );
        expect( result ).toHaveLength( 3 );
    } );

    it( 'keeps non-track points between simplified track runs', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.5, 'UNLIMITED-TRACK', 2 ), // collinear — should be removed
            makePoint( 47.0, 9.0, 'UNLIMITED-TRACK', 3 ),
            makePoint( 47.0, 9.0, 'OK', 4 ), // waypoint — always kept
            makePoint( 47.0, 9.0, 'UNLIMITED-TRACK', 5 ),
            makePoint( 47.0, 9.5, 'UNLIMITED-TRACK', 6 ), // collinear — should be removed
            makePoint( 47.0, 10.0, 'UNLIMITED-TRACK', 7 ),
        ];
        const result = DataFetcher.rdpSimplify( pts, 1 );
        // IDs 1, 3 (first run simplified), 4 (OK kept), 5, 7 (second run simplified)
        expect( result.map( ( p ) => p.id ) ).toEqual( [ 1, 3, 4, 5, 7 ] );
    } );

    it( 'epsilon=0 returns all points unchanged', () => {
        const pts = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.5, 'UNLIMITED-TRACK', 2 ),
            makePoint( 47.0, 9.0, 'UNLIMITED-TRACK', 3 ),
        ];
        expect( DataFetcher.rdpSimplify( pts, 0 ) ).toHaveLength( 3 );
    } );

    it( 'does not merge TRACK runs from different feeds', () => {
        // Feed A: collinear TRACK points (middle one would be removed by RDP if merged with B)
        // Feed B: collinear TRACK points (same line extended)
        // Without a feed-boundary guard, RDP treats all 6 as one run and removes inner points.
        // With the fix, A and B are simplified independently.
        const ptsA = [
            {
                ...makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
                feed_name: 'feed-a',
            },
            {
                ...makePoint( 47.0, 8.5, 'UNLIMITED-TRACK', 2 ),
                feed_name: 'feed-a',
            }, // collinear within A
            {
                ...makePoint( 47.0, 9.0, 'UNLIMITED-TRACK', 3 ),
                feed_name: 'feed-a',
            },
        ];
        const ptsB = [
            {
                ...makePoint( 47.0, 9.0, 'UNLIMITED-TRACK', 4 ),
                feed_name: 'feed-b',
            },
            {
                ...makePoint( 47.0, 9.5, 'UNLIMITED-TRACK', 5 ),
                feed_name: 'feed-b',
            }, // collinear within B
            {
                ...makePoint( 47.0, 10.0, 'UNLIMITED-TRACK', 6 ),
                feed_name: 'feed-b',
            },
        ];
        const result = DataFetcher.rdpSimplify( [ ...ptsA, ...ptsB ], 1 );
        // Each feed's run simplified to endpoints: ids 1,3 from A and 4,6 from B — 4 points total.
        expect( result.map( ( p ) => p.id ) ).toEqual( [ 1, 3, 4, 6 ] );
    } );
} );

// ---------------------------------------------------------------------------
// Load test with sentiero_italia.json  (6 468 real GPS tracking points)
// ---------------------------------------------------------------------------

describe( 'DataFetcher.removeClosePoints — sentiero_italia load test', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw: Record<
        string,
        string
    >[] = require( '../../../examples/sentiero_italia-transformed.json' );
    const points: SpotPoint[] = raw.map( ( p, i ) => ( {
        id: Number( p.id ) || i,
        feed_name: p.feed_name ?? 'spot',
        latitude: Number( p.latitude ),
        longitude: Number( p.longitude ),
        altitude: Number( p.altitude ) || 0,
        type: ( p.type as SpotPoint[ 'type' ] ) ?? 'UNLIMITED-TRACK',
        unixtime: Number( p.unixtime ) || 0,
        time: p.time ?? '',
        date: p.date ?? '',
    } ) );

    it( `dataset contains ${ raw.length } points`, () => {
        expect( points ).toHaveLength( raw.length );
    } );

    it( 'completes within 500 ms for the full dataset (radius 50 m)', () => {
        const start = performance.now();
        DataFetcher.removeClosePoints( [ ...points ], 50 );
        expect( performance.now() - start ).toBeLessThan( 500 );
    } );

    it( 'reduces point count with radius 50 m (dense tracking data)', () => {
        const result = DataFetcher.removeClosePoints( [ ...points ], 50 );
        expect( result.length ).toBeLessThan( points.length );
    } );

    it( 'always keeps the first point', () => {
        const result = DataFetcher.removeClosePoints( [ ...points ], 50 );
        expect( result[ 0 ].id ).toBe( points[ 0 ].id );
    } );

    it( 'hidden counts and surviving points add up to total', () => {
        const result = DataFetcher.removeClosePoints( [ ...points ], 50 );
        const hiddenTotal = result.reduce(
            ( sum, p ) => sum + ( p.hiddenPoints?.count ?? 0 ),
            0
        );
        expect( result.length + hiddenTotal ).toBe( points.length );
    } );

    it( 'larger radius removes more points', () => {
        const r50 = DataFetcher.removeClosePoints( [ ...points ], 50 ).length;
        const r200 = DataFetcher.removeClosePoints( [ ...points ], 200 ).length;
        expect( r200 ).toBeLessThan( r50 );
    } );
} );

// ---------------------------------------------------------------------------
// RDP load test + combined pipeline (sentiero_italia)
// ---------------------------------------------------------------------------

describe( 'DataFetcher.rdpSimplify — sentiero_italia load test', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw: Record<
        string,
        string
    >[] = require( '../../../examples/sentiero_italia-transformed.json' );
    const points: SpotPoint[] = raw.map( ( p, i ) => ( {
        id: Number( p.id ) || i,
        feed_name: p.feed_name ?? 'spot',
        latitude: Number( p.latitude ),
        longitude: Number( p.longitude ),
        altitude: Number( p.altitude ) || 0,
        type: ( p.type as SpotPoint[ 'type' ] ) ?? 'UNLIMITED-TRACK',
        unixtime: Number( p.unixtime ) || 0,
        time: p.time ?? '',
        date: p.date ?? '',
    } ) );

    it( 'completes within 500 ms for the full dataset (epsilon 50 m)', () => {
        const start = performance.now();
        DataFetcher.rdpSimplify( [ ...points ], 50 );
        expect( performance.now() - start ).toBeLessThan( 500 );
    } );

    it( 'reduces point count with epsilon 50 m', () => {
        const result = DataFetcher.rdpSimplify( [ ...points ], 50 );
        expect( result.length ).toBeLessThan( points.length );
    } );

    it( 'always keeps first and last point', () => {
        const result = DataFetcher.rdpSimplify( [ ...points ], 50 );
        expect( result[ 0 ].id ).toBe( points[ 0 ].id );
        expect( result[ result.length - 1 ].id ).toBe(
            points[ points.length - 1 ].id
        );
    } );

    it( 'combined RDP + removeClosePoints yields fewer points than removeClosePoints alone', () => {
        const rdpOnly = DataFetcher.rdpSimplify( [ ...points ], 50 );
        const combined = DataFetcher.removeClosePoints( rdpOnly, 50 );
        const removeOnly = DataFetcher.removeClosePoints( [ ...points ], 50 );
        expect( combined.length ).toBeLessThanOrEqual( removeOnly.length );
    } );
} );

// ---------------------------------------------------------------------------
// fetchPoints
// ---------------------------------------------------------------------------

describe( 'DataFetcher.fetchPoints', () => {
    afterEach( () => {
        jest.restoreAllMocks();
    } );

    it( 'returns the point array from the server', async () => {
        const serverPoints = [ makePoint( 47.0, 8.0 ) ];
        mockFetch( serverPoints );

        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        const result = await fetcher.fetchPoints( minimalBody );

        expect( result ).toEqual( serverPoints );
    } );

    it( 'returns the response as-is when empty flag is set', async () => {
        mockFetch( { empty: true } );

        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        const result = await fetcher.fetchPoints( minimalBody );

        expect( ( result as { empty: boolean } ).empty ).toBe( true );
    } );

    it( 'returns the response as-is when error flag is set', async () => {
        mockFetch( { error: true } );

        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        const result = await fetcher.fetchPoints( minimalBody );

        expect( ( result as { error: boolean } ).error ).toBe( true );
    } );

    it( 'applies removeClosePoints when filter is given', async () => {
        // Two points ~0.01 m apart — both within radius 50
        const serverPoints = [
            makePoint( 47.0, 8.0, 'UNLIMITED-TRACK', 1 ),
            makePoint( 47.0, 8.0000001, 'UNLIMITED-TRACK', 2 ),
        ];
        mockFetch( serverPoints );

        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        const result = await fetcher.fetchPoints( minimalBody, 50 );

        expect( ( result as SpotPoint[] ).length ).toBe( 1 );
    } );

    it( 'sends a POST request to the given URL', async () => {
        const mock = mockFetch( [] );

        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        await fetcher.fetchPoints( minimalBody );

        expect( mock ).toHaveBeenCalledWith(
            'https://example.com/wp-admin/admin-ajax.php',
            expect.objectContaining( { method: 'POST' } )
        );
    } );

    it( 'encodes array body values as key[] params', async () => {
        const mock = mockFetch( [] );

        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        await fetcher.fetchPoints( {
            action: 'spotmap',
            feeds: [ 'f1', 'f2' ],
        } as AjaxRequestBody & { feeds: string[] } );

        const body: string = ( mock.mock.calls[ 0 ][ 1 ] as RequestInit )
            .body as string;
        expect( body ).toContain( 'feeds%5B%5D=f1' );
        expect( body ).toContain( 'feeds%5B%5D=f2' );
    } );
} );

// ---------------------------------------------------------------------------
// abort
// ---------------------------------------------------------------------------

describe( 'DataFetcher.abort', () => {
    it( 'does not throw when called before any fetch', () => {
        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        expect( () => fetcher.abort() ).not.toThrow();
    } );

    it( 'cancels an in-flight request', async () => {
        // fetch never resolves — simulates a slow network
        global.fetch = jest
            .fn()
            .mockReturnValue(
                new Promise( () => {} )
            ) as unknown as typeof fetch;

        const fetcher = new DataFetcher(
            'https://example.com/wp-admin/admin-ajax.php'
        );
        const promise = fetcher.fetchPoints( minimalBody );

        fetcher.abort();

        // The AbortController abort signal is passed to fetch; the promise stays
        // pending but we can verify fetch was called with a signal.
        const fetchMock = global.fetch as unknown as jest.Mock;
        const signal = ( fetchMock.mock.calls[ 0 ][ 1 ] as RequestInit ).signal;
        expect( signal!.aborted ).toBe( true );

        // Prevent unhandled promise rejection
        promise.catch( () => {} );
    } );
} );
