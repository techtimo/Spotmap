<?php
/**
 * Created by PhpStorm.
 * User: Work
 * Date: 6/19/2019
 * Time: 10:17 PM
 */
class Spotmap_Public{

	private $plugin_name;

	public function __construct($plugin_name) {

		$this->plugin_name = $plugin_name;

	}

	public function enqueue_styles() {
        // wp_register_style('leafletfullscreencss', 'https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/leaflet.fullscreen.css');
    }

	public function enqueue_scripts(){
        wp_enqueue_script('leafletjs',  plugins_url( 'leaflet/leaflet.js', __FILE__ ));
        wp_enqueue_script('leafletfullscreenjs',plugin_dir_url( __FILE__ ) . 'leafletfullscreen/leaflet.fullscreen.js');
        wp_enqueue_script('spotmap-handler', plugins_url('js/maphandler.js', __FILE__), array('jquery'), false, true);

        wp_localize_script('spotmap-handler', 'spotmapjsobj', array(
			'ajax_url' => admin_url( 'admin-ajax.php' )
		));
	}
	public function register_shortcodes(){
		add_shortcode('spotmap', array($this,'show_spotmap') );
	}

	function show_spotmap($atts){
        wp_enqueue_style( 'leafletcss', plugin_dir_url( __FILE__ ) . 'leaflet/leaflet.css');
        wp_enqueue_style( 'leafletfullscreencss', plugin_dir_url( __FILE__ ) . 'leafletfullscreen/leaflet.fullscreen.css');
        // if no attributes are provided use the default:
		$a = shortcode_atts( array(
			'height' => '400',
            'mapcenter' => 'all'
		), $atts );

		return '<div data-mapcenter="' . $a['mapcenter'] . '" id="spotmap" style="height: '.$a['height'].'px;max-width: 100%;"></div>';
	}

	/**
	 * This function gets called by cron. It checks the SPOT API for new data. If so the GeoJSON gets updated.
	 * NOTE: The SPOT API shouldn't be called more often than 150sec otherwise the servers ip will be blocked.
     * TODO: atm this only scrapes the last 50 messages. if a new feed id is added, it has to loop through all messages
	 */
	function get_feed_data(){
        $feed_url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/' . get_option('spotmap_feed_id') . '/message.json';
        if (!empty(get_option('spotmap_feed_password'))) {
            $feed_url .= '?feedPassword=' . get_option('spotmap_feed_password');
        }
		$jsonraw = wp_remote_retrieve_body( wp_remote_get( $feed_url ) );

        $json = json_decode($jsonraw, true)['response'];
        if (!empty($json['errors']['error']['code'])) {
            //E-0195 means the feed has no points to show
            $error_code = $json['errors']['error']['code'];
            if ($error_code === "E-0195") {
                return;
            }
            //TODO: retrieve a list of possible errors
            trigger_error('Unknown error: ' . $error_code, E_USER_WARNING);
        }
        $messages = $json['feedMessageResponse']['messages']['message'];
        // loop through the data, if a msg is in the db all the others are there as well


        foreach ((array)$messages as $msg) {
            if ($this->db_does_point_exist($msg['id'])) {
                return;
            }
            $this->db_insert_point($msg['id'], $msg['messageType'], $msg['unixTime'], $msg['longitude'], $msg['latitude'], $msg['altitude'], $msg['batteryState']);
        }
	}

	public function the_action_function(){
		wp_send_json($this->spotmap_get_data());
	}

	private function db_insert_point(
        $point_id,
        $type,
        $timestamp,
        $longitude,
        $latitude,
        $altitude,
        $battery_status,
        $custom_message = '')
    {

		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix."spotmap_points",
			array(
				'id' => $point_id,
                'type' => $type,
				'time' => $timestamp,
				'longitude' => $longitude,
				'latitude' => $latitude,
				'altitude' => $altitude,
                'battery_status' => $battery_status,
                'custom_message' => $custom_message
			)
		);
	}


	/**
	 * This function checks if a point is stored is preseent in the db
     * @param $id int The id of the point to check
	 *
	 * @return bool true if point with same id is in db else false
	 */
	function db_does_point_exist($id){
		global $wpdb;
		$result = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE id = {$id}");
		if ($result == '1'){
			return true;
		}
		return false;
	}

	public function spotmap_get_data(){
		global $wpdb;
        $points = $wpdb->get_results("SELECT id, type, time, longitude, latitude, altitude, custom_message FROM " . $wpdb->prefix . "spotmap_points ORDER BY time;");

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
            $properties->type = $point->type;
            $properties->message = $point->custom_message;

			$properties->time = date_i18n( get_option('time_format'), $point->time );
			$properties->date = date_i18n( get_option('date_format'), $point->time );
			$newpoint->properties = $properties;
			$data[] = $newpoint;

			//TODO find the bug below to have a line connecting each day
			//looks like proper geojson but leaflet don't like it
			/*if (($point->time - $lasttime) <= 43200){
				$daycoordinates[] = $geometry->coordinates;
			} else if (count($daycoordinates) > 1){
				$geometry = new stdClass();
				$geometry->type = "LineString";
				$geometry->coordinates = $daycoordinates;

				$dayline = new stdClass();
				$dayline->type = "Feature";
				$dayline->geometry = $geometry;

				$data[] = $dayline;
				$daycoordinates = array();
			}
			$lasttime = $point->time;*/

		}

		return $data;
	}

}