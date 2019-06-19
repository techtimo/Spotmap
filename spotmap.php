<?php
/**
 * The plugin bootstrap file
 *
 * This file is read by WordPress to generate the plugin information in the plugin
 * admin area. This file also includes all of the dependencies used by the plugin,
 * registers the activation and deactivation functions, and defines a function
 * that starts the plugin.
 *
 *
 * Plugin Name: Spotmap
 * Plugin URI: https://github.com/techtimo/spotmap
 * Description:       This is a short description of what the plugin does. It's displayed in the WordPress admin area.
 * Version:           0.3.0
 * Author:            Timo Giese
 * Author URI:        https://github.com/techtimo
 * License:           GPL2
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 */


// Block direct access
defined( 'ABSPATH' ) or die();

define( 'SPOTMAP_VERSION', '0.3.0' );

register_activation_hook( __FILE__, 'activate_spotmap' );
function activate_spotmap() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-spotmap-activator.php';
	Spotmap_Activator::activate();
}

register_deactivation_hook( __FILE__, 'deactivate_spotmap' );
function deactivate_spotmap() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-spotmap-deactivator.php';
	Spotmap_Deactivator::deactivate();
}

require plugin_dir_path( __FILE__ ) . 'includes/class-spotmap.php';

function run_spotmap() {
	$plugin = new Spotmap();
	$plugin->run();
}
run_spotmap();

