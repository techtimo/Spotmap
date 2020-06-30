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

	public function get_points($filter,$select = '*',$group_by='',$order= 'feed_name, time'){
		error_log(print_r($filter,true));
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
				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) <= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			} 
			if (!empty($filter['date-range']['from'])){
				$date = date_create($filter['date-range']['from']);
				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) >= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			} 
		}
		if(!empty($group_by)){
			$where.= " and id in (SELECT max(id) FROM " . $wpdb->prefix . "spotmap_points GROUP BY ".$group_by." )";
		}
		$query = "SELECT ".$select." FROM " . $wpdb->prefix . "spotmap_points WHERE 1 ".$where." ORDER BY ".$order;
		error_log("Query: " .$query);
		$points = $wpdb->get_results($query);
		error_log(print_r($points[0],true ));
		$date = new DateTime("@".$points[0]->time);
		// $date->setTimestamp(intval($points[0]->time));
		// error_log($date);

		foreach ($points as &$point){
			$point->unixtime = $point->time;
			$date = new DateTime();
			// $date = date_create_from_format('U', $point->unixtime,);
			// error_log(gettype($point->unixtime));
			// date_timestamp_set($date, intval($point->unixtime));
			// $date->setTimestamp($point->unixtime);
			$date->setTimezone(wp_timezone());



			// $point->date = date_i18n( get_option('date_format'), $date );
			$point->date = wp_date(get_option('date_format'),intval($point->unixtime));
			$point->time = wp_date(get_option('time_format'),intval($point->unixtime));
		}
		return $points;
	}

	public function insert_point($point,$multiple = false){
		// error_log(print_r($point,true));
		$last_point = $this->get_last_point($point['feedId']);
		
		if($point['latitude'] > 90 || $point['latitude']< -90){
			$point['latitude'] = $last_point->latitude;
		}
		if ($point['longitude'] > 180 || $point['longitude']< -180){
			$point['longitude'] = $last_point->longitude;
		}
		global $wpdb;
		return $wpdb->insert(
			$wpdb->prefix."spotmap_points",
			array(
				'feed_name' => $point['feedName'],
				'id' => $point['id'],
				'type' => $point['messageType'],
				'time' => $point['unixTime'],
				'latitude' => $point['latitude'],
				'longitude' => $point['longitude'],
				'altitude' => $point['altitude'],
				'battery_status' => $point['batteryState'],
				'custom_message' => $point['messageContent'],
				'feed_id' => $point['feedId']
			)
		);
	}
		/**
	 * This function checks if a point is stored is preseent in the db
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
