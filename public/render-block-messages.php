<?php
/**
 * Server-side rendering for the spotmap/spotmessages block.
 *
 * @param array    $attributes Block attributes.
 * @param string   $content    Block content (empty for dynamic blocks).
 * @param WP_Block $block      Block instance.
 * @return string  Rendered HTML.
 */

require_once plugin_dir_path( __FILE__ ) . '../includes/class-spotmap-options.php';
require_once plugin_dir_path( __FILE__ ) . '../includes/class-spotmap-database.php';

$table_id = 'spotmap-messages-' . wp_rand();

$feeds = ! empty( $attributes['feeds'] )
    ? $attributes['feeds']
    : ( new Spotmap_Database() )->get_all_feednames();

$options = wp_json_encode( array(
    'feeds'        => $feeds,
    'type'         => ! empty( $attributes['types'] ) ? $attributes['types'] : array(),
    'filterPoints' => isset( $attributes['filterPoints'] )
        ? (int) $attributes['filterPoints']
        : (int) Spotmap_Options::get_setting( 'filter-points', 5 ),
    'dateRange'    => array(
        'from' => ! empty( $attributes['dateRange']['from'] ) ? $attributes['dateRange']['from'] : '',
        'to'   => ! empty( $attributes['dateRange']['to'] )   ? $attributes['dateRange']['to']   : '',
    ),
    'orderBy'      => 'time DESC',
    'limit'        => ! empty( $attributes['count'] ) ? (int) $attributes['count'] : 10,
    'groupBy'      => isset( $attributes['groupBy'] ) ? $attributes['groupBy'] : 'feed_name',
    'autoReload'   => ! empty( $attributes['autoReload'] ),
    'debug'        => false,
) );

$wrapper_attributes = get_block_wrapper_attributes();

echo "<div {$wrapper_attributes}>";
echo '<table id="' . esc_attr( $table_id ) . '"></table>';
echo '<script type="text/javascript">jQuery(function(){ var spotmap = new Spotmap(' . $options . '); spotmap.initTable("' . esc_js( $table_id ) . '"); });</script>';
echo '</div>';
