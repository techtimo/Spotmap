<?php
/**
 * Created by PhpStorm.
 * User: Timo
 * Date: 6/19/2019
 * Time: 3:55 PM
 */

class Spotmap_Activator {
	public static function activate() {
		global $wpdb;
		$table_name = $wpdb->prefix."spotmap_points";
		$charset_collate = $wpdb->get_charset_collate();
		$sql = "CREATE TABLE {$table_name} (
		    `id` int(11) unsigned NOT NULL,
            `type` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,
            `time` int(11) unsigned NOT NULL,
            `longitude` float(11,7) NOT NULL,
            `latitude` float(11,7) NOT NULL,
            `altitude` float(11,7) DEFAULT NULL,
            `battery_status` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `custom_message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `id_UNIQUE` (`id`) 
            )$charset_collate";

		require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
		dbDelta( $sql );

		//activate cron for every 2.5min to get latest data from feed
		if ( ! wp_next_scheduled( 'spotmap_cron_hook' ) ) {
			wp_schedule_event( time(), 'twohalf_min', 'spotmap_cron_hook' );
		}
		//add_option('Spot_Feed_ID');
	}
}