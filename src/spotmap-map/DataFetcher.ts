import type { AjaxRequestBody, AjaxResponse, SpotPoint } from './types';

/**
 * Handles AJAX communication with the WordPress backend.
 * Replaces jQuery.post with the native fetch API.
 */
export class DataFetcher {
	private readonly ajaxUrl: string;
	private abortController: AbortController | null = null;

	constructor( ajaxUrl: string ) {
		this.ajaxUrl = ajaxUrl;
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
					params.append(
						`${ key }[${ subKey }]`,
						String( subVal )
					);
				}
			} else {
				params.append( key, String( value ) );
			}
		}

		const res = await fetch( this.ajaxUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params.toString(),
			signal: this.abortController.signal,
		} );

		const response = ( await res.json() ) as AjaxResponse;

		if ( response.empty ) {
			return response;
		}

		if ( response.error ) {
			return response;
		}

		if ( filter && ! response.empty ) {
			return DataFetcher.removeClosePoints(
				response,
				filter
			) as AjaxResponse;
		}

		return response;
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

			if ( distance <= radius && anchor.type === point.type ) {
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

		return result;
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
