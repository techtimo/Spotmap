<?php
// runs automatically when the users deletes the plugin.
// if uninstall.php is not called by WordPress, die
if (!defined('WP_UNINSTALL_PLUGIN')) {
    die;
}

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

global $wpdb;
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spotmap_points");