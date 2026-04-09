<?php
/**
 * Server-side rendering for the spotmap/spotmap block.
 *
 * @param array    $attributes Block attributes.
 * @param string   $content    Block content (empty for dynamic blocks).
 * @param WP_Block $block      Block instance.
 * @return string  Rendered HTML.
 */

require_once plugin_dir_path( __FILE__ ) . '../includes/class-spotmap-options.php';
require_once plugin_dir_path( __FILE__ ) . '../includes/class-spotmap-database.php';

$map_id = 'spotmap-container-' . wp_rand();

$default_maps = array_values( array_filter( array_map( 'trim', explode( ',', Spotmap_Options::get_setting( 'maps', 'openstreetmap' ) ) ) ) );
$maps         = ! empty( $attributes['maps'] ) ? $attributes['maps'] : $default_maps;

// Detect feed format: new format has feed objects with a 'name' key; old format is an array of strings.
$feeds_raw = ! empty( $attributes['feeds'] ) ? $attributes['feeds'] : array();
$feeds     = array();
$styles    = array();

if ( ! empty( $feeds_raw ) && isset( $feeds_raw[0]['name'] ) ) {
	// New format: feeds is an array of objects with styles embedded.
	foreach ( $feeds_raw as $feed_obj ) {
		$name = $feed_obj['name'] ?? null;
		if ( $name ) {
			$feeds[] = $name;
			$style   = $feed_obj;
			unset( $style['name'] );
			$styles[ $name ] = $style;
		}
	}
} else {
	// Old format: feeds is an array of strings; styles is a separate attribute.
	$feeds = array_values( $feeds_raw );
	if ( ! empty( $attributes['styles'] ) ) {
		$styles = $attributes['styles'];
	}
}

// Fall back to all feeds from DB when none are configured.
if ( empty( $feeds ) ) {
	$feeds = ( new Spotmap_Database() )->get_all_feednames();
}

// If styles are still empty, build from admin defaults (mirrors shortcode behaviour).
if ( empty( $styles ) ) {
	$defaults   = Spotmap_Options::get_settings();
	$colors     = array_values( array_filter( array_map( 'trim', explode( ',', $defaults['color'] ) ) ) );
	$splitlines = array_values( array_filter( array_map( 'trim', explode( ',', (string) $defaults['splitlines'] ) ) ) );
	$num_colors = max( 1, count( $colors ) );
	foreach ( array_values( $feeds ) as $i => $feed_name ) {
		$styles[ $feed_name ] = array(
			'color'      => $colors[ $i % $num_colors ] ?? 'blue',
			'splitLines' => $splitlines[0] ?? '12',
		);
	}
}

$options = wp_json_encode( array(
	'feeds'        => $feeds,
	'maps'         => $maps,
	'mapOverlays'  => ! empty( $attributes['mapOverlays'] ) ? $attributes['mapOverlays'] : null,
	'styles'       => $styles,
	'height'       => ! empty( $attributes['height'] ) ? $attributes['height'] : 500,
	'mapcenter'    => ! empty( $attributes['mapcenter'] ) ? $attributes['mapcenter'] : 'all',
	'filterPoints' => isset( $attributes['filterPoints'] ) ? $attributes['filterPoints'] : (int) Spotmap_Options::get_setting( 'filter-points', 5 ),
	'autoReload'   => ! empty( $attributes['autoReload'] ),
	'debug'        => ! empty( $attributes['debug'] ),
	'dateRange'    => array(
		'from' => ! empty( $attributes['dateRange']['from'] ) ? $attributes['dateRange']['from'] : null,
		'to'   => ! empty( $attributes['dateRange']['to'] )   ? $attributes['dateRange']['to']   : null,
	),
	'gpx'             => ! empty( $attributes['gpx'] ) ? $attributes['gpx'] : array(),
	'enablePanning'     => isset( $attributes['enablePanning'] ) ? (bool) $attributes['enablePanning'] : true,
	'scrollWheelZoom'   => isset( $attributes['scrollWheelZoom'] ) ? (bool) $attributes['scrollWheelZoom'] : false,
	'locateButton'      => isset( $attributes['locateButton'] ) ? (bool) $attributes['locateButton'] : false,
	'fullscreenButton'  => isset( $attributes['fullscreenButton'] ) ? (bool) $attributes['fullscreenButton'] : true,
	'navigationButtons' => isset( $attributes['navigationButtons'] ) && is_array( $attributes['navigationButtons'] )
		? $attributes['navigationButtons']
		: array( 'enabled' => true, 'allPoints' => true, 'latestPoint' => true, 'gpxTracks' => true ),
	'mapId'             => $map_id,
) );

$height = ! empty( $attributes['height'] ) ? intval( $attributes['height'] ) : 500;
$align_class = ! empty( $attributes['align'] ) ? 'align' . esc_attr( $attributes['align'] ) : '';

$wrapper_attributes = get_block_wrapper_attributes( array(
	'id'    => $map_id,
	'class' => $align_class,
	'style' => "height: {$height}px; z-index: 0;",
) );

echo "<div {$wrapper_attributes}></div>";
echo '<script type="text/javascript">jQuery(function(){ var spotmap = new Spotmap(' . $options . '); spotmap.initMap(); });</script>';
