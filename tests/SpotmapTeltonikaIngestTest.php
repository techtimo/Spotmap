<?php

/**
 * Tests for the Teltonika ingestion endpoint.
 */
class SpotmapTeltonikaIngestTest extends WP_UnitTestCase {

	private static \ReflectionProperty $cache_prop;

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		Spotmap_Rest_Api::register_routes();
		Spotmap_Ingest::register_routes();
		self::$cache_prop = ( new ReflectionClass( Spotmap_Options::class ) )->getProperty( 'cache' );
	}

	protected function setUp(): void {
		parent::setUp();
		self::$cache_prop->setValue( null, [] );
		delete_option( 'spotmap_feeds' );
	}

	private function verify( array $params ): WP_REST_Response {
		$request = new WP_REST_Request( 'GET', '/spotmap/v1/ingest/teltonika' );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		return rest_get_server()->dispatch( $request );
	}

	private function ingest( string $key, array $payload ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', '/spotmap/v1/ingest/teltonika' );
		$request->set_param( 'key', $key );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( wp_json_encode( $payload ) );
		return rest_get_server()->dispatch( $request );
	}

	private function seed_teltonika_feed( string $name = 'Van', string $key = 'teltonika-key' ): array {
		$feed = [
			'id'   => uniqid( 'feed_', true ),
			'type' => 'teltonika',
			'name' => $name,
			'key'  => $key,
		];
		Spotmap_Options::save_feeds( [ $feed ] );
		self::$cache_prop->setValue( null, [] );
		return $feed;
	}

	private function get_points( string $feed_name ): array {
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

	public function test_get_with_valid_key_returns_verification_message(): void {
		$feed = $this->seed_teltonika_feed( 'Tracker', 'verify-123' );

		$response = $this->verify( [
			'key' => 'verify-123',
		] );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame(
			[
				'ok'      => true,
				'message' => 'Teltonika endpoint is reachable and the key is configured.',
				'feed'    => [
					'id'   => $feed['id'],
					'name' => 'Tracker',
					'type' => 'teltonika',
				],
			],
			$response->get_data()
		);

		$this->assertCount( 0, $this->get_points( 'Tracker' ) );
	}

	public function test_get_with_invalid_key_returns_401(): void {
		$this->seed_teltonika_feed( 'Tracker', 'correct-123' );

		$response = $this->verify( [
			'key' => 'wrong-123',
		] );

		$this->assertSame( 401, $response->get_status() );
		$this->assertSame( [ 'error' => 'Invalid key.' ], $response->get_data() );
	}

	public function test_post_with_valid_key_stores_point(): void {
		$this->seed_teltonika_feed( 'Tracker', 'store-123' );

		$response = $this->ingest(
			'store-123',
			[
				'device' => [
					'latitude'  => 47.76655,
					'longitude' => 11.632608,
					'timestamp' => 1774544317,
					'altitude'  => 716.7,
					'speed'     => 0.11,
					'angle'     => 356.15,
					'accuracy'  => 4.7,
				],
			]
		);

		$this->assertSame( 200, $response->get_status() );

		$points = $this->get_points( 'Tracker' );
		$this->assertCount( 1, $points );
		$this->assertEqualsWithDelta( 47.76655, (float) $points[0]['latitude'], 0.00001 );
		$this->assertEqualsWithDelta( 11.632608, (float) $points[0]['longitude'], 0.00001 );
		$this->assertSame( 1774544317, (int) $points[0]['time'] );
	}

}