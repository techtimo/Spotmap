<?php

/**
 * REST API endpoints for the Spotmap admin UI.
 *
 * All routes are under /wp-json/spotmap/v1/ and require manage_options.
 *
 * Feeds:
 *   GET    /feeds           → list all feeds
 *   POST   /feeds           → create a feed
 *   PUT    /feeds/(?P<id>[\w.]+)  → update a feed
 *   DELETE /feeds/(?P<id>[\w.]+)  → delete a feed
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
		return rest_ensure_response( Spotmap_Options::get_feeds() );
	}

	public static function create_feed( WP_REST_Request $request ) {
		$data = self::extract_feed_data( $request );

		$validation = self::validate_feed_data( $data );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		$feed = Spotmap_Options::add_feed( $data );
		return new WP_REST_Response( $feed, 201 );
	}

	public static function update_feed( WP_REST_Request $request ) {
		$id   = $request->get_param( 'id' );
		$data = self::extract_feed_data( $request );

		$validation = self::validate_feed_data( $data );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		$data['id'] = $id;
		if ( ! Spotmap_Options::update_feed( $id, $data ) ) {
			return new WP_Error( 'not_found', 'Feed not found.', [ 'status' => 404 ] );
		}

		return rest_ensure_response( $data );
	}

	public static function delete_feed( WP_REST_Request $request ) {
		$id = $request->get_param( 'id' );

		if ( ! Spotmap_Options::delete_feed( $id ) ) {
			return new WP_Error( 'not_found', 'Feed not found.', [ 'status' => 404 ] );
		}

		return new WP_REST_Response( null, 204 );
	}

	// -------------------------------------------------------------------------
	// Providers
	// -------------------------------------------------------------------------

	public static function get_providers( WP_REST_Request $request ) {
		return rest_ensure_response( Spotmap_Providers::all() );
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
			$sanitized[ $type ] = [
				'iconShape'     => sanitize_text_field( $config['iconShape'] ?? '' ),
				'icon'          => sanitize_text_field( $config['icon'] ?? '' ),
				'customMessage' => sanitize_text_field( $config['customMessage'] ?? '' ),
			];
		}

		Spotmap_Options::save_marker_options( $sanitized );
		return rest_ensure_response( Spotmap_Options::get_marker_options() );
	}

	// -------------------------------------------------------------------------
	// API Tokens
	// -------------------------------------------------------------------------

	public static function get_tokens( WP_REST_Request $request ) {
		return rest_ensure_response( Spotmap_Options::get_api_tokens() );
	}

	public static function update_tokens( WP_REST_Request $request ) {
		$body = self::json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$known    = array_keys( Spotmap_Options::get_api_token_defaults() );
		$sanitized = [];

		foreach ( $known as $key ) {
			$sanitized[ $key ] = isset( $body[ $key ] ) ? sanitize_text_field( $body[ $key ] ) : '';
		}

		Spotmap_Options::save_api_tokens( $sanitized );
		return rest_ensure_response( Spotmap_Options::get_api_tokens() );
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
}
