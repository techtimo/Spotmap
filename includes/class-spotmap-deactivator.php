<?php

class Spotmap_Deactivator
{
    /**
     * Gets called if the spotmap gets deactivated
     */
    public static function deactivate()
    {
        //stop checking for new data from the feed
        wp_clear_scheduled_hook('spotmap_api_crawler_hook');
        wp_clear_scheduled_hook('spotmap_get_timezone_hook');
    }
}
