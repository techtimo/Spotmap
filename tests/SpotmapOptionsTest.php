<?php

class SpotmapOptionsTest extends WP_UnitTestCase {

	private static \ReflectionProperty $cache_prop;

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		$reflection       = new ReflectionClass( Spotmap_Options::class );
		self::$cache_prop = $reflection->getProperty( 'cache' );
	}

	protected function setUp(): void {
		parent::setUp();
		// WP_UnitTestCase rolls back DB changes per test; reset PHP-level static cache too.
		self::$cache_prop->setValue( null, [] );
	}

	// -------------------------------------------------------------------------
	// Marker defaults
	// -------------------------------------------------------------------------

	public function test_marker_defaults_contain_expected_types(): void {
		$defaults = Spotmap_Options::get_marker_defaults();

		$this->assertArrayHasKey( 'OK', $defaults );
		$this->assertArrayHasKey( 'HELP', $defaults );
		$this->assertArrayHasKey( 'MEDIA', $defaults );
	}

	public function test_marker_defaults_have_required_keys(): void {
		foreach ( Spotmap_Options::get_marker_defaults() as $type => $config ) {
			$this->assertArrayHasKey( 'iconShape', $config, "$type missing iconShape" );
			$this->assertArrayHasKey( 'icon', $config, "$type missing icon" );
		}
	}

	// -------------------------------------------------------------------------
	// Settings defaults
	// -------------------------------------------------------------------------

	public function test_settings_defaults_has_expected_keys(): void {
		$defaults = Spotmap_Options::get_settings_defaults();

		$this->assertArrayHasKey( 'height', $defaults );
		$this->assertArrayHasKey( 'maps', $defaults );
		$this->assertSame( 500, $defaults['height'] );
	}

	// -------------------------------------------------------------------------
	// seed_defaults
	// -------------------------------------------------------------------------

	public function test_seed_defaults_creates_all_options_on_fresh_install(): void {
		Spotmap_Options::seed_defaults();

		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_FEEDS ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_MARKER ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_DEFAULT_VALUES ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_API_TOKENS ) );
	}

	public function test_seed_defaults_feeds_option_is_empty_array(): void {
		Spotmap_Options::seed_defaults();

		$this->assertSame( [], get_option( Spotmap_Options::OPTION_FEEDS ) );
	}

	public function test_seed_defaults_does_not_overwrite_existing_options(): void {
		// Simulate an existing install where the user already has a custom marker.
		update_option( Spotmap_Options::OPTION_MARKER, [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star' ],
		] );

		Spotmap_Options::seed_defaults();
		self::$cache_prop->setValue( null, [] );

		$marker = get_option( Spotmap_Options::OPTION_MARKER );
		// add_option() is a no-op when the option already exists.
		$this->assertArrayHasKey( 'OK', $marker );
		$this->assertSame( 'star', $marker['OK']['icon'], 'Existing value must not be overwritten by seed_defaults' );
	}

	// -------------------------------------------------------------------------
	// Feeds CRUD
	// -------------------------------------------------------------------------

	public function test_get_feeds_returns_empty_array_when_no_feeds(): void {
		$this->assertSame( [], Spotmap_Options::get_feeds() );
	}

	public function test_add_feed_returns_feed_with_generated_id(): void {
		$feed = Spotmap_Options::add_feed( [
			'type'     => 'findmespot',
			'name'     => 'Alps 2024',
			'feed_id'  => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq',
			'password' => '',
		] );

		$this->assertArrayHasKey( 'id', $feed );
		$this->assertNotEmpty( $feed['id'] );
	}

	public function test_add_feed_persists_to_options(): void {
		Spotmap_Options::add_feed( [
			'type'     => 'findmespot',
			'name'     => 'Alps 2024',
			'feed_id'  => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq',
			'password' => '',
		] );
		self::$cache_prop->setValue( null, [] );

		$feeds = Spotmap_Options::get_feeds();
		$this->assertCount( 1, $feeds );
		$this->assertSame( 'Alps 2024', $feeds[0]['name'] );
		$this->assertSame( '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq', $feeds[0]['feed_id'] );
	}

	public function test_add_multiple_feeds_all_get_unique_ids(): void {
		$a = Spotmap_Options::add_feed( [ 'type' => 'findmespot', 'name' => 'Feed A', 'feed_id' => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq', 'password' => '' ] );
		$b = Spotmap_Options::add_feed( [ 'type' => 'findmespot', 'name' => 'Feed B', 'feed_id' => '1abcDefgHiJkLmNoPqRsTuVwXyZ123456', 'password' => '' ] );

		$this->assertNotSame( $a['id'], $b['id'] );
	}

	public function test_get_feed_returns_correct_feed_by_id(): void {
		$added = Spotmap_Options::add_feed( [
			'type'     => 'findmespot',
			'name'     => 'Summer Hike',
			'feed_id'  => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq',
			'password' => '',
		] );
		self::$cache_prop->setValue( null, [] );

		$found = Spotmap_Options::get_feed( $added['id'] );
		$this->assertNotNull( $found );
		$this->assertSame( 'Summer Hike', $found['name'] );
	}

	public function test_get_feed_returns_null_for_unknown_id(): void {
		$this->assertNull( Spotmap_Options::get_feed( 'nonexistent_id' ) );
	}

	public function test_update_feed_persists_changes(): void {
		$added = Spotmap_Options::add_feed( [
			'type'     => 'findmespot',
			'name'     => 'Old Name',
			'feed_id'  => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq',
			'password' => '',
		] );
		self::$cache_prop->setValue( null, [] );

		$result = Spotmap_Options::update_feed( $added['id'], [
			'type'     => 'findmespot',
			'name'     => 'New Name',
			'feed_id'  => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq',
			'password' => '',
		] );
		self::$cache_prop->setValue( null, [] );

		$this->assertTrue( $result );
		$this->assertSame( 'New Name', Spotmap_Options::get_feed( $added['id'] )['name'] );
	}

	public function test_update_feed_preserves_id(): void {
		$added = Spotmap_Options::add_feed( [ 'type' => 'findmespot', 'name' => 'Trip', 'feed_id' => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq', 'password' => '' ] );
		self::$cache_prop->setValue( null, [] );

		Spotmap_Options::update_feed( $added['id'], [ 'type' => 'findmespot', 'name' => 'Trip v2', 'feed_id' => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq', 'password' => '' ] );
		self::$cache_prop->setValue( null, [] );

		$feed = Spotmap_Options::get_feed( $added['id'] );
		$this->assertSame( $added['id'], $feed['id'], 'ID must not change on update' );
	}

	public function test_update_feed_returns_false_for_unknown_id(): void {
		$result = Spotmap_Options::update_feed( 'no_such_id', [ 'name' => 'Ghost' ] );
		$this->assertFalse( $result );
	}

	public function test_delete_feed_removes_it(): void {
		$added = Spotmap_Options::add_feed( [ 'type' => 'findmespot', 'name' => 'Temp', 'feed_id' => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq', 'password' => '' ] );
		self::$cache_prop->setValue( null, [] );

		$result = Spotmap_Options::delete_feed( $added['id'] );
		self::$cache_prop->setValue( null, [] );

		$this->assertTrue( $result );
		$this->assertNull( Spotmap_Options::get_feed( $added['id'] ) );
		$this->assertCount( 0, Spotmap_Options::get_feeds() );
	}

	public function test_delete_feed_returns_false_for_unknown_id(): void {
		$result = Spotmap_Options::delete_feed( 'no_such_id' );
		$this->assertFalse( $result );
	}

	public function test_delete_feed_leaves_other_feeds_intact(): void {
		$a = Spotmap_Options::add_feed( [ 'type' => 'findmespot', 'name' => 'Keep Me', 'feed_id' => '0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq', 'password' => '' ] );
		$b = Spotmap_Options::add_feed( [ 'type' => 'findmespot', 'name' => 'Delete Me', 'feed_id' => '1abcDefgHiJkLmNoPqRsTuVwXyZ123456', 'password' => '' ] );
		self::$cache_prop->setValue( null, [] );

		Spotmap_Options::delete_feed( $b['id'] );
		self::$cache_prop->setValue( null, [] );

		$feeds = Spotmap_Options::get_feeds();
		$this->assertCount( 1, $feeds );
		$this->assertSame( $a['id'], $feeds[0]['id'] );
	}

	// -------------------------------------------------------------------------
	// save_* write methods
	// -------------------------------------------------------------------------

	public function test_save_marker_options_persists(): void {
		$custom = [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star' ],
		];
		Spotmap_Options::save_marker_options( $custom );
		self::$cache_prop->setValue( null, [] );

		$stored = get_option( Spotmap_Options::OPTION_MARKER );
		$this->assertSame( 'star', $stored['OK']['icon'] );
	}

	public function test_save_settings_persists(): void {
		Spotmap_Options::save_settings( [ 'height' => 800 ] );
		self::$cache_prop->setValue( null, [] );

		$this->assertSame( 800, Spotmap_Options::get_setting( 'height' ) );
	}

	public function test_save_api_tokens_persists(): void {
		Spotmap_Options::save_api_tokens( [ 'mapbox' => 'pk.newtoken' ] );
		self::$cache_prop->setValue( null, [] );

		$this->assertSame( 'pk.newtoken', Spotmap_Options::get_api_token( 'mapbox' ) );
	}

	// -------------------------------------------------------------------------
	// Marker read methods
	// -------------------------------------------------------------------------

	public function test_get_marker_options_merges_with_defaults(): void {
		update_option( Spotmap_Options::OPTION_MARKER, [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'custom-icon' ],
		] );

		$options = Spotmap_Options::get_marker_options();

		$this->assertSame( 'circle', $options['OK']['iconShape'] );
		// Non-overridden types still return defaults.
		$this->assertSame( 'marker', $options['HELP']['iconShape'] );
	}

	public function test_get_marker_setting_returns_default_value(): void {
		$this->assertSame( 'marker', Spotmap_Options::get_marker_setting( 'OK', 'iconShape' ) );
	}

	public function test_get_marker_setting_returns_custom_value(): void {
		update_option( Spotmap_Options::OPTION_MARKER, [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star' ],
		] );

		$this->assertSame( 'circle', Spotmap_Options::get_marker_setting( 'OK', 'iconShape' ) );
	}

	public function test_get_marker_setting_returns_fallback_for_unknown_type(): void {
		$this->assertSame( 'fallback', Spotmap_Options::get_marker_setting( 'UNKNOWN_TYPE', 'iconShape', 'fallback' ) );
	}

	// -------------------------------------------------------------------------
	// Settings read methods
	// -------------------------------------------------------------------------

	public function test_get_setting_returns_default_when_unset(): void {
		$this->assertSame( 500, Spotmap_Options::get_setting( 'height' ) );
	}

	public function test_get_setting_returns_fallback_for_unknown_key(): void {
		$this->assertNull( Spotmap_Options::get_setting( 'nonexistent_key' ) );
	}

	public function test_get_settings_returns_all_default_keys(): void {
		foreach ( array_keys( Spotmap_Options::get_settings_defaults() ) as $key ) {
			$this->assertArrayHasKey( $key, Spotmap_Options::get_settings(), "Missing settings key: $key" );
		}
	}

	public function test_get_settings_stored_value_overrides_default(): void {
		update_option( Spotmap_Options::OPTION_DEFAULT_VALUES, [ 'height' => 800 ] );

		$this->assertSame( 800, Spotmap_Options::get_settings()['height'] );
	}

	// -------------------------------------------------------------------------
	// API tokens
	// -------------------------------------------------------------------------

	public function test_get_api_token_defaults_has_all_expected_keys(): void {
		foreach ( [ 'timezonedb', 'mapbox', 'thunderforest', 'linz.govt.nz', 'geoservices.ign.fr', 'osdatahub.os.uk' ] as $key ) {
			$defaults = Spotmap_Options::get_api_token_defaults();
			$this->assertArrayHasKey( $key, $defaults, "Missing API token key: $key" );
			$this->assertSame( '', $defaults[ $key ] );
		}
	}

	public function test_get_api_token_returns_empty_string_by_default(): void {
		$this->assertSame( '', Spotmap_Options::get_api_token( 'mapbox' ) );
	}

	public function test_get_api_token_returns_stored_value(): void {
		update_option( Spotmap_Options::OPTION_API_TOKENS, [ 'mapbox' => 'tok_123' ] );

		$this->assertSame( 'tok_123', Spotmap_Options::get_api_token( 'mapbox' ) );
	}

	public function test_get_api_tokens_returns_all_known_keys(): void {
		foreach ( array_keys( Spotmap_Options::get_api_token_defaults() ) as $key ) {
			$this->assertArrayHasKey( $key, Spotmap_Options::get_api_tokens() );
		}
	}

	public function test_get_api_tokens_stored_value_overrides_default(): void {
		update_option( Spotmap_Options::OPTION_API_TOKENS, [ 'mapbox' => 'pk.abc123' ] );

		$this->assertSame( 'pk.abc123', Spotmap_Options::get_api_tokens()['mapbox'] );
	}

}
