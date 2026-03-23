<?php

class SpotmapActivatorTest extends WP_UnitTestCase {

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		require_once dirname( __DIR__ ) . '/includes/class-spotmap-activator.php';
		require_once dirname( __DIR__ ) . '/admin/class-spotmap-admin.php';

		// Register the custom cron interval that the plugin normally adds via its
		// 'cron_schedules' filter hook (registered at init, not in tests).
		add_filter( 'cron_schedules', function ( $schedules ) {
			$schedules['twohalf_min'] = [
				'interval' => 150,
				'display'  => '2.5 Minutes',
			];
			return $schedules;
		} );
	}

	public function test_activate_creates_table(): void {
		global $wpdb;

		Spotmap_Activator::activate();

		$this->assertSame(
			"{$wpdb->prefix}spotmap_points",
			$wpdb->get_var( "SHOW TABLES LIKE '{$wpdb->prefix}spotmap_points'" ),
			'Table must exist after activate()'
		);
	}

	public function test_activate_creates_table_with_full_schema(): void {
		global $wpdb;

		Spotmap_Activator::activate();

		$columns = $wpdb->get_col(
			"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$wpdb->prefix}spotmap_points'"
		);

		foreach ( [ 'id', 'type', 'time', 'latitude', 'longitude', 'altitude',
					'battery_status', 'message', 'custom_message', 'feed_name',
					'feed_id', 'model', 'device_name', 'local_timezone' ] as $col ) {
			$this->assertContains( $col, $columns, "Column '$col' missing from table" );
		}
	}

	public function test_activate_seeds_plugin_options(): void {
		Spotmap_Activator::activate();

		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_FEEDS ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_MARKER ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_DEFAULT_VALUES ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_API_TOKENS ) );
		$this->assertNotFalse( get_option( Spotmap_Options::OPTION_CUSTOM_MESSAGES ) );
	}

	public function test_activate_schedules_cron_hooks(): void {
		wp_clear_scheduled_hook( 'spotmap_api_crawler_hook' );
		wp_clear_scheduled_hook( 'spotmap_get_timezone_hook' );

		Spotmap_Activator::activate();

		$this->assertNotFalse( wp_next_scheduled( 'spotmap_api_crawler_hook' ) );
		$this->assertNotFalse( wp_next_scheduled( 'spotmap_get_timezone_hook' ) );
	}

	public function test_activate_is_idempotent(): void {
		wp_clear_scheduled_hook( 'spotmap_api_crawler_hook' );

		Spotmap_Activator::activate();
		Spotmap_Activator::activate();

		// Guard against scheduling the same event twice.
		$crawler_count = 0;
		foreach ( _get_cron_array() as $events ) {
			if ( isset( $events['spotmap_api_crawler_hook'] ) ) {
				$crawler_count++;
			}
		}
		$this->assertSame( 1, $crawler_count, 'spotmap_api_crawler_hook must not be scheduled more than once' );
	}
}
