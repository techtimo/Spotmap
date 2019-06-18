<?php
/*
Plugin Name: Spotmap
Plugin URI: https://github.com/techtimo/spotmap
Description: A brief description of the Plugin.
Version: 1.0
Author: Dell E7240
Author URI: https://github.com/techtimo
License: GPL2
License URI:  https://www.gnu.org/licenses/gpl-2.0.html

    Spotmap is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    any later version.

    Spotmap is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.
*/
//Block direct access
defined( 'ABSPATH' ) or die();


register_activation_hook( __FILE__, 'spotmap_activation' );
function spotmap_activation(){
    global $wpdb;
    $table_name = $wpdb->prefix."spotmap_points";
    $charset_collate = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE {$table_name} (
    `id` INT NOT NULL,
    `message_type` VARCHAR(25) NOT NULL,
    `time` INT(11) NOT NULL,
    `longitude` VARCHAR(45) NOT NULL,
    `latitude` FLOAT(11,7) NOT NULL,
    `altitude` FLOAT(11,7) NULL,
    `battery_status` VARCHAR(45) NULL,
    PRIMARY KEY (`id`) )$charset_collate";


	require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
	dbDelta( $sql );

	//activate cron for every 2.5min to get latest data from feed
	if ( ! wp_next_scheduled( 'spotmap_cron_hook' ) ) {
		wp_schedule_event( time(), 'twohalf_min', 'spotmap_cron_hook' );
	}
}


register_deactivation_hook( __FILE__, 'spotmap_deactivation' );
function spotmap_deactivation(){
    wp_unschedule_event( time(), 'spotmap_cron_hook' );
}


add_filter( 'cron_schedules', 'spotmap_add_cron_interval' );
function spotmap_add_cron_interval( $schedules ) {
    $schedules['twohalf_min'] = array(
		'interval' => 150,
		'display'  => esc_html__( 'Every 2.5 Minutes' ),
	);
    return $schedules;
}


add_action('wp_enqueue_scripts', 'spotmap_setup_scripts_and_styles');
function spotmap_setup_scripts_and_styles() {
    wp_register_style( 'leafletcss', 'https://unpkg.com/leaflet@1.5.1/dist/leaflet.css' );
    wp_enqueue_script( 'leafletjs', 'https://unpkg.com/leaflet@1.5.1/dist/leaflet.js');
	wp_enqueue_script( 'spotmap-handler',  plugins_url( 'public/js/maphandler.js', __FILE__ ),array('jquery'),false,true);

	wp_localize_script( 'spotmap-handler', 'spotmapjsobj', array(
		'ajax_url' => admin_url( 'admin-ajax.php' )
	) );
}

#https://byronyasgur.wordpress.com/2011/06/27/frontend-forward-facing-ajax-in-wordpress/
add_action( 'wp_ajax_the_ajax_hook', 'the_action_function' );
add_action( 'wp_ajax_nopriv_the_ajax_hook', 'the_action_function' );
/**
 * The function gets called when a client wants to view the spotmap
 */
function the_action_function(){
	/* this area is very simple but being serverside it affords the possibility of retreiving data from the server and passing it back to the javascript function */
	wp_send_json(spotmap_get_data());
}


add_action( 'spotmap_cron_hook', 'spotmap_cron_exec',10,0 );
/**
 * This function gets called by cron. It checks the SPOT API for new data. If so the GeoJSON gets updated.
 * NOTE: The SPOT API shouldn't be called more often than 150sec otherwise the servers ip will be blocked.
 */
function spotmap_cron_exec(){
    //get feed
    //TODO: should be editable in backend
    $spotmap_feed = '0XgPnzRoTYnfT09sX5LGl2vXsyfF3nsm6';
    $feedurl = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$spotmap_feed.'/message.json';
    $jsonraw = file_get_contents($feedurl);
	$json = json_decode($jsonraw,true)['response']['feedMessageResponse'];
	$messages_count = $json['count'];
	$messages = $json['messages']['message'];
	#loop through the data, if a msg is in the db all the others are there as well
	$update = false;
	global $wpdb;
	foreach((array)$messages as $msg){
		if(is_point_in_db($msg['id'])){
		  break;
		}
		$wpdb->insert(
			$wpdb->prefix."spotmap_points",
			array(
				'id' => $msg['id'],
				'message_type' => $msg['messageType'],
                'time' => $msg['unixTime'],
                'longitude' => $msg['longitude'],
                'latitude' => $msg['latitude'],
                'altitude' => $msg['altitude'],
                'battery_status' => $msg['batteryState']
			)
		);
	}
}

function spotmap_get_data(){
	global $wpdb;
	$points = $wpdb->get_results("SELECT id, message_type, time, longitude, latitude, altitude FROM " . $wpdb->prefix . "spotmap_points;");

	$data = array();
	$daycoordinates = array();
	$lasttime = null;
	foreach ($points as $key => $point){
		$newpoint = new stdClass();
		$newpoint->type = 'Feature';

		$geometry = new stdClass();
		$geometry->type = 'Point';
		$geometry->coordinates = array($point->longitude,$point->latitude);
		$newpoint->geometry=$geometry;

		$properties = new stdClass();
		$properties->id = $point->id;
		$properties->type = $point->message_type;
		$properties->time = $friendly_date = date_i18n( get_option('date_format'), $point->time );;
		$newpoint->properties = $properties;


		//TODO create a line between the points in chronological order
		/*if (($point->time - $lasttime) <= 43200){
			$daycoordinates[] = $geometry->coordinates;
		} else if (count($daycoordinates) > 1){
			$dayline = new stdClass();
			$dayline->type = "LineString";
			$dayline->coordinates = $daycoordinates;
			$data[] = $dayline;
			$daycoordinates = array();
		}
		$lasttime = $point->time;*/
		$data[] = $newpoint;
	}

	return $data;
}

add_shortcode( 'spotmap', 'spotmap_show' );
/**
 * @param $atts  height and weight of the map
 * @return string
 */
function spotmap_show( $atts ) {
	wp_enqueue_style('leafletcss');
	#if no attributes are provided use the default:
    $a = shortcode_atts( array(
		'height' => '400'
	), $atts );

	return '<div id="spotmap" style="height: '.$a['height'].'px;"></div>';
}

/**
 * This function checks whether a point stored in the db or not
 * @param $id The id of the point to check
 *
 * @return bool true if point with same id is in db else false
 */
function is_point_in_db($id){
	global $wpdb;
	$result = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE id = {$id}");
	if ($result == '1'){
		return true;
	}
	return false;
}