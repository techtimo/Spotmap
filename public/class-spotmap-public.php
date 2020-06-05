<?php
class Spotmap_Public{

	public function enqueue_styles() {
		wp_enqueue_style( 'leafletcss', plugin_dir_url( __FILE__ ) . 'leaflet/leaflet.css');
		wp_enqueue_style( 'custom', plugin_dir_url( __FILE__ ) . 'css/custom.css');
        wp_enqueue_style( 'leafletfullscreencss', plugin_dir_url( __FILE__ ) . 'leafletfullscreen/leaflet.fullscreen.css');
    }

	public function enqueue_block_editor_assets(){
		$this->enqueue_scripts();
		$this->enqueue_styles();
		wp_enqueue_script(
			'spotmap-block',
			plugins_url('js/block.js', __FILE__),
			['wp-blocks', 'wp-element']
		);
	}

	public function enqueue_scripts(){
        wp_enqueue_script('leafletjs',  plugins_url( 'leaflet/leaflet.js', __FILE__ ));
        wp_enqueue_script('leafletfullscreenjs',plugin_dir_url( __FILE__ ) . 'leafletfullscreen/leaflet.fullscreen.js');
        wp_enqueue_script('spotmap-handler', plugins_url('js/maphandler.js', __FILE__), array('jquery'), false, true);
		
		$maps = new stdClass();
		$maps->OpenTopoMap = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
		$maps->Landscape = "http://{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png";
		

		
		wp_localize_script('spotmap-handler', 'spotmapjsobj', array(
			'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			'maps' => $maps,
			'url' =>  plugin_dir_url( __FILE__ )

		));
	}
	public function register_shortcodes(){
		add_shortcode('spotmap', [$this,'show_spotmap'] );
	}

	function show_spotmap($atts,$content){
		error_log(wp_json_encode($atts));
		// if no attributes are provided use the default:
			$a = shortcode_atts( array(
				'height' => '500',
				'mapcenter' => 'all',
				'devices' => [],
				'colors' => '',
				'splitlines' => '',
				'date-range-from' => '',
				'date' => '',
				'date-range-to' => '',
			), $atts );
			
			$a['devices'] = explode(',',$a['devices']);
			$a['splitlines'] = explode(',',$a['splitlines']);
			$a['colors'] = explode(',',$a['colors']);
			// check if length is the same or del color array
		$styles = [];
		foreach ($a['devices'] as $key => $value) {
			$styles[$value] = [
				'color'=>$a['colors'][$key],
				'splitLines' => $a['splitlines'][$key]
				];
		}
		// generate the option object for init the map
		$options = wp_json_encode([
			'devices' => $a['devices'],
			'styles' => $styles,
			'date' => $a['date'],
			'dateRange' => [
				'from' => $a['date-range-from'],
				'to' => $a['date-range-to']
			],
			'mapcenter' => $a['mapcenter']
		]);
		error_log($options);


		return '<div id="spotmap-container" style="height: '.$a['height'].'px;max-width: 100%;"></div><script type=text/javascript>jQuery( document ).ready(function() {initMap('.$options.');});</script>';
	}

	/**
	 * This function gets called by cron. It checks the SPOT API for new data.
	 * Note: The SPOT API shouldn't be called more often than 150sec otherwise the servers ip will be blocked.
	 */
	function get_feed_data(){
		error_log("cron job started");
        if (!get_option('spotmap_options')) {
			trigger_error('no values found');
			return;
		}
		foreach (get_option("spotmap_options") as $key => $count) {
			if($count < 1){
				continue;
			}
			for ($i=0; $i < $count; $i++) {
				if($key == 'findmespot'){
					$name = get_option('spotmap_'.$key.'_name'.$i);
					$id = get_option('spotmap_'.$key.'_id'.$i);
					$pwd = get_option('spotmap_'.$key.'_password'.$i);
					$this->get_spot_data($name, $id, $pwd);
				}
			}
		}
	}

	private function get_spot_data ($device, $id, $pwd = ""){
		$i = 0;
		while (true) {
			$feed_url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$id.'/message.json?start='.$i;
			if ($pwd != "") {
				$feed_url .= '&feedPassword=' . $pwd;
			}
			$jsonraw = wp_remote_retrieve_body( wp_remote_get( $feed_url ) );
	
			$json = json_decode($jsonraw, true)['response'];

			if (!empty($json['errors']['error']['code'])) {
				//E-0195 means the feed has no points to show
				$error_code = $json['errors']['error']['code'];
				if ($error_code === "E-0195") {
					return;
				}
				trigger_error($json['errors']['error']['description'], E_USER_WARNING);
				return;
			}
			$messages = $json['feedMessageResponse']['messages']['message'];
			
			
			// loop through the data, if a msg is in the db all the others are there as well
			foreach ((array)$messages as $msg) {
				if ($this->db_does_point_exist($msg['id'])) {
					trigger_error($msg['id']. " already exists", E_USER_WARNING);
					return;
				}
				$this->db_insert_point($device, $msg['id'], $msg['messageType'], $msg['unixTime'], $msg['longitude'], $msg['latitude'], $msg['altitude'], $msg['batteryState'],$msg['messageContent']);
			}
			$i += $json['feedMessageResponse']['count'] + 1;
		}

	}

	public function the_action_function(){
		error_log(print_r($_POST,true));
		wp_send_json($this->db_get_data($_POST));
	}

	private function db_insert_point( $device,
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
				'device' => $device,
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

	public function db_get_data($atts){
		global $wpdb;
		$where = '';
		if(isset($atts['devices'])){
			$devices_on_db = $wpdb->get_col("SELECT DISTINCT device FROM " . $wpdb->prefix . "spotmap_points");
			foreach ($atts['devices'] as $value) {
				if(!in_array($value,$devices_on_db)){
					return ['error'=> true,'title'=>$value.' not found in DB','message'=> "Change the 'devices' attribute of your Shortcode"];
				}
			}
			$where .= "AND device IN ('".implode("','", $atts['devices']). "') ";
		}
		
		// either have a day or a range
		$date;
		if(!empty($atts['date'])){
			$date = date_create($atts['date']);
			if($date != null){
				$date = date_format( $date,"Y-m-d" );
				$where .= "AND FROM_UNIXTIME(time) between '" . $date . " 00:00:00' and  '" . $date . " 23:59:59' ";
			}
		} else{
			if(!empty($atts['date-range-to'])){
				$date = date_create($atts['date-range-to']);
				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) <= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			}
			if(!empty($atts['date-range-from'])){
				$date = date_create($atts['date-range-from']);
				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) >= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			}
		}
		error_log("Where: " .$where);
		$points = $wpdb->get_results("SELECT * FROM " . $wpdb->prefix . "spotmap_points WHERE 1 ".$where."ORDER BY device, time;");
		
		if(empty($points)){
			return ['error'=> true,
				'title'=> "No data found",
				'message'=> "Check your configuration"
			];
		}
		foreach ($points as &$point){
			$point->unixtime = $point->time;
			$point->date = date_i18n( get_option('date_format'), $point->time );
			$point->time = date_i18n( get_option('time_format'), $point->time );
		}

		return $points;
	}

}
