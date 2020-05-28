<?php
/**
 * Plugin Name: Spotmap
 * Plugin URI: https://github.com/techtimo/spotmap
 * Description:       Add an embedded topographic maps that shows the movement of a SPOT beacon
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

