<?php

// Runs automatically when the user deletes the plugin.
if (! defined('WP_UNINSTALL_PLUGIN')) {
    die;
}

require_once plugin_dir_path(__FILE__) . 'includes/class-spotmap-options.php';

// Remove all plugin options.
delete_option(Spotmap_Options::OPTION_FEEDS);
delete_option(Spotmap_Options::OPTION_MARKER);
delete_option(Spotmap_Options::OPTION_API_TOKENS);
delete_option(Spotmap_Options::OPTION_DEFAULT_VALUES);
delete_option(Spotmap_Options::OPTION_VERSION);
// Removed in 1.2.0 — safe to delete on any version.
delete_option('spotmap_custom_messages');

// Remove legacy 0.x.y options in case the plugin is deleted before migrating.
delete_option('spotmap_api_providers');
delete_option('spotmap_findmespot_name');
delete_option('spotmap_findmespot_id');
delete_option('spotmap_findmespot_password');

global $wpdb;
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spotmap_points");
