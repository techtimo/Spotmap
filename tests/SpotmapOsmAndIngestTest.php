<?php

/**
 * Tests for the OsmAnd live-tracking ingestion endpoint.
 *
 * Covers:
 *   - Key-based feed resolution (401 on bad/missing key)
 *   - Required param validation (400 on missing lat/lon/timestamp)
 *   - Unsubstituted OsmAnd placeholders treated as absent
 *   - Timestamp milliseconds → Unix seconds conversion
 *   - Optional fields (hdop, speed, bearing, altitude, batproc) stored correctly
 *   - batproc unsubstituted placeholder → battery_status not stored
 *   - REST API feed create: key auto-generated, tracking_url returned
 *   - REST API feed update: key preserved
 */
class SpotmapOsmAndIngestTest extends WP_UnitTestCase
{
    private static \ReflectionProperty $cache_prop;
    private static int $admin_id;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        Spotmap_Rest_Api::register_routes();
        Spotmap_Ingest::register_routes();
        self::$cache_prop = (new ReflectionClass(Spotmap_Options::class))->getProperty('cache');
        self::$admin_id   = self::factory()->user->create([ 'role' => 'administrator' ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        self::$cache_prop->setValue(null, []);
        // Clean stored feeds between tests.
        delete_option('spotmap_feeds');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Dispatches a GET request to the OsmAnd ingest endpoint. */
    private function ingest(array $params): WP_REST_Response
    {
        $request = new WP_REST_Request('GET', '/spotmap/v1/ingest/osmand');
        foreach ($params as $k => $v) {
            $request->set_param($k, $v);
        }
        return rest_get_server()->dispatch($request);
    }

    /** Dispatches a request to the admin REST API (requires admin user). */
    private function admin_request(string $method, string $route, array $body = []): WP_REST_Response
    {
        $request = new WP_REST_Request($method, '/spotmap/v1' . $route);
        if (! empty($body)) {
            $request->set_header('Content-Type', 'application/json');
            $request->set_body(wp_json_encode($body));
        }
        return rest_get_server()->dispatch($request);
    }

    /** Stores an OsmAnd feed with a known key and returns the feed array. */
    private function seed_osmand_feed(string $name = 'MyPhone', string $key = 'abc123testkey'): array
    {
        $feed = [
            'id'   => uniqid('feed_', true),
            'type' => 'osmand',
            'name' => $name,
            'key'  => $key,
        ];
        Spotmap_Options::save_feeds([ $feed ]);
        self::$cache_prop->setValue(null, []);
        return $feed;
    }

    /** Returns all rows from the points table for the given feed name. */
    private function get_points(string $feed_name): array
    {
        global $wpdb;
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = %s ORDER BY id DESC",
                $feed_name
            ),
            ARRAY_A
        );
    }

    // -------------------------------------------------------------------------
    // Authorization
    // -------------------------------------------------------------------------

    public function test_missing_key_returns_401(): void
    {
        $response = $this->ingest([
            'lat'       => '47.766',
            'lon'       => '11.632',
            'timestamp' => '1774544316000',
        ]);
        $this->assertSame(401, $response->get_status());
    }

    public function test_wrong_key_returns_401(): void
    {
        $this->seed_osmand_feed('MyPhone', 'correctkey');

        $response = $this->ingest([
            'key'       => 'wrongkey',
            'lat'       => '47.766',
            'lon'       => '11.632',
            'timestamp' => '1774544316000',
        ]);
        $this->assertSame(401, $response->get_status());
    }

    public function test_valid_key_resolves_feed(): void
    {
        $this->seed_osmand_feed('MyPhone', 'validkey42');

        $response = $this->ingest([
            'key'       => 'validkey42',
            'lat'       => '47.766',
            'lon'       => '11.632',
            'timestamp' => '1774544316000',
        ]);
        $this->assertSame(200, $response->get_status());
    }

    public function test_get_with_only_key_returns_verification_message(): void
    {
        $this->seed_osmand_feed('MyPhone', 'verifykey42');

        $response = $this->ingest([
            'key' => 'verifykey42',
        ]);

        $this->assertSame(200, $response->get_status());
        $this->assertSame(
            [
                'ok'      => true,
                'message' => 'OsmAnd endpoint is reachable and the key is configured.',
                'feed'    => [
                    'id'   => Spotmap_Options::get_feeds()[0]['id'],
                    'name' => 'MyPhone',
                    'type' => 'osmand',
                ],
            ],
            $response->get_data()
        );

        $this->assertCount(0, $this->get_points('MyPhone'));
    }

    // -------------------------------------------------------------------------
    // Required parameter validation
    // -------------------------------------------------------------------------

    public function test_missing_lat_returns_400(): void
    {
        $this->seed_osmand_feed('MyPhone', 'k1');

        $response = $this->ingest([
            'key'       => 'k1',
            'lon'       => '11.632',
            'timestamp' => '1774544316000',
        ]);
        $this->assertSame(400, $response->get_status());
    }

    public function test_missing_lon_returns_400(): void
    {
        $this->seed_osmand_feed('MyPhone', 'k2');

        $response = $this->ingest([
            'key'       => 'k2',
            'lat'       => '47.766',
            'timestamp' => '1774544316000',
        ]);
        $this->assertSame(400, $response->get_status());
    }

    public function test_missing_timestamp_returns_400(): void
    {
        $this->seed_osmand_feed('MyPhone', 'k3');

        $response = $this->ingest([
            'key' => 'k3',
            'lat' => '47.766',
            'lon' => '11.632',
        ]);
        $this->assertSame(400, $response->get_status());
    }

    public function test_unsubstituted_lat_placeholder_returns_400(): void
    {
        $this->seed_osmand_feed('MyPhone', 'k4');

        $response = $this->ingest([
            'key'       => 'k4',
            'lat'       => '{0}',
            'lon'       => '11.632',
            'timestamp' => '1774544316000',
        ]);
        $this->assertSame(400, $response->get_status());
    }

    // -------------------------------------------------------------------------
    // Timestamp conversion (milliseconds → seconds)
    // -------------------------------------------------------------------------

    public function test_timestamp_milliseconds_converted_to_seconds(): void
    {
        $this->seed_osmand_feed('MyPhone', 'tskey');
        // Real value from OsmAnd probe: 1774544316682 ms = 1774544317 s (rounded).
        $response = $this->ingest([
            'key'       => 'tskey',
            'lat'       => '47.766',
            'lon'       => '11.632',
            'timestamp' => '1774544316682',
        ]);
        $this->assertSame(200, $response->get_status());

        $points = $this->get_points('MyPhone');
        $this->assertCount(1, $points);
        $this->assertSame(1774544317, (int) $points[0]['time']);
    }

    // -------------------------------------------------------------------------
    // Stored fields
    // -------------------------------------------------------------------------

    public function test_coordinates_and_type_stored_correctly(): void
    {
        $this->seed_osmand_feed('GeoPhone', 'geokey');

        $this->ingest([
            'key'       => 'geokey',
            'lat'       => '47.76655',
            'lon'       => '11.632608',
            'timestamp' => '1774544316000',
        ]);

        $points = $this->get_points('GeoPhone');
        $this->assertCount(1, $points);
        $this->assertEqualsWithDelta(47.76655, (float) $points[0]['latitude'], 0.00001);
        $this->assertEqualsWithDelta(11.632608, (float) $points[0]['longitude'], 0.00001);
        $this->assertSame('TRACK', $points[0]['type']);
    }

    public function test_optional_fields_stored(): void
    {
        $this->seed_osmand_feed('FullPhone', 'fullkey');

        $this->ingest([
            'key'       => 'fullkey',
            'lat'       => '47.76655',
            'lon'       => '11.632608',
            'timestamp' => '1774544316000',
            'hdop'      => '4.746587',
            'altitude'  => '716.77356',
            'speed'     => '0.119132124',
            'bearing'   => '356.15067',
            'batproc'   => '82',
        ]);

        $points = $this->get_points('FullPhone');
        $this->assertCount(1, $points);
        $p = $points[0];

        $this->assertEqualsWithDelta(4.746587, (float) $p['hdop'], 0.0001);
        $this->assertSame(717, (int) $p['altitude']); // rounded float
        $this->assertEqualsWithDelta(0.119132, (float) $p['speed'], 0.0001);
        $this->assertEqualsWithDelta(356.15067, (float) $p['bearing'], 0.001);
        $this->assertSame('82', $p['battery_status']);
    }

    public function test_unsubstituted_batproc_placeholder_not_stored(): void
    {
        $this->seed_osmand_feed('NoBat', 'nobatkey');

        // This is exactly what OsmAnd sends when battery permission is denied.
        $this->ingest([
            'key'       => 'nobatkey',
            'lat'       => '47.766',
            'lon'       => '11.632',
            'timestamp' => '1774544316000',
            'batproc'   => '{11}',
        ]);

        $points = $this->get_points('NoBat');
        $this->assertCount(1, $points);
        $this->assertNull($points[0]['battery_status']);
    }

    public function test_unsubstituted_optional_placeholder_not_stored(): void
    {
        $this->seed_osmand_feed('NoHdop', 'nohdopkey');

        $this->ingest([
            'key'       => 'nohdopkey',
            'lat'       => '47.766',
            'lon'       => '11.632',
            'timestamp' => '1774544316000',
            'hdop'      => '{3}',
            'speed'     => '{5}',
        ]);

        $points = $this->get_points('NoHdop');
        $this->assertCount(1, $points);
        $this->assertNull($points[0]['hdop']);
        $this->assertNull($points[0]['speed']);
    }

    // -------------------------------------------------------------------------
    // REST API — feed management
    // -------------------------------------------------------------------------

    public function test_create_osmand_feed_generates_key_and_tracking_url(): void
    {
        wp_set_current_user(self::$admin_id);

        $response = $this->admin_request('POST', '/feeds', [
            'type' => 'osmand',
            'name' => 'TestPhone',
        ]);

        $this->assertSame(201, $response->get_status());
        $data = $response->get_data();

        // Key should be auto-generated (32 hex chars = 16 bytes).
        $this->assertArrayHasKey('key', $data);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{32}$/', $data['key']);

        // tracking_url must contain the key and all OsmAnd placeholders.
        $this->assertArrayHasKey('tracking_url', $data);
        $this->assertStringContainsString($data['key'], $data['tracking_url']);
        $this->assertStringContainsString('{0}', $data['tracking_url']); // lat
        $this->assertStringContainsString('{1}', $data['tracking_url']); // lon
        $this->assertStringContainsString('{2}', $data['tracking_url']); // timestamp
        $this->assertStringContainsString('{11}', $data['tracking_url']); // batproc
        $this->assertStringContainsString('ingest/osmand', rawurldecode($data['tracking_url']));
    }

    public function test_update_osmand_feed_preserves_key(): void
    {
        wp_set_current_user(self::$admin_id);

        // Create the feed first.
        $create = $this->admin_request('POST', '/feeds', [
            'type' => 'osmand',
            'name' => 'InitialName',
        ]);
        $this->assertSame(201, $create->get_status());
        $created = $create->get_data();
        $original_key = $created['key'];

        // Update only the name.
        $update = $this->admin_request('PUT', '/feeds/' . $created['id'], [
            'type' => 'osmand',
            'name' => 'RenamedPhone',
        ]);
        $this->assertSame(200, $update->get_status());
        $updated = $update->get_data();

        // Key must be unchanged after rename.
        $this->assertSame($original_key, $updated['key']);
        $this->assertStringContainsString($original_key, $updated['tracking_url']);
    }

    public function test_get_feeds_includes_tracking_url_for_osmand(): void
    {
        wp_set_current_user(self::$admin_id);

        $this->seed_osmand_feed('ListPhone', 'listkey123');

        $response = $this->admin_request('GET', '/feeds');
        $this->assertSame(200, $response->get_status());

        $feeds = $response->get_data();
        $osmand = array_values(array_filter($feeds, fn ($f) => $f['type'] === 'osmand'));
        $this->assertCount(1, $osmand);
        $this->assertArrayHasKey('tracking_url', $osmand[0]);
        $this->assertStringContainsString('listkey123', $osmand[0]['tracking_url']);
    }
}
