<?php

class Spotmap_Database {

	private const ALLOWED_COLUMNS = [
		'id', 'type', 'time', 'latitude', 'longitude', 'altitude',
		'battery_status', 'message', 'custom_message', 'feed_name',
		'feed_id', 'model', 'device_name', 'local_timezone',
	];

	private static function sanitize_select( string $select ): string {
		if ( $select === '*' ) {
			return '*';
		}
		$safe = array_filter(
			array_map( 'trim', explode( ',', $select ) ),
			fn( $col ) => in_array( $col, self::ALLOWED_COLUMNS, true )
		);
		return $safe ? implode( ', ', $safe ) : '*';
	}

	private static function sanitize_identifier( string $value ): ?string {
		$value = trim( $value );
		return in_array( $value, self::ALLOWED_COLUMNS, true ) ? $value : null;
	}

	private static function sanitize_order( string $order_by ): string {
		$safe = [];
		foreach ( array_map( 'trim', explode( ',', $order_by ) ) as $part ) {
			$tokens = preg_split( '/\s+/', $part, 2 );
			$col    = self::sanitize_identifier( $tokens[0] );
			if ( $col === null ) {
				continue;
			}
			$dir    = strtoupper( $tokens[1] ?? '' );
			$safe[] = $col . ( $dir === 'DESC' ? ' DESC' : ( $dir === 'ASC' ? ' ASC' : '' ) );
		}
		return $safe ? 'ORDER BY ' . implode( ', ', $safe ) : '';
	}

	/**
	 * Loads option helper dependencies used by the database layer.
	 *
	 * @return void
	 */
	function __construct() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-options.php';
	}

	/**
	 * Create (or update) the plugin table. Safe to call multiple times via dbDelta.
	 */
	public static function create_table(): void {
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();
		$sql = "CREATE TABLE {$wpdb->prefix}spotmap_points (
		    `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
		    `type` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,
		    `time` int(11) unsigned NOT NULL,
		    `latitude` float(11,7) NOT NULL,
		    `longitude` float(11,7) NOT NULL,
		    `altitude` int(11) DEFAULT NULL,
		    `battery_status` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `custom_message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `feed_name` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `feed_id` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `model` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `device_name` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `local_timezone` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    PRIMARY KEY (`id`),
		    UNIQUE KEY `id_UNIQUE` (`id`)
		    ) $charset_collate";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql, true );
	}

	public function get_all_feednames(){
		global $wpdb;
		$from_db = $wpdb->get_col("SELECT DISTINCT feed_name FROM " . $wpdb->prefix . "spotmap_points WHERE feed_name IS NOT NULL");
		$configured = Spotmap_Options::get_feeds();
		$from_options = array_column( $configured, 'name' );
		return array_values( array_unique( array_merge( $from_options, $from_db ) ) );
	}
	public function get_all_types(){
		global $wpdb;
		return $wpdb->get_col("SELECT DISTINCT type FROM " . $wpdb->prefix . "spotmap_points");
	}
	public function get_last_point($feed_id = null){
		global $wpdb;
		$where = ' ';
		if(isset($feed)){
			$where .= "AND feed_id = '".$feed_id."' ";
		}
		return $wpdb->get_row("SELECT * FROM " . $wpdb->prefix . "spotmap_points WHERE 1 ".$where." ORDER BY id DESC LIMIT 1");
	}


	public function get_points($filter){
		// error_log(print_r($filter,true));

		$select   = self::sanitize_select( $filter['select'] ?? '*' );
		$group_by = empty( $filter['groupBy'] ) ? null : self::sanitize_identifier( $filter['groupBy'] );
		$order    = empty( $filter['orderBy'] ) ? '' : self::sanitize_order( $filter['orderBy'] );
		$limit    = empty( $filter['limit'] )   ? '' : 'LIMIT ' . absint( $filter['limit'] );
		global $wpdb;
		$where = '';
		if(!empty($filter['feeds'])){
			$feeds_on_db = $this->get_all_feednames();
			foreach ($filter['feeds'] as $value) {
				if(!in_array($value,$feeds_on_db)){
					return ['error'=> true,'title'=>$value.' not found in DB','message'=> "Change the 'devices' attribute of your Shortcode"];
				}
			}
			$placeholders = implode( ', ', array_fill( 0, count( $filter['feeds'] ), '%s' ) );
			// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
			$where .= $wpdb->prepare( "AND feed_name IN ($placeholders) ", ...$filter['feeds'] );
		}
		if(!empty($filter['type'])){
			$types_on_db = $this->get_all_types();
			$allowed_types = array_merge($types_on_db,['HELP-CANCEL','CANCEL','OK','CUSTOM','STATUS','STOP','NEWMOVEMENT','UNLIMITED-TRACK','TRACK','HELP']);
			foreach ($filter['type'] as $value) {
				if(!in_array($value,$allowed_types)){
					return ['error'=> true,'title'=>$value.' not found in DB','message'=> "Change the 'devices' attribute of your Shortcode"];
				}
			}
			$placeholders = implode( ', ', array_fill( 0, count( $filter['type'] ), '%s' ) );
			// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
			$where .= $wpdb->prepare( "AND type IN ($placeholders) ", ...$filter['type'] );
		}

		// either have a day or a range
		$date;
		if(!empty($filter['date'])){
			$date = date_create($filter['date']);
			if($date != null){
				$date = date_format( $date,"Y-m-d" );
				$where .= "AND FROM_UNIXTIME(time) between '" . $date . " 00:00:00' and  '" . $date . " 23:59:59' ";
			}
		} else if(!empty($filter['date-range'])){
			if(!empty($filter['date-range']['to'])){
				
				$date = date_create($filter['date-range']['to']);
				if(substr($filter['date-range']['to'],0,5) == 'last-'){
					$rel_string = substr($filter['date-range']['to'],5);
					$rel_string = str_replace("-"," ",$rel_string);
					$date = date_create("@".strtotime('-'.$rel_string));
				}

				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) <= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			} 
			if (!empty($filter['date-range']['from'])){
				$date = date_create($filter['date-range']['from']);
				if(substr($filter['date-range']['from'],0,5) == 'last-'){
					$rel_string = substr($filter['date-range']['from'],5);
					$rel_string = str_replace("-"," ",$rel_string);
					$date = date_create("@".strtotime('-'.$rel_string));
				}
				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) >= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			} 
		}
		if ( ! empty( $group_by ) ) {
			$where .= " AND id IN (SELECT max(id) FROM " . $wpdb->prefix . "spotmap_points GROUP BY " . $group_by . " )";
		}
		$query = "SELECT ".$select.", custom_message FROM " . $wpdb->prefix . "spotmap_points WHERE 1 ".$where." ".$order. " " .$limit;
		// error_log("Query: " .$query);
		$points = $wpdb->get_results($query);
		foreach ($points as &$point){
			$point->unixtime = $point->time;
			// $point->date = date_i18n( get_option('date_format'), $date );
			$point->date = wp_date(get_option('date_format'),$point->unixtime);
			$point->time = wp_date(get_option('time_format'),$point->unixtime);
			if(!empty($point->local_timezone)){
				$timezone = new DateTimeZone($point->local_timezone);
				$point->localdate = wp_date(get_option('date_format'),$point->unixtime,$timezone);
				$point->localtime = wp_date(get_option('time_format'),$point->unixtime,$timezone);
			}

			if(!empty($point->custom_message)){
				$point->message = $point->custom_message;
			}
			$custom_message = Spotmap_Options::get_custom_message($point->type);
			if(!empty($custom_message)){
				$point->message = $custom_message;
			}
		}
		return $points;
	}

	public function insert_point($point,$multiple = false){
		// error_log(print_r($point,true));
		if($point['unixTime'] == 1){
			return 0;
		}
		$last_point = $this->get_last_point($point['feedId']);
		
		if($point['latitude'] > 90 || $point['latitude']< -90){
			$point['latitude'] = $last_point->latitude;
		}
		if ($point['longitude'] > 180 || $point['longitude']< -180){
			$point['longitude'] = $last_point->longitude;
		}
		$custom_message = Spotmap_Options::get_custom_message($point['messageType']);
		$data = [
			'feed_name' => $point['feedName'],
			'type' => $point['messageType'],
			'time' => $point['unixTime'],
			'latitude' => $point['latitude'],
			'longitude' => $point['longitude'],
			'model' => $point['modelId'],
			'device_name' => $point['messengerName'],
			'message' => !empty($point['messageContent']) ? $point['messageContent'] : NULL,
			'custom_message' => !empty($custom_message) ? $custom_message : NULL,
			'feed_id' => $point['feedId']
		];
		if (array_key_exists('id', $point)){
			$data['id']= $point['id'];
		}
		if (array_key_exists('battery_status', $point)){
			$data['battery_status']= $point['batteryState'];
		}
		if (array_key_exists('altitude', $point)){
			$data['altitude']= $point['altitude'];
		}
		if (array_key_exists('local_timezone', $point)){
			$data['local_timezone']= $point['local_timezone'];
		}
		global $wpdb;
		$result = $wpdb->insert($wpdb->prefix."spotmap_points",	$data);
		
		// schedule event to calc local timezone 
		wp_schedule_single_event( time(), 'spotmap_get_timezone_hook' );
		return $result;
	}
	/**
	 * This function checks if a point is preseent in the db
     * @param $id int The id of the point to check
	 *
	 * @return bool true if point with same id is in db else false
	 */
	function does_point_exist($id){
		global $wpdb;
		$result = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE id = {$id}");
		return $result ? true : false;
	}
	
	function does_media_exist($attachment_id){
		global $wpdb;
		$result = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE model = {$attachment_id}");
		return $result ? true : false;
	}
	function delete_media_point($attachment_id){
		global $wpdb;
		$result = $wpdb->delete($wpdb->prefix . 'spotmap_points', array('model' => $attachment_id));

		return $result ? true : false;
	}
	/**
	 * Update the latitude/longitude of a single point.
	 *
	 * @param int   $id        Row ID.
	 * @param float $latitude  New latitude  (-90 … 90).
	 * @param float $longitude New longitude (-180 … 180).
	 * @return bool True on success, false on invalid coordinates or DB error.
	 */
	public function update_point_position( int $id, float $latitude, float $longitude ): bool {
		if ( $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180 ) {
			return false;
		}
		global $wpdb;
		$result = $wpdb->update(
			$wpdb->prefix . 'spotmap_points',
			[ 'latitude' => $latitude, 'longitude' => $longitude ],
			[ 'id' => $id ],
			[ '%f', '%f' ],
			[ '%d' ]
		);
		return $result !== false;
	}

	function rename_feed_name ($old_name,$new_name){
		global $wpdb;
		// error_log('reanem feed');
			$wpdb->query( $wpdb->prepare( "
			UPDATE `{$wpdb->prefix}spotmap_points`
			SET `feed_name` = %s
			WHERE feed_name = %s",
			[$new_name,$old_name]
		) );
		// error_log(print_r($wpdb->queries,true));

	}

}
