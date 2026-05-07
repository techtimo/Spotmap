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
class Spotmap_Ingest
{
    public static function register_routes(): void
    {
        register_rest_route(
            Spotmap_Rest_Api::NAMESPACE,
            '/ingest/osmand',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'handle_osmand' ],
                'permission_callback' => '__return_true',
            ]
        );
        register_rest_route(
            Spotmap_Rest_Api::NAMESPACE,
            '/ingest/teltonika',
            [
                'methods'             => [ WP_REST_Server::READABLE, WP_REST_Server::CREATABLE ],
                'callback'            => [ __CLASS__, 'handle_teltonika' ],
                'permission_callback' => '__return_true',
            ]
        );
    }

    // -------------------------------------------------------------------------
    // OsmAnd handler
    // -------------------------------------------------------------------------

    public static function handle_osmand(WP_REST_Request $request): WP_REST_Response
    {
        self::log_ingest_event(
            'osmand',
            'request_received',
            [ 'has_key' => $request->get_param('key') !== null ]
        );

        // 1. Resolve feed by pre-shared key.
        $key  = sanitize_text_field($request->get_param('key') ?? '');
        $feed = self::find_feed_by_key('osmand', $key);
        if ($feed === null) {
            self::log_ingest_event('osmand', 'invalid_key');
            return new WP_REST_Response([ 'error' => 'Invalid key.' ], 401);
        }

        if (! empty($feed['paused'])) {
            self::log_ingest_event('osmand', 'feed_paused', self::feed_context($feed));
            return new WP_REST_Response([ 'error' => 'Feed is paused.' ], 400);
        }

        $verification_response = self::maybe_build_verification_response('osmand', $request, $feed);
        if ($verification_response !== null) {
            self::log_ingest_event('osmand', 'verification_probe', self::feed_context($feed));
            return $verification_response;
        }

        // 2. Validate required params.
        $lat_raw = $request->get_param('lat');
        $lon_raw = $request->get_param('lon');
        $ts_raw  = $request->get_param('timestamp');

        if (self::is_unsubstituted($lat_raw) || self::is_unsubstituted($lon_raw) || self::is_unsubstituted($ts_raw)) {
            self::log_ingest_event('osmand', 'unsubstituted_params', self::feed_context($feed));
            return new WP_REST_Response([ 'error' => 'lat, lon, and timestamp are required.' ], 400);
        }
        if ($lat_raw === null || $lon_raw === null || $ts_raw === null) {
            self::log_ingest_event(
                'osmand',
                'missing_required_params',
                self::feed_context($feed) + [
                    'has_lat' => $lat_raw !== null ? 'yes' : 'no',
                    'has_lon' => $lon_raw !== null ? 'yes' : 'no',
                    'has_ts'  => $ts_raw !== null ? 'yes' : 'no',
                ]
            );
            return new WP_REST_Response([ 'error' => 'lat, lon, and timestamp are required.' ], 400);
        }

        $lat  = (float) $lat_raw;
        $lon  = (float) $lon_raw;

        // OsmAnd sends timestamp in milliseconds — convert to Unix seconds.
        $unix_ts = (int) round((float) $ts_raw / 1000);

        // 3. Build the DB row.
        $data = [
            'feed_name' => $feed['name'],
            'feed_id'   => $feed['id'],
            'type'      => 'TRACK',
            'time'      => $unix_ts,
            'latitude'  => $lat,
            'longitude' => $lon,
        ];

        $altitude = self::optional_float($request->get_param('altitude'));
        if ($altitude !== null) {
            $data['altitude'] = (int) round($altitude);
        }

        $hdop = self::optional_float($request->get_param('hdop'));
        if ($hdop !== null) {
            $data['hdop'] = $hdop;
        }

        $speed = self::optional_float($request->get_param('speed'));
        if ($speed !== null) {
            $data['speed'] = $speed;
        }

        $bearing = self::optional_float($request->get_param('bearing'));
        if ($bearing !== null) {
            $data['bearing'] = $bearing;
        }

        $batproc = self::optional_float($request->get_param('batproc'));
        if ($batproc !== null) {
            $data['battery_status'] = (string) (int) round($batproc);
        }

        // 4. Insert.
        $db     = new Spotmap_Database();
        $result = $db->insert_row($data);

        $point_context = self::feed_context($feed) + [
            'timestamp' => $unix_ts,
            'latitude'  => $lat,
            'longitude' => $lon,
        ];

        if ($result === false) {
            self::log_ingest_event('osmand', 'db_insert_failed', $point_context);
            return new WP_REST_Response([ 'error' => 'Failed to store point.' ], 500);
        }

        self::log_ingest_event('osmand', 'point_stored', $point_context);

        return new WP_REST_Response([ 'ok' => true ], 200);
    }

    // -------------------------------------------------------------------------
    // Teltonika handler
    // -------------------------------------------------------------------------

    /**
     * Receives a Teltonika GPS push.
     *
     * Endpoints:
     *   GET  /wp-json/spotmap/v1/ingest/teltonika?key=<auth_key>
     *   POST /wp-json/spotmap/v1/ingest/teltonika?key=<auth_key>
     *
     * The JSON body is a single-key object; the key name is ignored — only the
     * nested values matter for POST requests:
     *   {"<any>": {"latitude":…, "longitude":…, "timestamp":…, …}}
     *
     * Unlike OsmAnd, Teltonika sends timestamp in Unix seconds (not ms).
     */
    public static function handle_teltonika(WP_REST_Request $request): WP_REST_Response
    {
        // Log everything we have before any validation so we can see what Teltonika actually sends.
        $raw_body   = $request->get_body();
        $key_raw    = $request->get_param('key') ?? '';
        $key_masked = strlen($key_raw) > 4 ? substr($key_raw, 0, 4) . str_repeat('*', strlen($key_raw) - 4) : '(empty)';
        $ct         = $request->get_content_type();

        self::log_ingest_event(
            'teltonika',
            'request_received',
            [
                'method'       => $request->get_method(),
                'content_type' => is_array($ct) ? ($ct['value'] ?? '') : (string) $ct,
                'key_masked'   => $key_masked,
                'query_params' => array_diff_key($request->get_query_params(), [ 'key' => '' ]),
                'body_length'  => strlen($raw_body),
                'body_raw'     => substr($raw_body, 0, 2000),
                'json_parsed'  => $request->get_json_params(),
            ]
        );

        // 1. Resolve feed by pre-shared key.
        $key  = sanitize_text_field($request->get_param('key') ?? '');
        $feed = self::find_feed_by_key('teltonika', $key);
        if ($feed === null) {
            self::log_ingest_event('teltonika', 'invalid_key');
            return new WP_REST_Response([ 'error' => 'Invalid key.' ], 401);
        }

        if (! empty($feed['paused'])) {
            self::log_ingest_event('teltonika', 'feed_paused', self::feed_context($feed));
            return new WP_REST_Response([ 'error' => 'Feed is paused.' ], 400);
        }

        $verification_response = self::maybe_build_verification_response('teltonika', $request, $feed);
        if ($verification_response !== null) {
            self::log_ingest_event('teltonika', 'verification_probe', self::feed_context($feed));
            return $verification_response;
        }

        // 2. Build payload from wrapped JSON body.
        $payload = self::build_teltonika_payload($request);
        if ($payload === null) {
            $body_raw = $request->get_body();
            self::log_ingest_event(
                'teltonika',
                'invalid_payload',
                self::feed_context($feed) + [
                    'body_length' => strlen($body_raw),
                    'body_raw'    => substr($body_raw, 0, 500),
                    'json_params' => $request->get_json_params(),
                ]
            );
            return new WP_REST_Response([ 'error' => 'Invalid payload. Expected wrapped JSON body: {"<key>": {"latitude":…, "longitude":…, "timestamp":…}}.' ], 400);
        }

        self::log_ingest_event(
            'teltonika',
            'payload_parsed',
            self::feed_context($feed) + [ 'payload_keys' => array_keys($payload), 'payload' => $payload ]
        );

        // 3. Validate required fields.
        if (! isset($payload['latitude'], $payload['longitude'], $payload['timestamp'])) {
            self::log_ingest_event(
                'teltonika',
                'missing_required_fields',
                self::feed_context($feed) + [ 'keys' => implode(',', array_keys($payload)) ]
            );
            return new WP_REST_Response([ 'error' => 'latitude, longitude, and timestamp are required.' ], 400);
        }

        $lat     = (float) $payload['latitude'];
        $lon     = (float) $payload['longitude'];
        $unix_ts = (int) $payload['timestamp']; // already Unix seconds

        // 4. Build the DB row.
        $data = [
            'feed_name' => $feed['name'],
            'feed_id'   => $feed['id'],
            'type'      => 'TRACK',
            'time'      => $unix_ts,
            'latitude'  => $lat,
            'longitude' => $lon,
        ];

        if (isset($payload['altitude'])) {
            $data['altitude'] = (int) round((float) $payload['altitude']);
        }
        if (isset($payload['speed'])) {
            $data['speed'] = (float) $payload['speed'];
        }
        if (isset($payload['angle'])) {
            $data['bearing'] = (float) $payload['angle'];
        }
        if (isset($payload['accuracy'])) {
            $data['hdop'] = (float) $payload['accuracy'];
        }

        // 5. Insert.
        $db     = new Spotmap_Database();
        $result = $db->insert_row($data);

        $point_context = self::feed_context($feed) + [
            'timestamp' => $unix_ts,
            'latitude'  => $lat,
            'longitude' => $lon,
        ];

        if ($result === false) {
            self::log_ingest_event('teltonika', 'db_insert_failed', $point_context);
            return new WP_REST_Response([ 'error' => 'Failed to store point.' ], 500);
        }

        self::log_ingest_event('teltonika', 'point_stored', $point_context);

        return new WP_REST_Response([ 'ok' => true ], 200);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Finds a feed of the given type by its pre-shared key.
     *
     * @param string $type Feed type (e.g. 'osmand', 'teltonika').
     * @param string $key  Pre-shared key.
     * @return array<string, mixed>|null Feed array, or null if not found.
     */
    private static function find_feed_by_key(string $type, string $key): ?array
    {
        if ($key === '') {
            return null;
        }
        foreach (Spotmap_Options::get_feeds() as $feed) {
            if (($feed['type'] ?? '') === $type && ($feed['key'] ?? '') === $key) {
                return $feed;
            }
        }
        return null;
    }

    /**
     * Returns a small JSON response for GET-based endpoint verification.
     *
     * OsmAnd uses GET for real tracking updates, so only a request with the key
     * and no tracking params is treated as a verification probe.
     *
     * @param string               $type    Feed type.
     * @param WP_REST_Request      $request Current request.
     * @param array<string, mixed> $feed    Matched feed.
     * @return WP_REST_Response|null
     */
    private static function maybe_build_verification_response(string $type, WP_REST_Request $request, array $feed): ?WP_REST_Response
    {
        if ('GET' !== $request->get_method()) {
            return null;
        }

        if (! self::is_verification_request($type, $request)) {
            return null;
        }

        $provider_label = 'osmand' === $type ? 'OsmAnd' : 'Teltonika';

        return new WP_REST_Response(
            [
                'ok'      => true,
                'message' => sprintf('%s endpoint is reachable and the key is configured.', $provider_label),
                'feed'    => [
                    'id'   => $feed['id'] ?? '',
                    'name' => $feed['name'] ?? '',
                    'type' => $feed['type'] ?? $type,
                ],
            ],
            200
        );
    }

    /**
     * Returns true when the request should be treated as a verification probe.
     *
     * @param string          $type    Feed type.
     * @param WP_REST_Request $request Current request.
     * @return bool
     */
    private static function is_verification_request(string $type, WP_REST_Request $request): bool
    {
        if ('teltonika' === $type) {
            return true; // All GET requests to the teltonika endpoint are verification probes.
        }

        return null === $request->get_param('lat')
            && null === $request->get_param('lon')
            && null === $request->get_param('timestamp');
    }

    /**
     * Returns null if the value is absent, empty, or an unsubstituted OsmAnd
     * placeholder like "{11}". Otherwise casts to float.
     *
     * @param mixed $value
     * @return float|null
     */
    private static function optional_float($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (self::is_unsubstituted($value)) {
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
    private static function is_unsubstituted($value): bool
    {
        return is_string($value) && (bool) preg_match('/^\{\d+\}$/', $value);
    }

    /**
     * Extracts the inner payload from a Teltonika wrapped JSON POST body.
     *
     * Teltonika sends a single-key object whose key name is ignored:
     *   {"<any>": {"latitude":…, "longitude":…, "timestamp":…, …}}
     *
     * @param WP_REST_Request $request Current request.
     * @return array<string, mixed>|null
     */
    private static function build_teltonika_payload(WP_REST_Request $request): ?array
    {
        // get_json_params() only works when Content-Type is application/json.
        // Teltonika sends application/x-www-form-urlencoded despite the body being JSON,
        // so fall back to decoding the raw body directly.
        $body = $request->get_json_params();
        if (! is_array($body) || empty($body)) {
            $raw  = $request->get_body();
            $body = $raw !== '' ? json_decode($raw, true) : null;
        }
        if (! is_array($body) || empty($body)) {
            return null;
        }
        $payload = reset($body);
        return is_array($payload) ? $payload : null;
    }

    /**
     * Returns the standard feed_id/feed_name context array for a feed.
     *
     * @param array<string, mixed> $feed
     * @return array<string, string>
     */
    private static function feed_context(array $feed): array
    {
        return [
            'feed_id'   => (string) ($feed['id'] ?? ''),
            'feed_name' => (string) ($feed['name'] ?? ''),
        ];
    }

    /**
     * Logs ingest diagnostics when WP_DEBUG is enabled.
     *
     * @param string               $provider Ingest provider.
     * @param string               $event    Event identifier.
     * @param array<string, mixed> $context  Context values.
     * @return void
     */
    private static function log_ingest_event(string $provider, string $event, array $context = []): void
    {
        if (! defined('WP_DEBUG_LOG') || ! WP_DEBUG_LOG) {
            return;
        }

        $line = sprintf(
            '[spotmap] provider=%s event=%s context=%s',
            $provider,
            $event,
            wp_json_encode($context)
        );

        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
        error_log($line);
    }
}
