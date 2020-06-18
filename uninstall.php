<?php
// runs automatically when the users deletes the plugin.
// if uninstall.php is not called by WordPress, die
if (!defined('WP_UNINSTALL_PLUGIN')) {
    die;
}

foreach (get_option("spotmap_api_providers") as $key => $count) {
    delete_option('spotmap_'.$key.'_name');
    delete_option('spotmap_'.$key.'_id');
    delete_option('spotmap_'.$key.'_password');

}
delete_option("spotmap_api_providers");

global $wpdb;
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spotmap_points");