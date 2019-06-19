<?php
/**
 * Created by PhpStorm.
 * User: Work
 * Date: 6/19/2019
 * Time: 10:01 PM
 */
class Spotmap_Admin {

	public function __construct() {
	}

	public function enqueue_scripts(){
		//wp_enqueue_script( $this->plugin_name, plugin_dir_url( __FILE__ ) . 'js/plugin-name-admin.js', array( 'jquery' ));
	}
	public function add_cron_schedule($schedules){
		$schedules['twohalf_min'] = array(
			'interval' => 150,
			'display'  => esc_html__( 'Every 2.5 Minutes' ),
		);
		return $schedules;
	}
	public function add_options_page(){
		add_options_page( 'My Plugin Options', 'Spotmap', 'manage_options', 'spotmap', array($this,'display_options_page') );
	}

	public function register_settings(){
		register_setting( 'spotmap-settings-group', 'spotmap_feed_id','spotmap_validate_feed_id' );
		register_setting( 'spotmap-settings-group', 'spotmap_feed_password');
	}

	function spotmap_validate_feed_id($new_feed_id){
		$new_feed_id = sanitize_text_field($new_feed_id);
		$feedurl = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$new_feed_id.'/message.json';
		$jsonraw = file_get_contents($feedurl);
		$json = json_decode($jsonraw,true)['response'];
		//if feed is empty bail out here
		if ($json['errors']['error']['code'] === "E-0160"){
			add_settings_error( 'spotmap_feed_id', '', 'Error: The feed id is not valid. Please enter a valid one', 'error' );
			return get_option('spotmap_feed_id');
		}
		return $new_feed_id;
	}

	function display_options_page(){
		include_once  plugin_dir_path( dirname( __FILE__ ) ) . 'admin/partials/spotmap-admin-display.php';
	}
}