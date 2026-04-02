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
        '1.1.0' => 'migrate_to_1_1_0',
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

        // If feeds are already in the new format, this migration already ran
        // (or feeds were configured directly in 1.0.x). Don't overwrite them.
        if ( ! empty( Spotmap_Options::get_feeds() ) ) {
            return;
        }

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

        // Only save if there are legacy feeds to migrate. Calling save_feeds([])
        // when no legacy options exist would wipe feeds already configured via
        // the 1.0.x admin UI (e.g. if OPTION_VERSION was never persisted).
        if ( ! empty( $feeds ) ) {
            Spotmap_Options::save_feeds( $feeds );
        }

        // Remove legacy options.
        delete_option( 'spotmap_findmespot_name' );
        delete_option( 'spotmap_findmespot_id' );
        delete_option( 'spotmap_findmespot_password' );
        delete_option( 'spotmap_api_providers' );
    }

    /**
     * 1.0.x → 1.1.0
     *
     * 1. EXTREME-TRACK and UNLIMITED-TRACK are aliases for TRACK — normalize
     *    all existing rows so the frontend only needs to handle one track type.
     *
     * 2. Global custom messages (spotmap_custom_messages) are copied into every
     *    findmespot feed's custom_messages field, then the global option is
     *    dropped. The customMessage key is removed from spotmap_marker entries.
     *
     * 3. The spotmap_marker option key 'UNLIMITED-TRACK' is renamed to 'TRACK'.
     *
     * @return void
     */
    private static function migrate_to_1_1_0(): void {
        global $wpdb;
        $table = $wpdb->prefix . 'spotmap_points';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query( "UPDATE `{$table}` SET `type` = 'TRACK' WHERE `type` IN ('EXTREME-TRACK', 'UNLIMITED-TRACK')" );

        // Migrate global custom messages into each feed, then drop the option.
        $global_messages = get_option( 'spotmap_custom_messages', [] );
        if ( is_array( $global_messages ) && ! empty( $global_messages ) ) {
            $feeds   = Spotmap_Options::get_feeds();
            $changed = false;
            foreach ( $feeds as &$feed ) {
                if ( ! isset( $feed['type'] ) || $feed['type'] !== 'findmespot' ) {
                    continue;
                }
                if ( empty( $feed['custom_messages'] ) ) {
                    $feed['custom_messages'] = $global_messages;
                    $changed                 = true;
                }
            }
            unset( $feed );
            if ( $changed ) {
                Spotmap_Options::save_feeds( $feeds );
            }
        }
        delete_option( 'spotmap_custom_messages' );

        // Update spotmap_marker: rename UNLIMITED-TRACK key to TRACK, drop customMessage.
        $markers = get_option( 'spotmap_marker', [] );
        if ( is_array( $markers ) ) {
            $changed = false;
            if ( isset( $markers['UNLIMITED-TRACK'] ) && ! isset( $markers['TRACK'] ) ) {
                $markers['TRACK'] = $markers['UNLIMITED-TRACK'];
                unset( $markers['UNLIMITED-TRACK'] );
                $changed = true;
            }
            foreach ( $markers as $type => $config ) {
                if ( is_array( $config ) && array_key_exists( 'customMessage', $config ) ) {
                    unset( $markers[ $type ]['customMessage'] );
                    $changed = true;
                }
            }
            if ( $changed ) {
                update_option( 'spotmap_marker', $markers );
            }
        }
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
