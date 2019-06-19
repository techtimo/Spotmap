<?php
/**
 * Created by PhpStorm.
 * User: Work
 * Date: 6/19/2019
 * Time: 4:32 PM
 */

class Spotmap_Deactivator {
	/**
	 * Gets called if the spotmap gets deactivated
	 */
	public static function deactivate() {
		//stop checking for new data from the feed
		wp_unschedule_event( time(), 'spotmap_cron_hook' );
	}
}