<?php
// runs automatically when the users deletes the plugin.
// if uninstall.php is not called by WordPress, die
if (!defined('WP_UNINSTALL_PLUGIN')) {
    die;
}

require_once plugin_dir_path( __FILE__ ) . 'includes/class-spotmap-options.php';

foreach (Spotmap_Options::get_dynamic_provider_option_names() as $option_name) {
    delete_option($option_name);
}
delete_option("spotmap_api_providers");

global $wpdb;
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spotmap_points");