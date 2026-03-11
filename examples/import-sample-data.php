<?php
/**
 * WP-CLI script to import sample data from JSON into the spotmap_points table.
 * Usage: wp eval-file /path/to/import-sample-data.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $wpdb;
$table_name = $wpdb->prefix . 'spotmap_points';

// Check if table exists
$table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table_name ) );
if ( ! $table_exists ) {
	WP_CLI::error( "Table {$table_name} does not exist. Is the plugin activated?" );
	return;
}

// Check if table already has data
$count = $wpdb->get_var( "SELECT COUNT(*) FROM {$table_name}" );
if ( $count > 0 ) {
	WP_CLI::log( "Table {$table_name} already has {$count} rows, skipping import." );
	return;
}

$json_file = __DIR__ . '/sentiero italia.json';
if ( ! file_exists( $json_file ) ) {
	WP_CLI::error( "Sample data file not found: {$json_file}" );
	return;
}

$data = json_decode( file_get_contents( $json_file ), true );
if ( ! is_array( $data ) || empty( $data ) ) {
	WP_CLI::error( 'Failed to parse sample data JSON.' );
	return;
}

$columns = array(
	'id', 'type', 'time', 'latitude', 'longitude', 'altitude',
	'battery_status', 'message', 'custom_message',
	'feed_name', 'feed_id', 'model', 'device_name', 'local_timezone',
);

$inserted = 0;
$batch_size = 100;
$batch_values = array();
$batch_placeholders = array();

foreach ( $data as $point ) {
	// The JSON 'time' field is a display string; use 'unixtime' for the DB column
	$row = array(
		intval( $point['id'] ),
		$point['type'],
		intval( $point['unixtime'] ),
		floatval( $point['latitude'] ),
		floatval( $point['longitude'] ),
		isset( $point['altitude'] ) ? intval( $point['altitude'] ) : null,
		$point['battery_status'] ?? null,
		$point['message'] ?? null,
		$point['custom_message'] ?? null,
		$point['feed_name'] ?? null,
		$point['feed_id'] ?? null,
		$point['model'] ?? null,
		$point['device_name'] ?? null,
		$point['local_timezone'] ?? null,
	);

	$batch_placeholders[] = '(%d, %s, %d, %f, %f, %d, %s, %s, %s, %s, %s, %s, %s, %s)';
	foreach ( $row as $val ) {
		$batch_values[] = $val;
	}

	if ( count( $batch_placeholders ) >= $batch_size ) {
		$cols = implode( ', ', array_map( function( $c ) { return "`{$c}`"; }, $columns ) );
		$sql = "INSERT IGNORE INTO {$table_name} ({$cols}) VALUES " . implode( ', ', $batch_placeholders );
		$wpdb->query( $wpdb->prepare( $sql, $batch_values ) );
		$inserted += count( $batch_placeholders );
		$batch_placeholders = array();
		$batch_values = array();
	}
}

// Insert remaining
if ( ! empty( $batch_placeholders ) ) {
	$cols = implode( ', ', array_map( function( $c ) { return "`{$c}`"; }, $columns ) );
	$sql = "INSERT IGNORE INTO {$table_name} ({$cols}) VALUES " . implode( ', ', $batch_placeholders );
	$wpdb->query( $wpdb->prepare( $sql, $batch_values ) );
	$inserted += count( $batch_placeholders );
}

WP_CLI::success( "Imported {$inserted} sample points into {$table_name}." );
