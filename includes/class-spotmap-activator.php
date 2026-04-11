<?php

class Spotmap_Activator
{
    public static function activate()
    {
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-database.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-options.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'admin/class-spotmap-admin.php';
        $db = new Spotmap_Database();
        $admin = new Spotmap_Admin();

        Spotmap_Database::create_table();

        //activate cron for every 2.5min to get latest data from feed
        add_filter('cron_schedules', [ $admin, 'add_cron_schedule' ]);
        if (! wp_next_scheduled('spotmap_api_crawler_hook')) {
            wp_schedule_event(time(), 'twohalf_min', 'spotmap_api_crawler_hook');
        }
        if (! wp_next_scheduled('spotmap_get_timezone_hook')) {
            wp_schedule_single_event(time(), 'spotmap_get_timezone_hook');
        }

        // Seed baseline option values for a fresh installation.
        // Updates are handled by Spotmap_Migrator via plugins_loaded, not here.
        Spotmap_Options::seed_defaults();

        // Schedule a one-time background job to import EXIF data from existing
        // media attachments — this can be slow on large libraries and must not
        // block the activation request.
        if (! wp_next_scheduled('spotmap_import_media_hook')) {
            wp_schedule_single_event(time() + 10, 'spotmap_import_media_hook');
        }
    }
}
