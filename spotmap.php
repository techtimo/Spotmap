<?php
/*
Plugin Name: Spotmap
Plugin URI: http://URI_Of_Page_Describing_Plugin_and_Updates
Description: A brief description of the Plugin.
Version: 1.0
Author: Dell E7240
Author URI: http://URI_Of_The_Plugin_Author
License:      GPL2
License URI:  https://www.gnu.org/licenses/gpl-2.0.html

    Spotmap is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    any later version.

    Spotmap is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Spotmap. If not, see https://www.gnu.org/licenses/gpl-2.0.html.
*/

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
register_activation_hook( __FILE__, 'spotmap_activation' );


function spotmap_deactivation(){

	wp_unschedule_event( time(), 'spotmap_cron_hook' );

}
register_deactivation_hook( __FILE__, 'spotmap_deactivation' );


function spotmap_add_cron_interval( $schedules ) {
	$schedules['twohalf_min'] = array(
		'interval' => 150,
		'display'  => esc_html__( 'Every 2.5 Minutes' ),
	);

	return $schedules;
}
add_filter( 'cron_schedules', 'spotmap_add_cron_interval' );


/**
 * This function should be called by cron. It checks the spot api for new waypoints. if there are new points they are stored to the db.
 * NOTE: The spot api shouldn't be called more often than 150sec otherwise the servers ip will be blocked.
 */
function spotmap_cron_exec(){
    //get feed
    $spotmap_feed = '0XgPnzRoTYnfT09sX5LGl2vXsyfF3nsm6';
    $feedurl = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$spotmap_feed.'/message.json';
    $jsonraw = file_get_contents($feedurl);
	$json = json_decode($jsonraw,true)['response']['feedMessageResponse'];
	$messages_count = $json['count'];
	$messages = $json['messages']['message'];
	global $wpdb;
	foreach($messages as $msg){
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
	spotmap_update_kml();
}

add_action( 'spotmap_cron_hook', 'spotmap_cron_exec',10,0 );

function spotmap_update_kml(){

    $kml ="<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<kml xmlns=\"http://earth.google.com/kml/2.0\">
<Document>
      <name>Spot Track</name>
      <Style id=\"Track\">
         <LineStyle>
            <color>ff0000f9</color>
            <width>2</width>
         </LineStyle>
         <PolyStyle>
            <color>ff0000f9</color>
         </PolyStyle>
      </Style>";

	global $wpdb;
	$points = $wpdb->get_results("SELECT id, message_type, time, longitude, latitude, altitude FROM " . $wpdb->prefix . "spotmap_points;");

	$coordinates='';
	foreach ($points as $point){
		// Creates a Placemark and append it to the Document.
        $kml.='<Placemark id="'.$point->id.'">
        <name>'.$point->message_type.'</name>
        <description>Time: ' . gmdate('M d Y H:i:s',$point->time) . '</description>
        <Point>
          <coordinates>'.$point->longitude.','.$point->latitude.',0</coordinates>
        </Point>
      </Placemark>';
        $coordinates.=$point->longitude.','.$point->latitude.',0
        ';
    }

    $kml.='<Placemark>
         <name>Spot Track</name>
         <styleUrl>#Track</styleUrl>
         <LineString>
            <tessellate>1</tessellate>
            <altitudeMode>clampToGround</altitudeMode>
			   <coordinates>'.$coordinates.'</coordinates>
   		</LineString>
   	</Placemark>';
    $kml.='</Document></kml>';

	$file = fopen('spotmap.kml','w');
	fwrite($file,$kml);
	fclose($file);
}


function spotmap_show( $atts ) {
	$a = shortcode_atts( array(
		'width' => '400',
		'height' => '400',
	), $atts );

	$spotmap_kml_url = "http://2-camp.com/spotmap.kml";//urlencode(site_url()."/spotmap.kml");
	$spotmap_iframe = "<iframe width=\"".$a['width']."\" height=\"".$a['height']."]\" frameborder=\"0\" scrolling=\"no\" marginheight=\"0\" marginwidth=\"0\" src=\"http://www.topomap.co.nz/NZTopoMapEmbedded?v=2&z=12&kml=$spotmap_kml_url\"></iframe>";
	return $spotmap_iframe;
}
add_shortcode( 'spotmap', 'spotmap_show' );


/**
 * This function checks wether a point stored in the db or not
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