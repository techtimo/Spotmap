<?php

class Spotmap_Deactivator {
	/**
	 * Gets called if the spotmap gets deactivated
	 */
	public static function deactivate() {
		//stop checking for new data from the feed
		wp_unschedule_event( time(), 'spotmap_cron_hook' );
	}
}
