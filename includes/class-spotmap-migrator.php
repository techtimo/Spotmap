<?php

/**
 * Handles all data migrations between plugin versions.
 *
 * Hook into plugins_loaded (not register_activation_hook) so migrations run
 * on plugin updates, not just on fresh activations.
 *
 * Usage in class-spotmap.php:
 *   add_action( 'plugins_loaded', [ 'Spotmap_Migrator', 'run' ] );
 *
 * Adding a new migration:
 *   1. Add an entry to $migrations: 'x.y.z' => 'migrate_to_x_y_z'
 *   2. Implement the private static method migrate_to_x_y_z().
 *   Migrations run in version order; each runs only once per install.
 */
class Spotmap_Migrator {

	/**
	 * Ordered map of target version => method name.
	 * Add new entries here as the plugin evolves.
	 *
	 * @var array<string, string>
	 */
	private static $migrations = [
		'1.0.0' => 'migrate_to_1_0_0',
	];

	/**
	 * Entry point. Compares stored version against SPOTMAP_VERSION and runs
	 * any pending migrations in order. No-op when already up to date.
	 *
	 * @return void
	 */
	public static function run() {
		// Always sync the schema (dbDelta is idempotent — no-ops when up to date).
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		Spotmap_Database::create_table();

		$stored = get_option( Spotmap_Options::OPTION_VERSION, '0.0.0' );

		if ( version_compare( $stored, SPOTMAP_VERSION, '>=' ) ) {
			return;
		}

		foreach ( self::$migrations as $version => $method ) {
			if ( version_compare( $stored, $version, '<' ) ) {
				self::$method();
			}
		}

		update_option( Spotmap_Options::OPTION_VERSION, SPOTMAP_VERSION );
	}

	// -------------------------------------------------------------------------
	// Migrations
	// -------------------------------------------------------------------------

	/**
	 * 0.x.y → 1.0.0
	 *
	 * Converts the old flat per-provider options into the unified spotmap_feeds
	 * array and removes the legacy options.
	 *
	 * Old schema (wp_options rows):
	 *   spotmap_findmespot_name     => [0 => 'Trip 1', 1 => 'Trip 2']
	 *   spotmap_findmespot_id       => [0 => 'abc123', 1 => 'def456']
	 *   spotmap_findmespot_password => [0 => '',       1 => 'secret']
	 *   spotmap_api_providers       => ['findmespot' => 'Spot Feed']
	 *
	 * New schema (single wp_options row):
	 *   spotmap_feeds => [
	 *     [ 'id' => 'feed_...', 'type' => 'findmespot', 'name' => 'Trip 1',
	 *       'feed_id' => 'abc123', 'password' => '' ],
	 *     ...
	 *   ]
	 *
	 * @return void
	 */
	private static function migrate_to_1_0_0() {
		self::migrate_table_to_1_0_0();

		$names     = get_option( 'spotmap_findmespot_name', [] );
		$ids       = get_option( 'spotmap_findmespot_id', [] );
		$passwords = get_option( 'spotmap_findmespot_password', [] );

		if ( ! is_array( $names ) )     $names     = [];
		if ( ! is_array( $ids ) )       $ids       = [];
		if ( ! is_array( $passwords ) ) $passwords = [];

		$feeds = [];
		foreach ( $ids as $i => $feed_id ) {
			if ( empty( $feed_id ) ) {
				continue;
			}
			$feeds[] = [
				'id'       => uniqid( 'feed_', true ),
				'type'     => 'findmespot',
				'name'     => isset( $names[ $i ] ) ? sanitize_text_field( $names[ $i ] ) : '',
				'feed_id'  => sanitize_text_field( $feed_id ),
				'password' => isset( $passwords[ $i ] ) ? $passwords[ $i ] : '',
			];
		}

		Spotmap_Options::save_feeds( $feeds );

		// Remove legacy options.
		delete_option( 'spotmap_findmespot_name' );
		delete_option( 'spotmap_findmespot_id' );
		delete_option( 'spotmap_findmespot_password' );
		delete_option( 'spotmap_api_providers' );
	}

	/**
	 * 0.11.2 created `id` without AUTO_INCREMENT. Add it if missing.
	 * Safe to run on installs that already have AUTO_INCREMENT — MySQL no-ops it.
	 *
	 * @return void
	 */
	private static function migrate_table_to_1_0_0(): void {
		global $wpdb;
		$table = $wpdb->prefix . 'spotmap_points';

		if ( ! $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) ) {
			return; // Fresh install; create_table() will handle it.
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( "ALTER TABLE `{$table}` CHANGE COLUMN `id` `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT" );
	}

}
