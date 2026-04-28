<?php

/**
 * Plugin Name:       Spotmap
 * Plugin URI:        https://github.com/techtimo/spotmap
 * Description:       Self-hosted GPS tracking for WordPress. Display live positions from SPOT, OsmAnd, and Teltonika devices on interactive Leaflet maps — with a Gutenberg block, time filtering, GPX overlays, and full data ownership.
 * Version:           1.0.0-rc.5
 * Author:            Timo Giese
 * Author URI:        https://github.com/techtimo
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       spotmap
 * Domain Path:       /languages
 * Requires PHP:      8.2
 * GitHub Plugin URI: https://github.com/techtimo/spotmap
 */


// Block direct access
defined('ABSPATH') or die();

define('SPOTMAP_VERSION', '1.0.0-rc.5');
define('SPOTMAP_PLUGIN_BASENAME', plugin_basename(__FILE__));

require_once plugin_dir_path(__FILE__) . 'vendor-prefixed/autoload.php';

register_activation_hook(__FILE__, 'activate_spotmap');
function activate_spotmap()
{
    require_once plugin_dir_path(__FILE__) . 'includes/class-spotmap-activator.php';
    Spotmap_Activator::activate();
}

register_deactivation_hook(__FILE__, 'deactivate_spotmap');
function deactivate_spotmap()
{
    require_once plugin_dir_path(__FILE__) . 'includes/class-spotmap-deactivator.php';
    Spotmap_Deactivator::deactivate();
}

require plugin_dir_path(__FILE__) . 'includes/class-spotmap.php';

function run_spotmap()
{
    $plugin = new Spotmap();
    $plugin->run();
}
run_spotmap();
