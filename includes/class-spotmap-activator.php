<?php

class Spotmap_Activator {
	public static function activate() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-options.php';
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'admin/class-spotmap-admin.php';
		$db = new Spotmap_Database();
		$admin = new Spotmap_Admin();
		global $wpdb;
		$table_name = $wpdb->prefix."spotmap_points";
		$charset_collate = $wpdb->get_charset_collate();
		$sql = "CREATE TABLE {$table_name} (
		    `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
            `type` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,
            `time` int(11) unsigned NOT NULL,
            `latitude` float(11,7) NOT NULL,
            `longitude` float(11,7) NOT NULL,
            `altitude` int(11) DEFAULT NULL,
            `battery_status` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `custom_message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `feed_name` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `feed_id` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `model` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `device_name` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            `local_timezone` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `id_UNIQUE` (`id`) 
            )$charset_collate";

		require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
		dbDelta( $sql , true);

		//activate cron for every 2.5min to get latest data from feed
		if ( ! wp_next_scheduled( 'spotmap_api_crawler_hook' ) ) {
			wp_schedule_event( time(), 'twohalf_min', 'spotmap_api_crawler_hook' );
		}
		if ( ! wp_next_scheduled( 'spotmap_get_timezone_hook' ) ) {
			wp_schedule_single_event( time(),'spotmap_get_timezone_hook' );
		}
		
		// Ensure all plugin options exist and include expected keys.
		Spotmap_Options::ensure_defaults();
		
		$args = array(
			'post_type' => 'attachment',
			'post_mime_type' => 'image',
			'posts_per_page' => -1
		);
		
		$attachments = get_posts($args);

		if ($attachments) {
			foreach ($attachments as $attachment) {
				// Get attachment details
				$attachment_id = $attachment->ID;
				error_log($attachment_id);
				if ($db->does_media_exist($attachment_id)) {
					continue;
				}
				$admin->add_images_to_map($attachment_id);
			}
		} 
	}
}
