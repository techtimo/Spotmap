<?php

/**
 * Public ingestion endpoints for push-based tracking providers.
 *
 * Unlike the admin REST API (which requires manage_options), these routes are
 * intentionally public — authentication is handled via a per-feed pre-shared
 * key embedded in the URL.
 *
 * OsmAnd live-tracking endpoint:
 *   GET /wp-json/spotmap/v1/ingest/osmand
 *
 * Required params: key, lat, lon, timestamp
 * Optional params: hdop, altitude, speed, bearing, batproc
 *
 * The `key` param identifies the feed. Generate it when creating an OsmAnd
 * feed via the admin UI; it is stored in the feed's options entry.
 *
 * OsmAnd sends timestamp in milliseconds. All other numeric params are floats.
 * If OsmAnd cannot substitute a placeholder (e.g. {11} for batproc when
 * battery permission is denied) the literal string "{11}" is sent — treat
 * any value matching /^\{\d+\}$/ as absent.
 *
 * @see https://osmand.net/docs/user/plugins/trip-recording/#required-setup-parameters
 */
class Spotmap_Ingest {

	public static function register_routes(): void {
		register_rest_route(
			Spotmap_Rest_Api::NAMESPACE,
			'/ingest/osmand',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'handle_osmand' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	// -------------------------------------------------------------------------
	// OsmAnd handler
	// -------------------------------------------------------------------------

	public static function handle_osmand( WP_REST_Request $request ): WP_REST_Response {
		// 1. Resolve feed by pre-shared key.
		$key  = sanitize_text_field( $request->get_param( 'key' ) ?? '' );
		$feed = self::find_feed_by_key( $key );
		if ( $feed === null ) {
			return new WP_REST_Response( [ 'error' => 'Invalid key.' ], 401 );
		}

		if ( ! empty( $feed['paused'] ) ) {
			return new WP_REST_Response( [ 'error' => 'Feed is paused.' ], 400 );
		}

		// 2. Validate required params.
		$lat_raw = $request->get_param( 'lat' );
		$lon_raw = $request->get_param( 'lon' );
		$ts_raw  = $request->get_param( 'timestamp' );

		if ( self::is_unsubstituted( $lat_raw ) || self::is_unsubstituted( $lon_raw ) || self::is_unsubstituted( $ts_raw ) ) {
			return new WP_REST_Response( [ 'error' => 'lat, lon, and timestamp are required.' ], 400 );
		}
		if ( $lat_raw === null || $lon_raw === null || $ts_raw === null ) {
			return new WP_REST_Response( [ 'error' => 'lat, lon, and timestamp are required.' ], 400 );
		}

		$lat  = (float) $lat_raw;
		$lon  = (float) $lon_raw;

		// OsmAnd sends timestamp in milliseconds — convert to Unix seconds.
		$unix_ts = (int) round( (float) $ts_raw / 1000 );

		// 3. Build the DB row.
		$data = [
			'feed_name' => $feed['name'],
			'feed_id'   => $feed['id'],
			'type'      => 'TRACK',
			'time'      => $unix_ts,
			'latitude'  => $lat,
			'longitude' => $lon,
		];

		$altitude = self::optional_float( $request->get_param( 'altitude' ) );
		if ( $altitude !== null ) {
			$data['altitude'] = (int) round( $altitude );
		}

		$hdop = self::optional_float( $request->get_param( 'hdop' ) );
		if ( $hdop !== null ) {
			$data['hdop'] = $hdop;
		}

		$speed = self::optional_float( $request->get_param( 'speed' ) );
		if ( $speed !== null ) {
			$data['speed'] = $speed;
		}

		$bearing = self::optional_float( $request->get_param( 'bearing' ) );
		if ( $bearing !== null ) {
			$data['bearing'] = $bearing;
		}

		$batproc = self::optional_float( $request->get_param( 'batproc' ) );
		if ( $batproc !== null ) {
			$data['battery_status'] = (string) (int) round( $batproc );
		}

		// 4. Insert.
		$db     = new Spotmap_Database();
		$result = $db->insert_row( $data );

		if ( $result === false ) {
			return new WP_REST_Response( [ 'error' => 'Failed to store point.' ], 500 );
		}

		return new WP_REST_Response( [ 'ok' => true ], 200 );
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	/**
	 * Finds an OsmAnd feed by its pre-shared key.
	 *
	 * @param string $key
	 * @return array<string, mixed>|null Feed array, or null if not found.
	 */
	private static function find_feed_by_key( string $key ): ?array {
		if ( $key === '' ) {
			return null;
		}
		foreach ( Spotmap_Options::get_feeds() as $feed ) {
			if ( ( $feed['type'] ?? '' ) === 'osmand' && ( $feed['key'] ?? '' ) === $key ) {
				return $feed;
			}
		}
		return null;
	}

	/**
	 * Returns null if the value is absent, empty, or an unsubstituted OsmAnd
	 * placeholder like "{11}". Otherwise casts to float.
	 *
	 * @param mixed $value
	 * @return float|null
	 */
	private static function optional_float( $value ): ?float {
		if ( $value === null || $value === '' ) {
			return null;
		}
		if ( self::is_unsubstituted( $value ) ) {
			return null;
		}
		return (float) $value;
	}

	/**
	 * Returns true if $value looks like an unsubstituted OsmAnd placeholder,
	 * e.g. "{11}" or "{0}".
	 *
	 * @param mixed $value
	 * @return bool
	 */
	private static function is_unsubstituted( $value ): bool {
		return is_string( $value ) && (bool) preg_match( '/^\{\d+\}$/', $value );
	}
}
