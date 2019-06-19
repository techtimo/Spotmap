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
		    `id` INT NOT NULL,
		    `message_type` VARCHAR(25) NOT NULL,
		    `time` INT(11) NOT NULL,
		    `longitude` VARCHAR(45) NOT NULL,
		    `latitude` FLOAT(11,7) NOT NULL,
		    `altitude` FLOAT(11,7) NULL,
		    `battery_status` VARCHAR(45) NULL,
		    PRIMARY KEY (`id`) )$charset_collate";

		require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
		dbDelta( $sql );

		//activate cron for every 2.5min to get latest data from feed
		if ( ! wp_next_scheduled( 'spotmap_cron_hook' ) ) {
			wp_schedule_event( time(), 'twohalf_min', 'spotmap_cron_hook' );
		}
		//add_option('Spot_Feed_ID');
	}
}