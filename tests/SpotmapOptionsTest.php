<?php

class SpotmapOptionsTest extends WP_UnitTestCase {

	private static \ReflectionProperty $cache_prop;

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		$reflection        = new ReflectionClass( Spotmap_Options::class );
		self::$cache_prop  = $reflection->getProperty( 'cache' );
	}

	protected function setUp(): void {
		parent::setUp();
		// WP_UnitTestCase rolls back DB changes per test; only PHP-level static cache needs manual reset.
		self::$cache_prop->setValue( null, [] );
	}

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

	public function test_settings_defaults_has_expected_keys(): void {
		$defaults = Spotmap_Options::get_settings_defaults();

		$this->assertArrayHasKey( 'height', $defaults );
		$this->assertArrayHasKey( 'maps', $defaults );
		$this->assertSame( 500, $defaults['height'] );
	}

	public function test_get_provider_option_name(): void {
		$this->assertSame(
			'spotmap_findmespot_id',
			Spotmap_Options::get_provider_option_name( 'findmespot', 'id' )
		);
	}

	public function test_get_marker_options_merges_with_defaults(): void {
		update_option( Spotmap_Options::OPTION_MARKER, [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'custom-icon', 'customMessage' => '' ],
		] );

		$options = Spotmap_Options::get_marker_options();

		$this->assertSame( 'circle', $options['OK']['iconShape'] );
		// Non-overridden types still get their defaults.
		$this->assertSame( 'marker', $options['HELP']['iconShape'] );
	}

	public function test_get_setting_returns_default_when_unset(): void {
		$this->assertSame( 500, Spotmap_Options::get_setting( 'height' ) );
	}

	public function test_get_setting_returns_fallback_for_unknown_key(): void {
		$this->assertNull( Spotmap_Options::get_setting( 'nonexistent_key' ) );
	}

	public function test_get_api_token_returns_empty_string_by_default(): void {
		$this->assertSame( '', Spotmap_Options::get_api_token( 'mapbox' ) );
	}

	public function test_get_api_token_returns_stored_value(): void {
		update_option( Spotmap_Options::OPTION_API_TOKENS, [ 'mapbox' => 'tok_123' ] );

		$this->assertSame( 'tok_123', Spotmap_Options::get_api_token( 'mapbox' ) );
	}

	// --- Migration tests ---

	public function test_ensure_defaults_creates_all_options_on_fresh_install(): void {
		// No options exist — fresh install.
		Spotmap_Options::ensure_defaults();

		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_MARKER ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_DEFAULT_VALUES ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_CUSTOM_MESSAGES ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_API_PROVIDERS ) );
	}

	public function test_ensure_defaults_preserves_existing_marker_settings(): void {
		// Simulate an older install that already has a custom OK marker.
		update_option( Spotmap_Options::OPTION_MARKER, [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star', 'customMessage' => 'On the way!' ],
		] );

		Spotmap_Options::ensure_defaults();
		self::$cache_prop->setValue( null, [] );

		$marker = get_option( Spotmap_Options::OPTION_MARKER );
		$this->assertSame( 'circle', $marker['OK']['iconShape'], 'Existing iconShape must be preserved' );
		$this->assertSame( 'star', $marker['OK']['icon'], 'Existing icon must be preserved' );
		$this->assertSame( 'On the way!', $marker['OK']['customMessage'], 'Existing customMessage must be preserved' );
	}

	public function test_ensure_defaults_adds_missing_marker_types_from_old_install(): void {
		// Simulate an older install that only stored the OK type and is missing others.
		update_option( Spotmap_Options::OPTION_MARKER, [
			'OK' => [ 'iconShape' => 'marker', 'icon' => 'thumbs-up', 'customMessage' => '' ],
		] );

		Spotmap_Options::ensure_defaults();
		self::$cache_prop->setValue( null, [] );

		$marker = get_option( Spotmap_Options::OPTION_MARKER );
		$this->assertArrayHasKey( 'HELP', $marker, 'Missing HELP type must be added by ensure_defaults' );
		$this->assertArrayHasKey( 'MEDIA', $marker, 'Missing MEDIA type must be added by ensure_defaults' );
	}

	public function test_ensure_defaults_preserves_custom_height_setting(): void {
		// Simulate an older install with a custom height.
		update_option( Spotmap_Options::OPTION_DEFAULT_VALUES, [ 'height' => 800 ] );

		Spotmap_Options::ensure_defaults();
		self::$cache_prop->setValue( null, [] );

		$this->assertSame( 800, Spotmap_Options::get_setting( 'height' ), 'Custom height must survive ensure_defaults' );
	}

	public function test_ensure_defaults_adds_missing_settings_keys_from_old_install(): void {
		// Simulate an older install with some settings but a missing key (e.g. mapcenter).
		$partial = Spotmap_Options::get_settings_defaults();
		unset( $partial['mapcenter'] );
		update_option( Spotmap_Options::OPTION_DEFAULT_VALUES, $partial );

		Spotmap_Options::ensure_defaults();
		self::$cache_prop->setValue( null, [] );

		$this->assertSame( 'all', Spotmap_Options::get_setting( 'mapcenter' ), 'Missing mapcenter must be restored to default' );
	}

	// --- get_api_token_defaults ---

	public function test_get_api_token_defaults_has_all_expected_keys(): void {
		$defaults = Spotmap_Options::get_api_token_defaults();

		foreach ( [ 'timezonedb', 'mapbox', 'thunderforest', 'linz.govt.nz', 'geoservices.ign.fr', 'osdatahub.os.uk' ] as $key ) {
			$this->assertArrayHasKey( $key, $defaults, "Missing API token key: $key" );
			$this->assertSame( '', $defaults[ $key ], "Default for $key must be empty string" );
		}
	}

	// --- get_api_providers ---

	public function test_get_api_providers_returns_findmespot_by_default(): void {
		$providers = Spotmap_Options::get_api_providers();
		$this->assertArrayHasKey( 'findmespot', $providers );
	}

	public function test_get_api_providers_returns_stored_value(): void {
		update_option( Spotmap_Options::OPTION_API_PROVIDERS, [ 'custom-provider' => 'Custom Feed' ] );

		$providers = Spotmap_Options::get_api_providers();

		$this->assertArrayHasKey( 'custom-provider', $providers );
	}

	// --- get_settings ---

	public function test_get_settings_returns_all_default_keys(): void {
		$settings = Spotmap_Options::get_settings();

		foreach ( array_keys( Spotmap_Options::get_settings_defaults() ) as $key ) {
			$this->assertArrayHasKey( $key, $settings, "Missing settings key: $key" );
		}
	}

	public function test_get_settings_stored_value_overrides_default(): void {
		update_option( Spotmap_Options::OPTION_DEFAULT_VALUES, [ 'height' => 800 ] );

		$this->assertSame( 800, Spotmap_Options::get_settings()['height'] );
	}

	// --- get_marker_setting ---

	public function test_get_marker_setting_returns_default_value(): void {
		$this->assertSame( 'marker', Spotmap_Options::get_marker_setting( 'OK', 'iconShape' ) );
	}

	public function test_get_marker_setting_returns_custom_value(): void {
		update_option( Spotmap_Options::OPTION_MARKER, [
			'OK' => [ 'iconShape' => 'circle', 'icon' => 'star', 'customMessage' => '' ],
		] );

		$this->assertSame( 'circle', Spotmap_Options::get_marker_setting( 'OK', 'iconShape' ) );
	}

	public function test_get_marker_setting_returns_fallback_for_unknown_type(): void {
		$this->assertSame( 'fallback', Spotmap_Options::get_marker_setting( 'UNKNOWN_TYPE', 'iconShape', 'fallback' ) );
	}

	// --- get_api_tokens ---

	public function test_get_api_tokens_returns_all_known_keys(): void {
		$tokens = Spotmap_Options::get_api_tokens();

		foreach ( array_keys( Spotmap_Options::get_api_token_defaults() ) as $key ) {
			$this->assertArrayHasKey( $key, $tokens );
		}
	}

	public function test_get_api_tokens_stored_value_overrides_default(): void {
		update_option( Spotmap_Options::OPTION_API_TOKENS, [ 'mapbox' => 'pk.abc123' ] );

		$this->assertSame( 'pk.abc123', Spotmap_Options::get_api_tokens()['mapbox'] );
	}

	// --- get_custom_messages / get_custom_message ---

	public function test_get_custom_messages_returns_empty_array_by_default(): void {
		$this->assertSame( [], Spotmap_Options::get_custom_messages() );
	}

	public function test_get_custom_messages_returns_stored_values(): void {
		update_option( Spotmap_Options::OPTION_CUSTOM_MESSAGES, [ 'OK' => 'All good!' ] );

		$this->assertSame( 'All good!', Spotmap_Options::get_custom_messages()['OK'] );
	}

	public function test_get_custom_message_returns_fallback_when_unset(): void {
		$this->assertSame( 'default', Spotmap_Options::get_custom_message( 'OK', 'default' ) );
	}

	public function test_get_custom_message_returns_stored_value(): void {
		update_option( Spotmap_Options::OPTION_CUSTOM_MESSAGES, [ 'HELP' => 'SOS triggered!' ] );

		$this->assertSame( 'SOS triggered!', Spotmap_Options::get_custom_message( 'HELP' ) );
	}

	// --- get_dynamic_provider_option_names ---

	public function test_get_dynamic_provider_option_names_contains_findmespot_keys(): void {
		$names = Spotmap_Options::get_dynamic_provider_option_names();

		$this->assertContains( 'spotmap_findmespot_name', $names );
		$this->assertContains( 'spotmap_findmespot_id', $names );
		$this->assertContains( 'spotmap_findmespot_password', $names );
	}
}
