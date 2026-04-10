<?php

/**
 * REST API endpoints for the Spotmap admin UI.
 *
 * All routes are under /wp-json/spotmap/v1/ and require manage_options.
 *
 * Feeds:
 *   GET    /feeds                      → list all feeds (configured)
 *   POST   /feeds                      → create a feed
 *   PUT    /feeds/(?P<id>[\w.]+)       → update a feed
 *   DELETE /feeds/(?P<id>[\w.]+)       → delete a feed config (body: {delete_points: true} also purges DB rows)
 *
 * DB feeds (feed_name values that exist in the points table):
 *   GET    /db-feeds                   → list all feed_names in DB with point counts
 *   PATCH  /db-feeds                   → rename a feed_name in DB (body: {feed_name: "old", new_name: "new"})
 *   DELETE /db-feeds                   → delete all points for a feed_name (body: {feed_name: "..."})
 *   GET    /db-feeds/stats             → statistics for a feed_name (?feed_name=...)
 *
 * Providers:
 *   GET    /providers       → list provider type definitions
 *
 * Markers:
 *   GET    /markers         → get marker options (merged with defaults)
 *   PUT    /markers         → save marker options
 *
 * API Tokens:
 *   GET    /tokens          → get all API tokens (merged with defaults)
 *   PUT    /tokens          → save API tokens
 *
 * Default values:
 *   GET    /defaults        → get default block/shortcode values
 *   PUT    /defaults        → save default values
 */
class Spotmap_Rest_Api {

	const NAMESPACE = 'spotmap/v1';

	/**
	 * Sentinel value returned in place of stored credentials in GET responses.
	 * On PUT, if a client echoes this value back the server preserves the stored credential.
	 */
	const REDACTED = '__REDACTED__';

	public static function register_routes() {
		// --- Feeds ---
		register_rest_route(
			self::NAMESPACE,
			'/feeds',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_feeds' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ __CLASS__, 'create_feed' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
					'args'                => [ 'type' => [ 'type' => 'string', 'required' => true ] ],
				],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/feeds/(?P<id>[\w.]+)',
			[
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ __CLASS__, 'update_feed' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
					'args'                => [ 'type' => [ 'type' => 'string', 'required' => false ] ],
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ __CLASS__, 'delete_feed' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/feeds/(?P<id>[\w.]+)/import-photos',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'import_photos' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/feeds/(?P<id>[\w.]+)/pause',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'pause_feed' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/feeds/(?P<id>[\w.]+)/unpause',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'unpause_feed' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/feeds/(?P<id>[\w.]+)/stats',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'get_feed_stats' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
			]
		);

		// --- DB Feeds ---
		register_rest_route(
			self::NAMESPACE,
			'/db-feeds',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_db_feeds' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ __CLASS__, 'rename_db_feed' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ __CLASS__, 'delete_db_feed' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/db-feeds/stats',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'get_db_feed_stats' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/db-feeds/export-gpx',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'export_gpx' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
				'args'                => [
					'feed_name'   => [
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					],
					'split_hours' => [
						'type'    => 'number',
						'required' => false,
						'default' => 0,
					],
					'format'      => [
						'type'    => 'string',
						'required' => false,
						'default' => 'single',
						'enum'    => [ 'single', 'multi-track', 'zip' ],
					],
				],
			]
		);

		// --- Victron ---
		register_rest_route(
			self::NAMESPACE,
			'/victron/installations',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'get_victron_installations' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
				'args'                => [
					'token' => [
						'type'     => 'string',
						'required' => true,
					],
				],
			]
		);

		// --- Providers ---
		register_rest_route(
			self::NAMESPACE,
			'/providers',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'get_providers' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
			]
		);

		// --- Markers ---
		register_rest_route(
			self::NAMESPACE,
			'/markers',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_markers' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ __CLASS__, 'update_markers' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
			]
		);

		// --- API Tokens ---
		register_rest_route(
			self::NAMESPACE,
			'/tokens',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_tokens' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ __CLASS__, 'update_tokens' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
			]
		);

		// --- Points (position editing) ---
		register_rest_route(
			self::NAMESPACE,
			'/points',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'get_points' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/points/(?P<id>\d+)',
			[
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'update_point' ],
				'permission_callback' => [ __CLASS__, 'admin_permission' ],
				'args'                => [
					'id' => [ 'type' => 'integer', 'required' => true ],
				],
			]
		);

		// --- Defaults ---
		register_rest_route(
			self::NAMESPACE,
			'/defaults',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_defaults' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ __CLASS__, 'update_defaults' ],
					'permission_callback' => [ __CLASS__, 'admin_permission' ],
				],
			]
		);
	}

	// -------------------------------------------------------------------------
	// Permission
	// -------------------------------------------------------------------------

	public static function admin_permission() {
		return current_user_can( 'manage_options' );
	}

	// -------------------------------------------------------------------------
	// Feeds
	// -------------------------------------------------------------------------

	public static function get_feeds( WP_REST_Request $request ) {
		$db     = new Spotmap_Database();
		$counts = $db->get_point_counts_by_feed();
		$feeds  = array_map(
			function ( $feed ) use ( $counts ) {
				$decorated                = self::decorate_feed( $feed );
				$feed_counts              = $counts[ $feed['name'] ?? '' ] ?? [];
				$decorated['point_count'] = $feed_counts['count'] ?? 0;
				$decorated['first_point'] = $feed_counts['first_point'] ?? null;
				$decorated['last_point']  = $feed_counts['last_point']  ?? null;
				$decorated['paused']      = (bool) ( $feed['paused'] ?? false );
				return $decorated;
			},
			Spotmap_Options::get_feeds()
		);
		return rest_ensure_response( $feeds );
	}

	public static function create_feed( WP_REST_Request $request ) {
		$data = self::extract_feed_data( $request );

		$validation = self::validate_feed_data( $data );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		$live = self::validate_feed_with_provider( $data );
		if ( is_wp_error( $live ) ) {
			return $live;
		}

		// Push feeds authenticate via a per-feed pre-shared key in the URL.
		// Use the client-generated key when provided; fall back to server generation.
		$push_types = [ 'osmand', 'teltonika' ];
		if ( in_array( $data['type'] ?? '', $push_types, true ) && empty( $data['key'] ) ) {
			$data['key'] = bin2hex( random_bytes( 16 ) );
		}

		$feed = Spotmap_Options::add_feed( $data );

		// When a media feed is created, run the EXIF import immediately so existing
		// media library photos are picked up without waiting for cron.
		if ( ( $data['type'] ?? '' ) === 'media' ) {
			$admin = new Spotmap_Admin();
			$admin->import_existing_media();
		}

		return new WP_REST_Response( self::decorate_feed( $feed ), 201 );
	}

	public static function update_feed( WP_REST_Request $request ) {
		$id   = $request->get_param( 'id' );
		$data = self::extract_feed_data( $request );

		$validation = self::validate_feed_data( $data );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		// Preserve stored credentials if the client echoed the sentinel back.
		// $stored is lazy-initialized: the DB read is skipped entirely when no sentinel is present.
		$provider = Spotmap_Providers::get( $data['type'] ?? '' );
		if ( $provider ) {
			$stored = null;
			foreach ( $provider['fields'] as $field ) {
				if ( $field['type'] === 'password' && ( $data[ $field['key'] ] ?? '' ) === self::REDACTED ) {
					$stored ??= Spotmap_Options::get_feed( $id ) ?? [];
					$data[ $field['key'] ] = $stored[ $field['key'] ] ?? '';
				}
			}
		}

		$live = self::validate_feed_with_provider( $data );
		if ( is_wp_error( $live ) ) {
			return $live;
		}

		// OsmAnd: preserve the stored key (it is never sent back by the client).
		if ( ( $data['type'] ?? '' ) === 'osmand' ) {
			$stored ??= Spotmap_Options::get_feed( $id ) ?? [];
			$data['key'] = $stored['key'] ?? '';
		}

		// Preserve the paused state across edits — it is managed via dedicated endpoints.
		$stored       ??= Spotmap_Options::get_feed( $id ) ?? [];
		$old_name       = $stored['name'] ?? '';
		$data['paused'] = $stored['paused'] ?? false;

		$data['id'] = $id;
		if ( ! Spotmap_Options::update_feed( $id, $data ) ) {
			return new WP_Error( 'not_found', 'Feed not found.', [ 'status' => 404 ] );
		}

		// Rename DB rows so existing points follow the feed to its new name.
		$new_name = $data['name'] ?? '';
		if ( $old_name !== '' && $new_name !== '' && $old_name !== $new_name ) {
			$db = new Spotmap_Database();
			$db->rename_feed_name( $old_name, $new_name );
		}

		return rest_ensure_response( self::decorate_feed( $data ) );
	}

	public static function delete_feed( WP_REST_Request $request ) {
		$id   = $request->get_param( 'id' );
		$body = $request->get_json_params() ?? [];

		$feed = Spotmap_Options::get_feed( $id );
		if ( ! $feed ) {
			return new WP_Error( 'not_found', 'Feed not found.', [ 'status' => 404 ] );
		}

		if ( ! empty( $body['delete_points'] ) ) {
			$db = new Spotmap_Database();
			$db->delete_points_by_feed_name( $feed['name'] ?? '' );
		}

		Spotmap_Options::delete_feed( $id );

		return new WP_REST_Response( null, 204 );
	}

	public static function get_db_feeds( WP_REST_Request $request ) {
		$from   = sanitize_text_field( $request->get_param( 'from' ) ?? '' );
		$to     = sanitize_text_field( $request->get_param( 'to' ) ?? '' );
		$db     = new Spotmap_Database();
		$counts = $db->get_point_counts_by_feed( $from, $to );
		$result = [];
		foreach ( $counts as $feed_name => $data ) {
			$result[] = [
				'feed_name'   => $feed_name,
				'point_count' => $data['count'],
				'first_point' => $data['first_point'],
				'last_point'  => $data['last_point'],
			];
		}
		return rest_ensure_response( $result );
	}

	public static function rename_db_feed( WP_REST_Request $request ) {
		$body      = $request->get_json_params() ?? [];
		$feed_name = sanitize_text_field( $body['feed_name'] ?? '' );
		$new_name  = sanitize_text_field( $body['new_name'] ?? '' );

		if ( $feed_name === '' || $new_name === '' ) {
			return new WP_Error( 'missing_fields', 'feed_name and new_name are required.', [ 'status' => 400 ] );
		}

		global $wpdb;
		$db = new Spotmap_Database();
		$db->rename_feed_name( $feed_name, $new_name );

		$count = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . $wpdb->prefix . 'spotmap_points WHERE feed_name = %s',
				$new_name
			)
		);
		return rest_ensure_response( [
			'feed_name'   => $new_name,
			'point_count' => $count,
		] );
	}

	public static function delete_db_feed( WP_REST_Request $request ) {
		$body      = $request->get_json_params() ?? [];
		$feed_name = sanitize_text_field( $body['feed_name'] ?? '' );

		if ( $feed_name === '' ) {
			return new WP_Error( 'missing_feed_name', 'feed_name is required.', [ 'status' => 400 ] );
		}

		$db      = new Spotmap_Database();
		$deleted = $db->delete_points_by_feed_name( $feed_name );

		return rest_ensure_response( [ 'deleted' => $deleted ] );
	}

	public static function get_db_feed_stats( WP_REST_Request $request ) {
		$feed_name = sanitize_text_field( $request->get_param( 'feed_name' ) ?? '' );

		if ( $feed_name === '' ) {
			return new WP_Error( 'missing_feed_name', 'feed_name is required.', [ 'status' => 400 ] );
		}

		$db    = new Spotmap_Database();
		$stats = $db->get_feed_stats( $feed_name );

		return rest_ensure_response( $stats );
	}

	public static function export_gpx( WP_REST_Request $request ) {
		$feed_name   = $request->get_param( 'feed_name' );
		$split_hours = (float) ( $request->get_param( 'split_hours' ) ?? 0 );
		$format      = $request->get_param( 'format' ) ?? 'single';

		$db     = new Spotmap_Database();
		$filter = [
			'select'  => 'time, latitude, longitude, altitude',
			'feeds'   => [ $feed_name ],
			'orderBy' => 'time ASC',
		];
		$points = $db->get_points( $filter );

		if ( isset( $points['error'] ) ) {
			return new WP_Error( 'points_error', $points['title'] ?? 'Error fetching points.', [ 'status' => 422 ] );
		}

		if ( empty( $points ) ) {
			return new WP_Error( 'no_points', 'No GPS points found for this feed.', [ 'status' => 404 ] );
		}

		// Split points into segments by time gap.
		$segments = [];
		if ( $split_hours > 0 ) {
			$gap_seconds = (int) round( $split_hours * 3600 );
			$current_seg = [];
			$prev_time   = null;
			foreach ( $points as $point ) {
				$t = (int) $point->unixtime;
				if ( $prev_time !== null && ( $t - $prev_time ) > $gap_seconds ) {
					$segments[]  = $current_seg;
					$current_seg = [];
				}
				$current_seg[] = $point;
				$prev_time     = $t;
			}
			if ( ! empty( $current_seg ) ) {
				$segments[] = $current_seg;
			}
		} else {
			$segments = [ $points ];
		}

		$safe_name = self::sanitize_gpx_filename( $feed_name );

		if ( $format === 'zip' ) {
			if ( ! class_exists( 'ZipArchive' ) ) {
				return new WP_Error( 'zip_unavailable', 'ZIP export requires the ZipArchive PHP extension.', [ 'status' => 500 ] );
			}
			$tmp_file = wp_tempnam( 'spotmap_gpx' );
			$zip      = new ZipArchive();
			$zip->open( $tmp_file, ZipArchive::OVERWRITE );
			foreach ( $segments as $idx => $segment ) {
				$gpx_content  = self::build_gpx( $feed_name, [ $segment ] );
				$first_date   = isset( $segment[0] ) ? gmdate( 'Y-m-d', (int) $segment[0]->unixtime ) : ( $idx + 1 );
				$gpx_filename = $safe_name . '_track_' . ( $idx + 1 ) . '_' . $first_date . '.gpx';
				$zip->addFromString( $gpx_filename, $gpx_content );
			}
			$zip->close();
			$zip_content  = file_get_contents( $tmp_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			unlink( $tmp_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
			$zip_filename = $safe_name . '.zip';

			add_filter(
				'rest_pre_serve_request',
				static function () use ( $zip_content, $zip_filename ) {
					header( 'Content-Type: application/zip' );
					header( 'Content-Disposition: attachment; filename="' . $zip_filename . '"' );
					header( 'Content-Length: ' . strlen( $zip_content ) );
					echo $zip_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					return true;
				}
			);
		} else {
			$gpx_content  = self::build_gpx( $feed_name, $segments );
			$gpx_filename = $safe_name . '.gpx';

			add_filter(
				'rest_pre_serve_request',
				static function () use ( $gpx_content, $gpx_filename ) {
					header( 'Content-Type: application/gpx+xml; charset=UTF-8' );
					header( 'Content-Disposition: attachment; filename="' . $gpx_filename . '"' );
					header( 'Content-Length: ' . strlen( $gpx_content ) );
					echo $gpx_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					return true;
				}
			);
		}

		return new WP_REST_Response( null, 200 );
	}

	/**
	 * Build a GPX 1.1 XML string from an array of point segments.
	 *
	 * @param string   $feed_name  Track name.
	 * @param array[]  $segments   Each element is an array of point objects
	 *                             with latitude, longitude, altitude, unixtime.
	 * @return string
	 */
	private static function build_gpx( string $feed_name, array $segments ): string {
		$track_name = htmlspecialchars( $feed_name, ENT_XML1, 'UTF-8' );
		$out        = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		$out       .= '<gpx version="1.1" creator="Spotmap"' . "\n";
		$out       .= '  xmlns="http://www.topografix.com/GPX/1/1"' . "\n";
		$out       .= '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' . "\n";
		$out       .= '  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">' . "\n";
		$out       .= '  <trk>' . "\n";
		$out       .= '    <name>' . $track_name . '</name>' . "\n";

		foreach ( $segments as $segment ) {
			$out .= '    <trkseg>' . "\n";
			foreach ( $segment as $point ) {
				$lat  = number_format( (float) $point->latitude, 7, '.', '' );
				$lon  = number_format( (float) $point->longitude, 7, '.', '' );
				$time = gmdate( 'Y-m-d\TH:i:s\Z', (int) $point->unixtime );
				$out .= '      <trkpt lat="' . $lat . '" lon="' . $lon . '">' . "\n";
				if ( isset( $point->altitude ) && $point->altitude !== null && $point->altitude !== '' ) {
					$out .= '        <ele>' . (int) $point->altitude . '</ele>' . "\n";
				}
				$out .= '        <time>' . $time . '</time>' . "\n";
				$out .= '      </trkpt>' . "\n";
			}
			$out .= '    </trkseg>' . "\n";
		}

		$out .= '  </trk>' . "\n";
		$out .= '</gpx>' . "\n";

		return $out;
	}

	/**
	 * Sanitize a feed name for use as a filename (letters, numbers, hyphens, underscores only).
	 */
	private static function sanitize_gpx_filename( string $name ): string {
		$safe = preg_replace( '/[^a-zA-Z0-9_\-]/', '_', $name );
		return ( $safe !== '' && $safe !== null ) ? $safe : 'gpx_export';
	}

	public static function import_photos( WP_REST_Request $request ) {
		$id   = $request->get_param( 'id' );
		$feed = Spotmap_Options::get_feed( $id );

		if ( ! $feed ) {
			return new WP_Error( 'not_found', 'Feed not found.', [ 'status' => 404 ] );
		}
		if ( ( $feed['type'] ?? '' ) !== 'media' ) {
			return new WP_Error( 'invalid_type', 'This feed is not a media feed.', [ 'status' => 422 ] );
		}

		$admin    = new Spotmap_Admin();
		$imported = $admin->import_existing_media();

		return rest_ensure_response( [ 'imported' => $imported ] );
	}

	public static function pause_feed( WP_REST_Request $request ) {
		return self::set_feed_pause_state( $request, true );
	}

	public static function unpause_feed( WP_REST_Request $request ) {
		return self::set_feed_pause_state( $request, false );
	}

	private static function set_feed_pause_state( WP_REST_Request $request, bool $paused ) {
		$id = $request->get_param( 'id' );
		if ( ! Spotmap_Options::set_feed_paused( $id, $paused ) ) {
			return new WP_Error( 'not_found', 'Feed not found.', [ 'status' => 404 ] );
		}
		$feed           = self::decorate_feed( Spotmap_Options::get_feed( $id ) );
		$feed['paused'] = $paused;
		return rest_ensure_response( $feed );
	}

	public static function get_feed_stats( WP_REST_Request $request ) {
		$id   = $request->get_param( 'id' );
		$feed = Spotmap_Options::get_feed( $id );
		if ( ! $feed ) {
			return new WP_Error( 'not_found', 'Feed not found.', [ 'status' => 404 ] );
		}
		$db    = new Spotmap_Database();
		$stats = $db->get_feed_stats( $feed['name'] ?? '' );

		$stats['created_at'] = isset( $feed['created_at'] ) ? (int) $feed['created_at'] : null;
		$stats['updated_at'] = isset( $feed['updated_at'] ) ? (int) $feed['updated_at'] : null;

		return rest_ensure_response( $stats );
	}

	// -------------------------------------------------------------------------
	// Providers
	// -------------------------------------------------------------------------

	public static function get_providers( WP_REST_Request $request ) {
		return rest_ensure_response( Spotmap_Providers::all() );
	}

	// Victron
	// -------------------------------------------------------------------------

	/**
	 * Validates a Victron access token and returns the list of GPS-capable
	 * installations together with the token's expiry date.
	 *
	 * GET /victron/installations?token=<token>
	 *
	 * Response: { token_expires: <unix|null>, installations: [ { id, name } ] }
	 */
	public static function get_victron_installations( WP_REST_Request $request ) {
		$token   = $request->get_param( 'token' );
		$headers = [ 'X-Authorization' => 'Token ' . $token ];

		// 1. Validate token and get user ID.
		$me_resp = wp_remote_get(
			'https://vrmapi.victronenergy.com/v2/users/me',
			[ 'headers' => $headers, 'timeout' => 10 ]
		);
		if ( is_wp_error( $me_resp ) ) {
			return new WP_Error( 'network_error', 'Could not reach the Victron VRM API.', [ 'status' => 502 ] );
		}
		$me = json_decode( wp_remote_retrieve_body( $me_resp ), true );
		if ( empty( $me['success'] ) ) {
			return new WP_Error( 'invalid_token', 'Invalid access token.', [ 'status' => 401 ] );
		}
		$user_id         = (int) $me['user']['id'];
		$id_access_token = (int) $me['user']['idAccessToken'];

		// 2. Look up the token expiry.
		$token_expires = null;
		$tok_resp      = wp_remote_get(
			"https://vrmapi.victronenergy.com/v2/users/{$user_id}/accesstokens",
			[ 'headers' => $headers, 'timeout' => 10 ]
		);
		if ( ! is_wp_error( $tok_resp ) ) {
			$tok_json = json_decode( wp_remote_retrieve_body( $tok_resp ), true );
			foreach ( $tok_json['tokens'] ?? [] as $t ) {
				if ( (int) $t['idAccessToken'] === $id_access_token ) {
					$token_expires = isset( $t['expires'] ) ? (int) $t['expires'] : null;
					break;
				}
			}
		}

		// 3. Fetch installations and filter to those with active GPS.
		$inst_resp = wp_remote_get(
			"https://vrmapi.victronenergy.com/v2/users/{$user_id}/installations?extended=1",
			[ 'headers' => $headers, 'timeout' => 15 ]
		);
		if ( is_wp_error( $inst_resp ) ) {
			return new WP_Error( 'network_error', 'Could not fetch installations.', [ 'status' => 502 ] );
		}
		$inst_json     = json_decode( wp_remote_retrieve_body( $inst_resp ), true );
		$installations = [];
		foreach ( $inst_json['records'] ?? [] as $rec ) {
			$ext = [];
			foreach ( $rec['extended'] ?? [] as $e ) {
				$ext[ $e['code'] ] = $e;
			}
			if ( array_key_exists( 'lt', $ext ) ) {
				$installations[] = [
					'id'   => (int) $rec['idSite'],
					'name' => sanitize_text_field( $rec['name'] ?? '' ),
				];
			}
		}

		return rest_ensure_response( [
			'token_expires' => $token_expires,
			'installations' => $installations,
		] );
	}

	// -------------------------------------------------------------------------
	// Markers
	// -------------------------------------------------------------------------

	public static function get_markers( WP_REST_Request $request ) {
		return rest_ensure_response( Spotmap_Options::get_marker_options() );
	}

	public static function update_markers( WP_REST_Request $request ) {
		$body = self::json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$allowed_types = array_keys( Spotmap_Options::get_marker_defaults() );
		$sanitized     = [];

		foreach ( $body as $type => $config ) {
			if ( ! in_array( $type, $allowed_types, true ) ) {
				continue;
			}
			if ( ! is_array( $config ) ) {
				continue;
			}
			$icon = sanitize_text_field( $config['icon'] ?? '' );
			$sanitized[ $type ] = [
				'iconShape' => sanitize_text_field( $config['iconShape'] ?? '' ),
				'icon'      => $icon !== '' ? $icon : 'circle',
			];
		}

		Spotmap_Options::save_marker_options( $sanitized );
		return rest_ensure_response( Spotmap_Options::get_marker_options() );
	}

	// -------------------------------------------------------------------------
	// API Tokens
	// -------------------------------------------------------------------------

	public static function get_tokens( WP_REST_Request $request ) {
		return rest_ensure_response( self::mask_tokens( Spotmap_Options::get_api_tokens() ) );
	}

	public static function update_tokens( WP_REST_Request $request ) {
		$body = self::json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$known    = array_keys( Spotmap_Options::get_api_token_defaults() );
		$stored   = Spotmap_Options::get_api_tokens();
		$sanitized = [];

		foreach ( $known as $key ) {
			$value = isset( $body[ $key ] ) ? sanitize_text_field( $body[ $key ] ) : '';
			// If the client echoed the sentinel back, preserve the stored token.
			$sanitized[ $key ] = ( $value === self::REDACTED ) ? ( $stored[ $key ] ?? '' ) : $value;
		}

		Spotmap_Options::save_api_tokens( $sanitized );
		return rest_ensure_response( self::mask_tokens( Spotmap_Options::get_api_tokens() ) );
	}

	// -------------------------------------------------------------------------
	// Defaults
	// -------------------------------------------------------------------------

	public static function get_defaults( WP_REST_Request $request ) {
		return rest_ensure_response( Spotmap_Options::get_settings() );
	}

	public static function update_defaults( WP_REST_Request $request ) {
		$body = self::json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$known     = array_keys( Spotmap_Options::get_settings_defaults() );
		$sanitized = [];

		foreach ( $known as $key ) {
			if ( ! array_key_exists( $key, $body ) ) {
				continue;
			}
			$value = $body[ $key ];
			// Preserve numeric types for numeric settings.
			if ( is_int( $value ) || is_float( $value ) ) {
				$sanitized[ $key ] = $value;
			} elseif ( is_null( $value ) ) {
				$sanitized[ $key ] = null;
			} else {
				$sanitized[ $key ] = sanitize_text_field( $value );
			}
		}

		Spotmap_Options::save_settings( $sanitized );
		return rest_ensure_response( Spotmap_Options::get_settings() );
	}

	// -------------------------------------------------------------------------
	// Points (position editing)
	// -------------------------------------------------------------------------

	public static function get_points( WP_REST_Request $request ) {
		$feed = sanitize_text_field( $request->get_param( 'feed' ) ?? '' );
		if ( $feed === '' ) {
			return new WP_Error( 'missing_feed', 'A feed name is required.', [ 'status' => 400 ] );
		}

		$filter = [
			'select'  => '*',
			'feeds'   => [ $feed ],
			'orderBy' => 'time',
			'groupBy' => '',
		];

		$from = sanitize_text_field( $request->get_param( 'from' ) ?? '' );
		$to   = sanitize_text_field( $request->get_param( 'to' ) ?? '' );
		if ( $from !== '' || $to !== '' ) {
			$filter['date-range'] = [ 'from' => $from, 'to' => $to ];
		}

		$db     = new Spotmap_Database();
		$points = $db->get_points( $filter );

		if ( isset( $points['error'] ) ) {
			return new WP_Error( 'points_error', $points['title'] ?? 'Error fetching points.', [ 'status' => 422 ] );
		}

		return rest_ensure_response( $points );
	}

	public static function update_point( WP_REST_Request $request ) {
		$id   = (int) $request->get_param( 'id' );
		$body = self::json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		if ( ! isset( $body['latitude'] ) || ! isset( $body['longitude'] ) ) {
			return new WP_Error( 'missing_fields', 'latitude and longitude are required.', [ 'status' => 400 ] );
		}

		$latitude  = (float) $body['latitude'];
		$longitude = (float) $body['longitude'];

		$db = new Spotmap_Database();
		if ( ! $db->update_point_position( $id, $latitude, $longitude ) ) {
			return new WP_Error( 'update_failed', 'Failed to update point position — invalid coordinates or DB error.', [ 'status' => 500 ] );
		}

		return rest_ensure_response( [ 'id' => $id, 'latitude' => $latitude, 'longitude' => $longitude ] );
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	/**
	 * Extracts and sanitizes provider-agnostic feed fields from the request.
	 * Provider-specific fields are passed through sanitize_text_field.
	 *
	 * @param WP_REST_Request $request
	 * @return array<string, mixed>
	 */
	private static function extract_feed_data( WP_REST_Request $request ) {
		$body     = $request->get_json_params() ?? [];
		$type     = sanitize_key( $body['type'] ?? '' );
		$provider = Spotmap_Providers::get( $type );
		$data     = [ 'type' => $type ];

		if ( $provider ) {
			foreach ( $provider['fields'] as $field ) {
				$key          = $field['key'];
				$raw          = $body[ $key ] ?? '';
				$data[ $key ] = $field['type'] === 'password'
					? $raw  // passwords are not run through sanitize_text_field
					: sanitize_text_field( $raw );
			}
		}

		// For push-type feeds the pre-shared key is generated client-side and must
		// be round-tripped so the URL shown before save matches what is stored.
		$push_types = [ 'osmand', 'teltonika' ];
		if ( in_array( $type, $push_types, true ) && ! empty( $body['key'] ) ) {
			$data['key'] = sanitize_text_field( $body['key'] );
		}

		// Victron: installation_id and installation_name are set by the picker, not a text field.
		if ( $type === 'victron' ) {
			$data['installation_id']   = sanitize_text_field( $body['installation_id'] ?? '' );
			$data['installation_name'] = sanitize_text_field( $body['installation_name'] ?? '' );
		}

		// Per-feed custom message overrides (findmespot only).
		if ( $type === 'findmespot' && isset( $body['custom_messages'] ) && is_array( $body['custom_messages'] ) ) {
			$allowed_msg_types = [ 'OK', 'HELP', 'CUSTOM' ];
			$messages          = [];
			foreach ( $allowed_msg_types as $msg_type ) {
				if ( array_key_exists( $msg_type, $body['custom_messages'] ) ) {
					$messages[ $msg_type ] = sanitize_text_field( $body['custom_messages'][ $msg_type ] );
				}
			}
			$data['custom_messages'] = $messages;
		}

		return $data;
	}

	/**
	 * Validates a feed data array against its provider schema.
	 * Returns WP_Error on failure, true on success.
	 *
	 * @param array<string, mixed> $data
	 * @return true|WP_Error
	 */
	private static function validate_feed_data( array $data ) {
		$type     = $data['type'] ?? '';
		$provider = Spotmap_Providers::get( $type );

		if ( ! $provider ) {
			return new WP_Error(
				'invalid_type',
				sprintf( 'Unknown provider type: %s', $type ),
				[ 'status' => 422 ]
			);
		}

		foreach ( $provider['fields'] as $field ) {
			if ( $field['required'] && empty( $data[ $field['key'] ] ) ) {
				return new WP_Error(
					'missing_field',
					sprintf( '"%s" is required.', $field['label'] ),
					[ 'status' => 422 ]
				);
			}
		}

		if ( $type === 'victron' && empty( $data['installation_id'] ) ) {
			return new WP_Error( 'missing_field', '"Installation" is required.', [ 'status' => 422 ] );
		}

		return true;
	}

	/**
	 * Probes the provider's live API to verify the feed credentials are accepted.
	 * Returns WP_Error with status 422 when the provider reports an unknown feed ID (E-0160).
	 * Network failures are silently allowed so a temporary outage does not block saving.
	 *
	 * @param array<string, mixed> $data Sanitized feed data (REDACTED already resolved for update).
	 * @return true|WP_Error
	 */
	private static function validate_feed_with_provider( array $data ) {
		$type = $data['type'] ?? '';

		if ( $type === 'victron' ) {
			$token = $data['token'] ?? '';
			if ( empty( $token ) ) {
				return true;
			}
			$response = wp_remote_get(
				'https://vrmapi.victronenergy.com/v2/users/me',
				[ 'headers' => [ 'X-Authorization' => 'Token ' . $token ], 'timeout' => 10 ]
			);
			if ( is_wp_error( $response ) ) {
				return true; // Network error — don't block saving.
			}
			$json = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( empty( $json['success'] ) ) {
				return new WP_Error(
					'invalid_token',
					'The Victron access token is invalid. Please check it and try again.',
					[ 'status' => 422 ]
				);
			}
		}

		if ( $type === 'findmespot' ) {
			$feed_id  = $data['feed_id'] ?? '';
			$password = $data['password'] ?? '';

			$url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'
				. rawurlencode( $feed_id ) . '/message.json';
			if ( ! empty( $password ) ) {
				$url .= '?feedPassword=' . rawurlencode( $password );
			}

			$response = wp_remote_get( $url, [ 'timeout' => 10 ] );
			if ( is_wp_error( $response ) ) {
				return true; // Network error — don't block saving.
			}

			$json = json_decode( wp_remote_retrieve_body( $response ), true );
			$code = $json['response']['errors']['error']['code'] ?? '';

			if ( $code === 'E-0160' ) {
				return new WP_Error(
					'invalid_feed_id',
					'The Feed ID was not found on findmespot.com. Please check it and try again.',
					[ 'status' => 422 ]
				);
			}
		}

		return true;
	}

	/**
	 * Parses and returns the JSON request body, or a 400 WP_Error if it is not a JSON object.
	 *
	 * @param WP_REST_Request $request
	 * @return array<string, mixed>|WP_Error
	 */
	private static function json_body( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			return new WP_Error( 'invalid_body', 'Expected a JSON object.', [ 'status' => 400 ] );
		}
		return $body;
	}

	/**
	 * Applies mask_feed() then appends computed display fields.
	 *
	 * For OsmAnd feeds: adds `tracking_url` — the full URL the user pastes into
	 * the OsmAnd app. The pre-shared key is intentionally included in plain text
	 * (it is not a secret; the URL itself must be copyable).
	 *
	 * @param array<string, mixed> $feed
	 * @return array<string, mixed>
	 */
	private static function decorate_feed( array $feed ): array {
		$feed = self::mask_feed( $feed );
		if ( ( $feed['type'] ?? '' ) === 'osmand' && ! empty( $feed['key'] ) ) {
			$base                  = rest_url( self::NAMESPACE . '/ingest/osmand' );
			$feed['tracking_url']  = add_query_arg( 'key', $feed['key'], $base )
				. '&lat={0}&lon={1}&timestamp={2}&hdop={3}&altitude={4}&speed={5}&bearing={6}&batproc={11}';
		}
		if ( ( $feed['type'] ?? '' ) === 'teltonika' && ! empty( $feed['key'] ) ) {
			$base                 = rest_url( self::NAMESPACE . '/ingest/teltonika' );
			$feed['tracking_url'] = add_query_arg( 'key', $feed['key'], $base );
		}
		return $feed;
	}

	/**
	 * Applies decorate_feed() to every feed in the array.
	 *
	 * @param list<array<string, mixed>> $feeds
	 * @return list<array<string, mixed>>
	 */
	private static function decorate_feeds( array $feeds ): array {
		return array_map( [ __CLASS__, 'decorate_feed' ], $feeds );
	}

	/**
	 * Replaces non-empty password fields in a single feed with the REDACTED sentinel.
	 *
	 * @param array<string, mixed> $feed
	 * @return array<string, mixed>
	 */
	private static function mask_feed( array $feed ): array {
		$provider = Spotmap_Providers::get( $feed['type'] ?? '' );
		if ( ! $provider ) {
			return $feed;
		}
		foreach ( $provider['fields'] as $field ) {
			if ( $field['type'] === 'password' && ! empty( $feed[ $field['key'] ] ) ) {
				$feed[ $field['key'] ] = self::REDACTED;
			}
		}
		return $feed;
	}

	/**
	 * Applies mask_feed() to every feed in the array.
	 *
	 * @param list<array<string, mixed>> $feeds
	 * @return list<array<string, mixed>>
	 */
	private static function mask_feeds( array $feeds ): array {
		return array_map( [ __CLASS__, 'mask_feed' ], $feeds );
	}

	/**
	 * Replaces non-empty token values with the REDACTED sentinel.
	 *
	 * @param array<string, string> $tokens
	 * @return array<string, string>
	 */
	private static function mask_tokens( array $tokens ): array {
		return array_map(
			fn( $v ) => ( is_string( $v ) && $v !== '' ) ? self::REDACTED : $v,
			$tokens
		);
	}
}
