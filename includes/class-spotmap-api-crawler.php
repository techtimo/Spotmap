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
		if ( $this->api === 'findmespot' ) {
			return $this->get_data_findmespot($feed_name, $id, $pwd);
		} elseif ( $this->api === 'victron' ) {
			return $this->get_data_victron( $feed_name, $id, $pwd );
		} else{
			trigger_error( "API {$this->api} is unknown", E_USER_WARNING );
		}
	}

	/**
	 * Fetches the latest GPS position from the Victron VRM API for one installation
	 * and inserts it via insert_row(). The rolling-anchor deduplication in insert_row()
	 * suppresses stationary pings automatically, so this can safely be called on every
	 * cron tick regardless of how often the device actually moves.
	 *
	 * @param string $feed_name     Feed name (stored in DB).
	 * @param string $installation_id  Victron idSite, e.g. "522142".
	 * @param string $token         Personal access token.
	 * @return bool|null true on insert, false on API error, null if no GPS data.
	 */
	private function get_data_victron( string $feed_name, string $installation_id, string $token ) {
		$response = wp_remote_get(
			'https://vrmapi.victronenergy.com/v2/installations/' . rawurlencode( $installation_id ) . '/widgets/GPS',
			[
				'headers' => [ 'X-Authorization' => 'Token ' . $token ],
				'timeout' => 15,
			]
		);

		if ( is_wp_error( $response ) ) {
			return false;
		}

		$json = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $json['success'] ) ) {
			trigger_error( 'Victron API error for installation ' . $installation_id, E_USER_WARNING );
			return false;
		}

		$attrs       = $json['records']['data']['attributes'] ?? [];
		$seconds_ago = $attrs['secondsAgo']['value'] ?? null;
		if ( $seconds_ago === null ) {
			return null;
		}

		$lat   = isset( $attrs[4]['valueFloat'] )   ? (float) $attrs[4]['valueFloat']   : null;
		$lng   = isset( $attrs[5]['valueFloat'] )   ? (float) $attrs[5]['valueFloat']   : null;
		$speed = isset( $attrs[142]['valueFloat'] ) ? round( (float) $attrs[142]['valueFloat'] * 3.6, 2 ) : null; // m/s → km/h
		$alt   = isset( $attrs[584]['valueFloat'] ) ? (int) $attrs[584]['valueFloat']   : null;

		if ( $lat === null || $lng === null ) {
			return null;
		}

		$data = [
			'feed_name' => $feed_name,
			'feed_id'   => $installation_id,
			'type'      => 'TRACK',
			'time'      => time() - (int) $seconds_ago,
			'latitude'  => $lat,
			'longitude' => $lng,
		];
		if ( $speed !== null ) {
			$data['speed'] = $speed;
		}
		if ( $alt !== null ) {
			$data['altitude'] = $alt;
		}

		return $this->db->insert_row( $data ) !== false;
	}

	private function get_data_findmespot ($feed_name, $id, $pwd){
		$i = 0;
		while (true) {
			$feed_url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$id.'/message.json?start='.$i;
			if (!empty($pwd)) {
				$feed_url .= '&feedPassword=' . $pwd;
			}

			$jsonraw = wp_remote_retrieve_body( wp_remote_get( $feed_url ) );
			if(empty($jsonraw)){
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
