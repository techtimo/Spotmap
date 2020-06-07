<?php

class Spotmap_Database {

	public function get_all_feednames(){
		global $wpdb;
		return $wpdb->get_col("SELECT DISTINCT feed_name FROM " . $wpdb->prefix . "spotmap_points");
	}

	public function get_points($filter){
		// error_log(print_r($filter,true));
		global $wpdb;
		$where = '';
		if(isset($filter['devices'])){
			$devices_on_db = $this->get_all_feednames();
			foreach ($filter['devices'] as $value) {
				if(!in_array($value,$devices_on_db)){
					return ['error'=> true,'title'=>$value.' not found in DB','message'=> "Change the 'devices' attribute of your Shortcode"];
				}
			}
			$where .= "AND feed_name IN ('".implode("','", $filter['devices']). "') ";
		}
		
		// either have a day or a range
		$date;
		if(!empty($filter['date'])){
			$date = date_create($filter['date']);
			if($date != null){
				$date = date_format( $date,"Y-m-d" );
				$where .= "AND FROM_UNIXTIME(time) between '" . $date . " 00:00:00' and  '" . $date . " 23:59:59' ";
			}
		} else{
			if(!empty($filter['date-range-to'])){
				$date = date_create($filter['date-range-to']);
				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) <= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			}
			if(!empty($filter['date-range-from'])){
				$date = date_create($filter['date-range-from']);
				if($date != null){
					$where .= "AND FROM_UNIXTIME(time) >= '" . date_format( $date,"Y-m-d H:i:s" ) . "' ";
				}
			}
		}
		// error_log("Where: " .$where);
		return $wpdb->get_results("SELECT * FROM " . $wpdb->prefix . "spotmap_points WHERE 1 ".$where."ORDER BY feed_name, time;");
	}
	public function insert_point($point,$multiple = false){
		// TODO check if point is valid
		global $wpdb;
		if(empty($point['messageContent']))
			$point['messageContent'] = null;
		$wpdb->insert(
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
