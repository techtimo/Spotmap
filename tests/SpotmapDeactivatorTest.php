<?php

class SpotmapDeactivatorTest extends WP_UnitTestCase {

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		require_once dirname( __DIR__ ) . '/includes/class-spotmap-deactivator.php';

		// Register the custom interval so schedule calls don't fail.
		add_filter( 'cron_schedules', function ( $schedules ) {
			$schedules['twohalf_min'] = [ 'interval' => 150, 'display' => '2.5 Minutes' ];
			return $schedules;
		} );
	}

	public function test_deactivate_clears_cron_hooks(): void {
		wp_schedule_event( time(), 'twohalf_min', 'spotmap_api_crawler_hook' );
		wp_schedule_single_event( time(), 'spotmap_get_timezone_hook' );

		Spotmap_Deactivator::deactivate();

		$this->assertFalse( wp_next_scheduled( 'spotmap_api_crawler_hook' ) );
		$this->assertFalse( wp_next_scheduled( 'spotmap_get_timezone_hook' ) );
	}

	public function test_deactivate_is_safe_when_no_hooks_scheduled(): void {
		wp_clear_scheduled_hook( 'spotmap_api_crawler_hook' );
		wp_clear_scheduled_hook( 'spotmap_get_timezone_hook' );

		// Must not throw.
		Spotmap_Deactivator::deactivate();

		$this->assertFalse( wp_next_scheduled( 'spotmap_api_crawler_hook' ) );
	}
}
