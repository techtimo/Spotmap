<?php

class Spotmap_Deactivator {
	/**
	 * Gets called if the spotmap gets deactivated
	 */
	public static function deactivate() {
		//stop checking for new data from the feed
		wp_unschedule_event( time(), 'spotmap_cron_hook' );

		foreach (get_option("spotmap_options") as $key => $count) {
			if($count < 1)
				continue;
			
			for ($i=0; $i < $count; $i++) {
				delete_option('spotmap_'.$key.'_name'.$i);
				delete_option('spotmap_'.$key.'_id'.$i);
				delete_option('spotmap_'.$key.'_password'.$i);
			}
		}
		delete_option("spotmap_options");
		
		// tbd: delete db as well?
	}
}
