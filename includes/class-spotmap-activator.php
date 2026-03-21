<?php

class Spotmap_Activator {

	public static function activate() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-options.php';
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'admin/class-spotmap-admin.php';
		$db = new Spotmap_Database();
		$admin = new Spotmap_Admin();

		Spotmap_Database::create_table();

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
