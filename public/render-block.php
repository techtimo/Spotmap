<?php
/**
 * Server-side rendering for the spotmap/spotmap block.
 *
 * @param array    $attributes Block attributes.
 * @param string   $content    Block content (empty for dynamic blocks).
 * @param WP_Block $block      Block instance.
 * @return string  Rendered HTML.
 */

$map_id = 'spotmap-container-' . wp_rand();

$options = wp_json_encode( array(
	'feeds'        => ! empty( $attributes['feeds'] ) ? $attributes['feeds'] : array(),
	'maps'         => ! empty( $attributes['maps'] ) ? $attributes['maps'] : array( 'openstreetmap' ),
	'mapOverlays'  => ! empty( $attributes['mapOverlays'] ) ? $attributes['mapOverlays'] : null,
	'styles'       => ! empty( $attributes['styles'] ) ? $attributes['styles'] : new stdClass(),
	'height'       => ! empty( $attributes['height'] ) ? $attributes['height'] : 500,
	'mapcenter'    => ! empty( $attributes['mapcenter'] ) ? $attributes['mapcenter'] : 'all',
	'filterPoints' => isset( $attributes['filterPoints'] ) ? $attributes['filterPoints'] : 10,
	'lastPoint'    => ! empty( $attributes['lastPoint'] ),
	'autoReload'   => ! empty( $attributes['autoReload'] ),
	'debug'        => ! empty( $attributes['debug'] ),
	'dateRange'    => ! empty( $attributes['dateRange'] ) ? $attributes['dateRange'] : array( 'from' => '', 'to' => '' ),
	'gpx'          => ! empty( $attributes['gpx'] ) ? $attributes['gpx'] : array(),
	'mapId'        => $map_id,
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
