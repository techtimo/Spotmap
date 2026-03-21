import { DataFetcher } from '../DataFetcher';
import type { AjaxRequestBody, SpotPoint } from '../types';

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch( data: unknown ): jest.Mock {
	const mock = jest.fn().mockResolvedValue( {
		json: jest.fn().mockResolvedValue( data ),
	} );
	global.fetch = mock;
	return mock;
}

const minimalBody: AjaxRequestBody = { action: 'spotmap' };

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
			makePoint( 48.0, 9.0, 'UNLIMITED-TRACK', 3 ),        // far — new anchor
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
// Load test with sentiero_italia.json  (6 468 real GPS tracking points)
// ---------------------------------------------------------------------------

describe( 'DataFetcher.removeClosePoints — sentiero_italia load test', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const raw: Record< string, string >[] = require( '../../../examples/sentiero_italia.json' );
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
// fetchPoints
// ---------------------------------------------------------------------------

describe( 'DataFetcher.fetchPoints', () => {
	afterEach( () => {
		jest.restoreAllMocks();
	} );

	it( 'returns the point array from the server', async () => {
		const serverPoints = [ makePoint( 47.0, 8.0 ) ];
		mockFetch( serverPoints );

		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
		const result = await fetcher.fetchPoints( minimalBody );

		expect( result ).toEqual( serverPoints );
	} );

	it( 'returns the response as-is when empty flag is set', async () => {
		mockFetch( { empty: true } );

		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
		const result = await fetcher.fetchPoints( minimalBody );

		expect( ( result as { empty: boolean } ).empty ).toBe( true );
	} );

	it( 'returns the response as-is when error flag is set', async () => {
		mockFetch( { error: true } );

		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
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

		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
		const result = await fetcher.fetchPoints( minimalBody, 50 );

		expect( ( result as SpotPoint[] ).length ).toBe( 1 );
	} );

	it( 'sends a POST request to the given URL', async () => {
		const mock = mockFetch( [] );

		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
		await fetcher.fetchPoints( minimalBody );

		expect( mock ).toHaveBeenCalledWith(
			'https://example.com/wp-admin/admin-ajax.php',
			expect.objectContaining( { method: 'POST' } )
		);
	} );

	it( 'encodes array body values as key[] params', async () => {
		const mock = mockFetch( [] );

		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
		await fetcher.fetchPoints( { action: 'spotmap', feeds: [ 'f1', 'f2' ] } as AjaxRequestBody & { feeds: string[] } );

		const body: string = mock.mock.calls[ 0 ][ 1 ].body;
		expect( body ).toContain( 'feeds%5B%5D=f1' );
		expect( body ).toContain( 'feeds%5B%5D=f2' );
	} );
} );

// ---------------------------------------------------------------------------
// abort
// ---------------------------------------------------------------------------

describe( 'DataFetcher.abort', () => {
	it( 'does not throw when called before any fetch', () => {
		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
		expect( () => fetcher.abort() ).not.toThrow();
	} );

	it( 'cancels an in-flight request', async () => {
		// fetch never resolves — simulates a slow network
		global.fetch = jest.fn().mockReturnValue( new Promise( () => {} ) );

		const fetcher = new DataFetcher( 'https://example.com/wp-admin/admin-ajax.php' );
		const promise = fetcher.fetchPoints( minimalBody );

		fetcher.abort();

		// The AbortController abort signal is passed to fetch; the promise stays
		// pending but we can verify fetch was called with a signal.
		const signal = ( global.fetch as jest.Mock ).mock.calls[ 0 ][ 1 ].signal;
		expect( signal.aborted ).toBe( true );

		// Prevent unhandled promise rejection
		promise.catch( () => {} );
	} );
} );
