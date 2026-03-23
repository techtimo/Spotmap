<?php

class SpotmapRestApiTest extends WP_UnitTestCase {

	private static \ReflectionProperty $cache_prop;
	private static int $admin_id;
	private static int $subscriber_id;

	private const FEED_ID = '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq';

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();

		// Routes are registered once here; no need to fire rest_api_init since
		// the plugin hook is not wired up in the test bootstrap.
		Spotmap_Rest_Api::register_routes();

		self::$cache_prop    = ( new ReflectionClass( Spotmap_Options::class ) )->getProperty( 'cache' );
		self::$admin_id      = self::factory()->user->create( [ 'role' => 'administrator' ] );
		self::$subscriber_id = self::factory()->user->create( [ 'role' => 'subscriber' ] );
	}

	protected function setUp(): void {
		parent::setUp();
		self::$cache_prop->setValue( null, [] );
		wp_set_current_user( self::$admin_id );
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	private function request( string $method, string $route, array $body = [] ): WP_REST_Response {
		$request = new WP_REST_Request( $method, '/spotmap/v1' . $route );
		if ( ! empty( $body ) ) {
			$request->set_header( 'Content-Type', 'application/json' );
			$request->set_body( wp_json_encode( $body ) );
		}
		return rest_get_server()->dispatch( $request );
	}

	private function valid_feed(): array {
		return [
			'type'     => 'findmespot',
			'name'     => 'Alps 2024',
			'feed_id'  => self::FEED_ID,
			'password' => '',
		];
	}

	// -------------------------------------------------------------------------
	// Authentication
	// -------------------------------------------------------------------------

	public function test_unauthenticated_request_returns_401_or_403(): void {
		wp_set_current_user( 0 );
		$response = $this->request( 'GET', '/feeds' );
		$this->assertContains( $response->get_status(), [ 401, 403 ] );
	}

	public function test_subscriber_cannot_access_feeds(): void {
		wp_set_current_user( self::$subscriber_id );
		$response = $this->request( 'GET', '/feeds' );
		$this->assertContains( $response->get_status(), [ 401, 403 ] );
	}

	// -------------------------------------------------------------------------
	// GET /feeds
	// -------------------------------------------------------------------------

	public function test_get_feeds_returns_200(): void {
		$response = $this->request( 'GET', '/feeds' );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_get_feeds_returns_empty_array_by_default(): void {
		$response = $this->request( 'GET', '/feeds' );
		$this->assertSame( [], $response->get_data() );
	}

	public function test_get_feeds_returns_existing_feeds(): void {
		Spotmap_Options::add_feed( $this->valid_feed() );
		self::$cache_prop->setValue( null, [] );

		$response = $this->request( 'GET', '/feeds' );
		$this->assertCount( 1, $response->get_data() );
	}

	// -------------------------------------------------------------------------
	// POST /feeds
	// -------------------------------------------------------------------------

	public function test_create_feed_returns_201(): void {
		$response = $this->request( 'POST', '/feeds', $this->valid_feed() );
		$this->assertSame( 201, $response->get_status() );
	}

	public function test_create_feed_returns_feed_with_id(): void {
		$response = $this->request( 'POST', '/feeds', $this->valid_feed() );
		$data     = $response->get_data();
		$this->assertArrayHasKey( 'id', $data );
		$this->assertNotEmpty( $data['id'] );
	}

	public function test_create_feed_persists_to_options(): void {
		$this->request( 'POST', '/feeds', $this->valid_feed() );
		self::$cache_prop->setValue( null, [] );
		$this->assertCount( 1, Spotmap_Options::get_feeds() );
	}

	public function test_create_feed_returns_422_for_unknown_type(): void {
		$response = $this->request( 'POST', '/feeds', [
			'type'    => 'unknown_provider',
			'name'    => 'Test',
			'feed_id' => self::FEED_ID,
		] );
		$this->assertSame( 422, $response->get_status() );
	}

	public function test_create_feed_returns_422_when_name_missing(): void {
		$response = $this->request( 'POST', '/feeds', [
			'type'    => 'findmespot',
			'name'    => '',
			'feed_id' => self::FEED_ID,
		] );
		$this->assertSame( 422, $response->get_status() );
	}

	public function test_create_feed_returns_422_when_feed_id_missing(): void {
		$response = $this->request( 'POST', '/feeds', [
			'type'    => 'findmespot',
			'name'    => 'Test Feed',
			'feed_id' => '',
		] );
		$this->assertSame( 422, $response->get_status() );
	}

	public function test_create_feed_password_is_optional(): void {
		$response = $this->request( 'POST', '/feeds', [
			'type'    => 'findmespot',
			'name'    => 'No Password Feed',
			'feed_id' => self::FEED_ID,
		] );
		$this->assertSame( 201, $response->get_status() );
	}

	public function test_create_feed_with_password_returns_redacted_in_response(): void {
		$response = $this->request( 'POST', '/feeds', [
			'type'     => 'findmespot',
			'name'     => 'Secure Feed',
			'feed_id'  => self::FEED_ID,
			'password' => 'p@$$w0rd&<more>',
		] );
		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( Spotmap_Rest_Api::REDACTED, $response->get_data()['password'] );
	}

	public function test_create_feed_stores_password_verbatim(): void {
		$response = $this->request( 'POST', '/feeds', [
			'type'     => 'findmespot',
			'name'     => 'Secure Feed',
			'feed_id'  => self::FEED_ID,
			'password' => 'p@$$w0rd&<more>',
		] );
		self::$cache_prop->setValue( null, [] );
		$id   = $response->get_data()['id'];
		$feed = Spotmap_Options::get_feed( $id );
		$this->assertSame( 'p@$$w0rd&<more>', $feed['password'] );
	}

	public function test_get_feeds_masks_non_empty_password(): void {
		$this->request( 'POST', '/feeds', [
			'type'     => 'findmespot',
			'name'     => 'Secure Feed',
			'feed_id'  => self::FEED_ID,
			'password' => 'secret',
		] );
		self::$cache_prop->setValue( null, [] );
		$response = $this->request( 'GET', '/feeds' );
		$this->assertSame( Spotmap_Rest_Api::REDACTED, $response->get_data()[0]['password'] );
	}

	public function test_get_feeds_empty_password_not_masked(): void {
		$this->request( 'POST', '/feeds', $this->valid_feed() ); // password = ''
		self::$cache_prop->setValue( null, [] );
		$response = $this->request( 'GET', '/feeds' );
		$this->assertSame( '', $response->get_data()[0]['password'] );
	}

	public function test_update_feed_sentinel_preserves_stored_password(): void {
		$create = $this->request( 'POST', '/feeds', [
			'type'     => 'findmespot',
			'name'     => 'Pwd Feed',
			'feed_id'  => self::FEED_ID,
			'password' => 'original_secret',
		] );
		$id = $create->get_data()['id'];

		// Update name only — echo sentinel for the password.
		$this->request( 'PUT', '/feeds/' . $id, [
			'type'     => 'findmespot',
			'name'     => 'Renamed',
			'feed_id'  => self::FEED_ID,
			'password' => Spotmap_Rest_Api::REDACTED,
		] );
		self::$cache_prop->setValue( null, [] );
		$this->assertSame( 'original_secret', Spotmap_Options::get_feed( $id )['password'] );
	}

	public function test_update_feed_new_password_overwrites_stored(): void {
		$create = $this->request( 'POST', '/feeds', [
			'type'     => 'findmespot',
			'name'     => 'Pwd Feed',
			'feed_id'  => self::FEED_ID,
			'password' => 'original_secret',
		] );
		$id = $create->get_data()['id'];

		$this->request( 'PUT', '/feeds/' . $id, [
			'type'     => 'findmespot',
			'name'     => 'Pwd Feed',
			'feed_id'  => self::FEED_ID,
			'password' => 'new_secret',
		] );
		self::$cache_prop->setValue( null, [] );
		$this->assertSame( 'new_secret', Spotmap_Options::get_feed( $id )['password'] );
	}

	// -------------------------------------------------------------------------
	// PUT /feeds/{id}
	// -------------------------------------------------------------------------

	public function test_update_feed_returns_200(): void {
		$feed     = Spotmap_Options::add_feed( $this->valid_feed() );
		$response = $this->request( 'PUT', '/feeds/' . $feed['id'], [
			'type'     => 'findmespot',
			'name'     => 'Updated Name',
			'feed_id'  => self::FEED_ID,
			'password' => '',
		] );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_update_feed_persists_new_name(): void {
		$feed = Spotmap_Options::add_feed( $this->valid_feed() );
		$this->request( 'PUT', '/feeds/' . $feed['id'], [
			'type'     => 'findmespot',
			'name'     => 'New Name',
			'feed_id'  => self::FEED_ID,
			'password' => '',
		] );
		self::$cache_prop->setValue( null, [] );
		$this->assertSame( 'New Name', Spotmap_Options::get_feed( $feed['id'] )['name'] );
	}

	public function test_update_feed_preserves_id(): void {
		$feed     = Spotmap_Options::add_feed( $this->valid_feed() );
		$response = $this->request( 'PUT', '/feeds/' . $feed['id'], [
			'type'     => 'findmespot',
			'name'     => 'Renamed',
			'feed_id'  => self::FEED_ID,
			'password' => '',
		] );
		$this->assertSame( $feed['id'], $response->get_data()['id'] );
	}

	public function test_update_feed_returns_404_for_unknown_id(): void {
		$response = $this->request( 'PUT', '/feeds/no_such_id', [
			'type'    => 'findmespot',
			'name'    => 'Ghost',
			'feed_id' => self::FEED_ID,
		] );
		$this->assertSame( 404, $response->get_status() );
	}

	public function test_update_feed_returns_422_for_invalid_data(): void {
		$feed     = Spotmap_Options::add_feed( $this->valid_feed() );
		$response = $this->request( 'PUT', '/feeds/' . $feed['id'], [
			'type'    => 'findmespot',
			'name'    => '',
			'feed_id' => self::FEED_ID,
		] );
		$this->assertSame( 422, $response->get_status() );
	}

	// -------------------------------------------------------------------------
	// DELETE /feeds/{id}
	// -------------------------------------------------------------------------

	public function test_delete_feed_returns_204(): void {
		$feed     = Spotmap_Options::add_feed( $this->valid_feed() );
		$response = $this->request( 'DELETE', '/feeds/' . $feed['id'] );
		$this->assertSame( 204, $response->get_status() );
	}

	public function test_delete_feed_removes_from_options(): void {
		$feed = Spotmap_Options::add_feed( $this->valid_feed() );
		$this->request( 'DELETE', '/feeds/' . $feed['id'] );
		self::$cache_prop->setValue( null, [] );
		$this->assertNull( Spotmap_Options::get_feed( $feed['id'] ) );
	}

	public function test_delete_feed_returns_404_for_unknown_id(): void {
		$response = $this->request( 'DELETE', '/feeds/no_such_id' );
		$this->assertSame( 404, $response->get_status() );
	}

	// -------------------------------------------------------------------------
	// GET /providers
	// -------------------------------------------------------------------------

	public function test_get_providers_returns_200(): void {
		$response = $this->request( 'GET', '/providers' );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_get_providers_includes_findmespot(): void {
		$response = $this->request( 'GET', '/providers' );
		$this->assertArrayHasKey( 'findmespot', $response->get_data() );
	}

	public function test_get_providers_findmespot_has_fields(): void {
		$response = $this->request( 'GET', '/providers' );
		$data     = $response->get_data();
		$this->assertArrayHasKey( 'fields', $data['findmespot'] );
		$this->assertNotEmpty( $data['findmespot']['fields'] );
	}

	// -------------------------------------------------------------------------
	// GET /markers
	// -------------------------------------------------------------------------

	public function test_get_markers_returns_200(): void {
		$response = $this->request( 'GET', '/markers' );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_get_markers_returns_all_default_types(): void {
		$response = $this->request( 'GET', '/markers' );
		$data     = $response->get_data();
		foreach ( array_keys( Spotmap_Options::get_marker_defaults() ) as $type ) {
			$this->assertArrayHasKey( $type, $data, "Marker type '$type' missing from response" );
		}
	}

	// -------------------------------------------------------------------------
	// PUT /markers
	// -------------------------------------------------------------------------

	public function test_update_markers_returns_200(): void {
		$response = $this->request( 'PUT', '/markers', [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star', 'customMessage' => '' ],
		] );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_update_markers_persists_changes(): void {
		$this->request( 'PUT', '/markers', [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star', 'customMessage' => '' ],
		] );
		self::$cache_prop->setValue( null, [] );
		$this->assertSame( 'star', Spotmap_Options::get_marker_setting( 'OK', 'icon' ) );
	}

	public function test_update_markers_ignores_unknown_types(): void {
		$this->request( 'PUT', '/markers', [
			'UNKNOWN_TYPE' => [ 'iconShape' => 'circle', 'icon' => 'star', 'customMessage' => '' ],
		] );
		self::$cache_prop->setValue( null, [] );
		// The unknown type must not be stored.
		$stored = get_option( Spotmap_Options::OPTION_MARKER );
		$this->assertFalse( isset( $stored['UNKNOWN_TYPE'] ) );
	}

	public function test_update_markers_returns_merged_result(): void {
		$response = $this->request( 'PUT', '/markers', [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star', 'customMessage' => '' ],
		] );
		$data = $response->get_data();
		// Response includes all default types, not just what was sent.
		$this->assertArrayHasKey( 'HELP', $data );
	}

	// -------------------------------------------------------------------------
	// GET /tokens
	// -------------------------------------------------------------------------

	public function test_get_tokens_returns_200(): void {
		$response = $this->request( 'GET', '/tokens' );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_get_tokens_includes_all_known_keys(): void {
		$response = $this->request( 'GET', '/tokens' );
		$data     = $response->get_data();
		foreach ( array_keys( Spotmap_Options::get_api_token_defaults() ) as $key ) {
			$this->assertArrayHasKey( $key, $data, "Token key '$key' missing from response" );
		}
	}

	// -------------------------------------------------------------------------
	// PUT /tokens
	// -------------------------------------------------------------------------

	public function test_update_tokens_returns_200(): void {
		$response = $this->request( 'PUT', '/tokens', [ 'mapbox' => 'pk.test123' ] );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_update_tokens_persists_value(): void {
		$this->request( 'PUT', '/tokens', [ 'mapbox' => 'pk.test123' ] );
		self::$cache_prop->setValue( null, [] );
		$this->assertSame( 'pk.test123', Spotmap_Options::get_api_token( 'mapbox' ) );
	}

	public function test_update_tokens_ignores_unknown_keys(): void {
		$this->request( 'PUT', '/tokens', [ 'unknown_service' => 'tok_xxx' ] );
		self::$cache_prop->setValue( null, [] );
		$stored = get_option( Spotmap_Options::OPTION_API_TOKENS );
		$this->assertFalse( isset( $stored['unknown_service'] ) );
	}

	public function test_get_tokens_masks_non_empty_value(): void {
		$this->request( 'PUT', '/tokens', [ 'mapbox' => 'pk.realtoken' ] );
		self::$cache_prop->setValue( null, [] );
		$response = $this->request( 'GET', '/tokens' );
		$this->assertSame( Spotmap_Rest_Api::REDACTED, $response->get_data()['mapbox'] );
	}

	public function test_get_tokens_empty_value_not_masked(): void {
		$this->request( 'PUT', '/tokens', [ 'mapbox' => '' ] );
		self::$cache_prop->setValue( null, [] );
		$response = $this->request( 'GET', '/tokens' );
		$this->assertSame( '', $response->get_data()['mapbox'] );
	}

	public function test_update_tokens_sentinel_preserves_stored_token(): void {
		$this->request( 'PUT', '/tokens', [ 'mapbox' => 'pk.realtoken' ] );
		self::$cache_prop->setValue( null, [] );

		// Echo sentinel back — should not overwrite.
		$this->request( 'PUT', '/tokens', [ 'mapbox' => Spotmap_Rest_Api::REDACTED ] );
		self::$cache_prop->setValue( null, [] );
		$this->assertSame( 'pk.realtoken', Spotmap_Options::get_api_token( 'mapbox' ) );
	}

	public function test_update_tokens_persists_value_is_not_exposed_in_response(): void {
		$response = $this->request( 'PUT', '/tokens', [ 'mapbox' => 'pk.test123' ] );
		$this->assertSame( Spotmap_Rest_Api::REDACTED, $response->get_data()['mapbox'] );
	}

	// -------------------------------------------------------------------------
	// GET /defaults
	// -------------------------------------------------------------------------

	public function test_get_defaults_returns_200(): void {
		$response = $this->request( 'GET', '/defaults' );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_get_defaults_includes_height(): void {
		$response = $this->request( 'GET', '/defaults' );
		$this->assertArrayHasKey( 'height', $response->get_data() );
	}

	// -------------------------------------------------------------------------
	// PUT /defaults
	// -------------------------------------------------------------------------

	public function test_update_defaults_returns_200(): void {
		$response = $this->request( 'PUT', '/defaults', [ 'height' => 800 ] );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_update_defaults_persists_value(): void {
		$this->request( 'PUT', '/defaults', [ 'height' => 800 ] );
		self::$cache_prop->setValue( null, [] );
		$this->assertSame( 800, Spotmap_Options::get_setting( 'height' ) );
	}

	public function test_update_defaults_preserves_numeric_type(): void {
		$this->request( 'PUT', '/defaults', [ 'height' => 600 ] );
		self::$cache_prop->setValue( null, [] );
		$value = Spotmap_Options::get_setting( 'height' );
		$this->assertIsInt( $value );
	}

	public function test_update_defaults_ignores_unknown_keys(): void {
		$this->request( 'PUT', '/defaults', [ 'nonexistent_key' => 'value' ] );
		self::$cache_prop->setValue( null, [] );
		$stored = get_option( Spotmap_Options::OPTION_DEFAULT_VALUES );
		$this->assertFalse( isset( $stored['nonexistent_key'] ) );
	}
}
