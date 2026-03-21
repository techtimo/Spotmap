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

	public function test_html_contains_map_div_and_init_script(): void {
		$sc    = do_shortcode( '[spotmap feeds="f1"]' );
		$block = $this->render_block( [ 'feeds' => [] ] );

		$this->assertStringContainsString( '<div ', $sc );
		$this->assertStringContainsString( 'initMap', $sc );
		$this->assertStringContainsString( '<div ', $block );
		$this->assertStringContainsString( 'initMap', $block );
	}
}
