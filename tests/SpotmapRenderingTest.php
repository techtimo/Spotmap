<?php

/**
 * Verifies that [spotmap] shortcode and the Gutenberg block produce the same
 * Spotmap() options for the keys they share, so both renderers drive the map
 * engine identically given equivalent settings.
 */
class SpotmapRenderingTest extends WP_UnitTestCase {

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();

		require_once dirname( __DIR__ ) . '/admin/class-spotmap-admin.php';
		require_once dirname( __DIR__ ) . '/public/class-spotmap-public.php';
		require_once dirname( __DIR__ ) . '/includes/class-spotmap-database.php';

		// Register the block type so get_block_wrapper_attributes() works.
		// We register by name only (not from the build directory) to avoid
		// dependency on a stale built block.json. render-block.php provides
		// its own hardcoded fallbacks for all attribute defaults.
		unregister_block_type( 'spotmap/spotmap' );
		register_block_type( 'spotmap/spotmap', [
			'render_callback' => function ( $attributes ) {
				ob_start();
				include dirname( __DIR__ ) . '/public/render-block.php';
				return ob_get_clean();
			},
		] );
	}

	protected function setUp(): void {
		parent::setUp();
		// Reset admin settings to built-in defaults so the shortcode reads the
		// same filter-points value (5) as the block.json default.
		Spotmap_Options::save_settings( Spotmap_Options::get_settings_defaults() );
		$public = new Spotmap_Public();
		$public->register_shortcodes();
	}

	// --- Helpers ---

	/**
	 * Extracts and decodes the JSON options object passed to new Spotmap(...)
	 * from rendered HTML output.
	 */
	private function extract_options( string $html ): array {
		$start = strpos( $html, 'new Spotmap(' );
		$this->assertNotFalse( $start, 'new Spotmap() call not found in output' );
		$start += strlen( 'new Spotmap(' );

		$depth = 0;
		$end   = $start;
		for ( $i = $start; $i < strlen( $html ); $i++ ) {
			if ( $html[ $i ] === '{' ) {
				$depth++;
			}
			if ( $html[ $i ] === '}' ) {
				$depth--;
			}
			if ( $depth === 0 && $i > $start ) {
				$end = $i + 1;
				break;
			}
		}

		$decoded = json_decode( substr( $html, $start, $end - $start ), true );
		$this->assertIsArray( $decoded, 'Spotmap options could not be decoded as JSON' );
		return $decoded;
	}

	private function render_block( array $attributes ): string {
		return render_block( [
			'blockName' => 'spotmap/spotmap',
			'attrs'     => $attributes,
		] );
	}

	// --- Tests ---

	public function test_maps_option_matches(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap maps="openstreetmap,opentopomap" feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'maps' => [ 'openstreetmap', 'opentopomap' ], 'feeds' => [] ] ) );

		$this->assertSame( $sc['maps'], $block['maps'] );
	}

	public function test_mapcenter_option_matches(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap mapcenter="auto" feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'mapcenter' => 'auto', 'feeds' => [] ] ) );

		$this->assertSame( $sc['mapcenter'], $block['mapcenter'] );
	}

	public function test_autoreload_defaults_to_false_in_both(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'feeds' => [] ] ) );

		$this->assertFalse( $sc['autoReload'] );
		$this->assertFalse( $block['autoReload'] );
	}

	public function test_debug_defaults_to_false_in_both(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'feeds' => [] ] ) );

		$this->assertFalse( $sc['debug'] );
		$this->assertFalse( $block['debug'] );
	}

	public function test_map_overlays_null_by_default_in_both(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'feeds' => [] ] ) );

		$this->assertNull( $sc['mapOverlays'] );
		$this->assertNull( $block['mapOverlays'] );
	}

	public function test_gpx_empty_by_default_in_both(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'feeds' => [] ] ) );

		$this->assertSame( [], $sc['gpx'] );
		$this->assertSame( [], $block['gpx'] );
	}

	public function test_filter_points_option_matches_when_set_explicitly(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap filter-points=3 feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'filterPoints' => 3, 'feeds' => [] ] ) );

		$this->assertSame( 3, (int) $sc['filterPoints'] );
		$this->assertSame( 3, (int) $block['filterPoints'] );
	}

	/**
	 * Known difference: the block passes height in the JS options object so the
	 * Spotmap engine can read it directly; the shortcode only sets height via CSS
	 * on the wrapper div and does not include it in the options.
	 */
	public function test_height_is_in_block_options_but_not_shortcode_options(): void {
		$sc    = $this->extract_options( do_shortcode( '[spotmap height=400 feeds="f1"]' ) );
		$block = $this->extract_options( $this->render_block( [ 'height' => 400, 'feeds' => [] ] ) );

		$this->assertArrayNotHasKey( 'height', $sc );
		$this->assertSame( 400, $block['height'] );
	}

	/**
	 * Provides two DB states: empty and populated.
	 * Both should produce identical defaults for every shared option key.
	 */
	public static function db_state_provider(): array {
		return [
			'empty DB'     => [ false ],
			'DB has feeds' => [ true ],
		];
	}

	/**
	 * All option keys that both renderers emit must match in value.
	 * Keys present in only one renderer must be listed in the appropriate
	 * exclusion set below — forcing intentional differences to be documented.
	 *
	 * When a new option is added to either renderer this test fails unless the
	 * option is also added to the other renderer OR explicitly excluded here.
	 *
	 * @dataProvider db_state_provider
	 */
	public function test_all_shared_defaults_match( bool $with_feeds ): void {
		if ( $with_feeds ) {
			( new Spotmap_Database() )->insert_point( [
				'feedName'       => 'rendering-test-feed',
				'feedId'         => 'fid-rendering',
				'messageType'    => 'OK',
				'unixTime'       => 1700003000,
				'latitude'       => 47.0,
				'longitude'      => 8.0,
				'modelId'        => 'SPOT-X',
				'messengerName'  => 'Device',
				'messageContent' => '',
			] );
		}

		$sc    = $this->extract_options( do_shortcode( '[spotmap]' ) );
		$block = $this->extract_options( $this->render_block( [] ) );

		// Keys intentionally present only in the block (no shortcode equivalent).
		$block_only = [ 'height', 'enablePanning', 'scrollWheelZoom' ];

		// Keys intentionally present only in the shortcode (no block equivalent).
		// NOTE: shortcode 'last-point' is a convenience flag that PHP expands into
		//       styles[feed].lastPoint for every feed — no top-level key reaches the engine.
		// NOTE: 'date' was shortcode-only but is now converted in PHP to a full-day
		//       dateRange (00:00:00–23:59:59) before building options, so both
		//       renderers pass only 'dateRange' to the engine.
		$shortcode_only = [];

		// Keys that differ by design (random per-render, etc.).
		$ignored = [ 'mapId' ];

		$all_keys = array_unique( array_merge( array_keys( $sc ), array_keys( $block ) ) );

		foreach ( $all_keys as $key ) {
			if ( in_array( $key, $ignored, true ) ) {
				continue;
			}

			if ( in_array( $key, $block_only, true ) ) {
				$this->assertArrayNotHasKey( $key, $sc, "'$key' is block-only but appeared in shortcode output" );
				continue;
			}

			if ( in_array( $key, $shortcode_only, true ) ) {
				$this->assertArrayNotHasKey( $key, $block, "'$key' is shortcode-only but appeared in block output" );
				continue;
			}

			$this->assertArrayHasKey( $key, $sc,    "'$key' present in block but missing from shortcode" );
			$this->assertArrayHasKey( $key, $block, "'$key' present in shortcode but missing from block" );
			$this->assertSame( $sc[ $key ], $block[ $key ], "Default for '$key' differs between shortcode and block" );
		}
	}

	public function test_html_contains_map_div_and_init_script(): void {
		$sc    = do_shortcode( '[spotmap feeds="f1"]' );
		$block = $this->render_block( [ 'feeds' => [] ] );

		$this->assertStringContainsString( '<div ', $sc );
		$this->assertStringContainsString( 'initMap', $sc );
		$this->assertStringContainsString( '<div ', $block );
		$this->assertStringContainsString( 'initMap', $block );
	}
}
