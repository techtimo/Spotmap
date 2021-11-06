<?php

class Spotmap_Api_Crawler {
	private $api;
	public $db;

	function __construct(String $api_provider) {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		$this->db = new Spotmap_Database();
		$this->api = $api_provider;
	}
	
	public function get_data( $feed_name, $id, $pwd = ""){
		if($this->api == 'findmespot'){
			// error_log($feed_name. $id.$pwd);
			return $this->get_data_findmespot($feed_name, $id, $pwd);
		} else{
			trigger_error('API ${this->api} is unknown', E_USER_WARNING);
		}
	}

	private function get_data_findmespot ($feed_name, $id, $pwd){
		// error_log($feed_name. $id . $pwd);
		$i = 0;
		while (true) {
			$feed_url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$id.'/message.json?start='.$i;
			if (!empty($pwd)) {
				$feed_url .= '&feedPassword=' . $pwd;
			}
			
			// error_log($feed_url);
			$jsonraw = wp_remote_retrieve_body( wp_remote_get( $feed_url ) );
			if(empty($jsonraw)){
				// error_log("Empty Response");
				return false;
			}
	
			$json = json_decode($jsonraw, true)['response'];

			if (!empty($json['errors']['error']['code'])) {
				//E-0195 means the feed has no points to show
				$error_code = $json['errors']['error']['code'];
				if ($error_code === "E-0195") {
					return false;
				}
				trigger_error($json['errors']['error']['description'], E_USER_WARNING);
				return false;
			}
			$messages = $json['feedMessageResponse']['messages']['message'];
			
			
			// loop through the data, if a msg is in the db all the others are there as well
			foreach ((array)$messages as &$point) {
				if ($this->db->does_point_exist($point['id'])) {
					// trigger_error($point['id']. " already exists", E_USER_WARNING);
					return;
				}
				$point['feedName'] = $feed_name;
				$point['feedId'] = $id;
				$this->db->insert_point($point);
			}
			$i += $json['feedMessageResponse']['count'] + 1;
			return true;
		}

	}
}
