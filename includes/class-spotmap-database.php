<?php

class Spotmap_Database {

	public function get_all_feednames(){
		global $wpdb;
		return $wpdb->get_col("SELECT DISTINCT feed_name FROM " . $wpdb->prefix . "spotmap_points");
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

		$select = empty($filter['select']) ? "*": $filter['select'];
		$group_by = empty($filter['groupBy']) ? NULL: $filter['groupBy'];
		$order = empty($filter['orderBy']) ? NULL: "ORDER BY " . $filter['orderBy'];
		$limit = empty($filter['limit']) ? NULL: "LIMIT " . $filter['limit'];
		global $wpdb;
		$where = '';
		if(!empty($filter['feeds'])){
			$feeds_on_db = $this->get_all_feednames();
			foreach ($filter['feeds'] as $value) {
				if(!in_array($value,$feeds_on_db)){
					return ['error'=> true,'title'=>$value.' not found in DB','message'=> "Change the 'devices' attribute of your Shortcode"];
				}
			}
			$where .= "AND feed_name IN ('".implode("','", $filter['feeds']). "') ";
		}
		if(!empty($filter['type'])){
			$types_on_db = $this->get_all_types();
			$allowed_types = array_merge($types_on_db,['HELP-CANCEL','CANCEL','OK','CUSTOM','STATUS','STOP','NEWMOVEMENT','UNLIMITED-TRACK','TRACK','HELP']);
			foreach ($filter['type'] as $value) {
				if(!in_array($value,$allowed_types)){
					return ['error'=> true,'title'=>$value.' not found in DB','message'=> "Change the 'devices' attribute of your Shortcode"];
				}
			}
			$where .= "AND type IN ('".implode("','", $filter['type']). "') ";
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
		if(!empty($group_by)){
			$where.= " and id in (SELECT max(id) FROM " . $wpdb->prefix . "spotmap_points GROUP BY ".$group_by." )";
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
			if(!empty(get_option('spotmap_custom_messages')[$point->type])){
				$point->message = get_option('spotmap_custom_messages')[$point->type];
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
		global $wpdb;
		$result = $wpdb->insert(
			$wpdb->prefix."spotmap_points",	[
				'feed_name' => $point['feedName'],
				'id' => $point['id'],
				'type' => $point['messageType'],
				'time' => $point['unixTime'],
				'latitude' => $point['latitude'],
				'longitude' => $point['longitude'],
				'local_timezone' => NULL,
				'model' => $point['modelId'],
				'device_name' => $point['messengerName'],
				'altitude' => $point['altitude'],
				'battery_status' => $point['batteryState'],
				'message' => !empty($point['messageContent']) ? $point['messageContent'] : NULL,
				'custom_message' => !empty( get_option('spotmap_custom_messages')[$point['messageType']] ) ? get_option('spotmap_custom_messages')[$point['messageType']] : NULL,
				'feed_id' => $point['feedId']
			]
		);
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
