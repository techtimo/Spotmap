<?php

class Spotmap_Admin {

	public $db;

	function __construct() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		$this->db = new Spotmap_Database();
	}
	
	public function enqueue_scripts(){
		wp_enqueue_script('spotmap-settings', plugins_url('js/settings.js', __FILE__), ['jquery'], false, true);
	}
	public function add_cron_schedule($schedules){
		$schedules['twohalf_min'] = array(
			'interval' => 150,
			'display'  => esc_html__( 'Every 2.5 Minutes' ),
		);
		return $schedules;
	}
	public function add_options_page(){
		add_options_page( 'Spotmap Options', 'Spotmap 🗺', 'manage_options', 'spotmap', [$this,'display_options_page'] );
	}

	public function register_settings(){

		// FEED SECTION
		foreach (get_option("spotmap_api_providers") as $provider => $name) {
			$ids = get_option("spotmap_".$provider."_id");
			
			$count = empty($ids) ? 1 : count($ids);

			register_setting( 'spotmap-feed-group', 'spotmap_'.$provider.'_name',['sanitize_callback'=>[$this, 'spotmap_validate_feed_name']]);
			register_setting( 'spotmap-feed-group', 'spotmap_'.$provider.'_id', ['sanitize_callback'=>[$this, 'spotmap_validate_feed_id']]);
			register_setting( 'spotmap-feed-group', 'spotmap_'.$provider.'_password');
			if($count < 1){
				continue;
			}
			add_settings_section(
				$provider.'-feeds',
				$name,
				[$this,'settings_section_'.$provider],
				'spotmap-feed-group'
			);
			for ($i=0; $i < $count; $i++) { 
				$settings = [
					'name' => ['label' => __('Feed Name'), 'function' => 'generate_text_field'], 
					'id' => ['label' => __('Feed Id'), 'function' => 'generate_text_field'], 
					'password' => ['label' => __('Feed password'), 'function' => 'generate_password_field'], 
				];
				foreach ($settings as $key => $value) {
					$pre_populated_value = '';
					$option = get_option('spotmap_'.$provider.'_' . $key . '');
					if (!empty($option)){
						$pre_populated_value =  get_option('spotmap_'.$provider.'_' . $key . '')[$i];
					}
					add_settings_field(
						'spotmap_'.$provider.'_' . $key . '['.$i.']',
						$value["label"],
						[$this, $value["function"]],
						'spotmap-feed-group',
						'findmespot-feeds',
						['spotmap_'.$provider.'_' . $key . '['.$i.']',
						$pre_populated_value]
					);
				}
			}
		}

		// GENERAL SECTION
		register_setting( 'spotmap-messages-group', 'spotmap_custom_messages');
		add_settings_section(
			'spotmap-messages',
			__('Set Custom messages'),
			[$this,'settings_section_messages'],
			'spotmap-messages-group'
		);
		foreach (['HELP','HELP-CANCEL','CUSTOM','OK','STATUS','UNLIMITED-TRACK','NEWMOVEMENT','STOP'] as $index) {
			$value = isset( get_option('spotmap_custom_messages')[$index] ) ? get_option('spotmap_custom_messages')[$index] : '';
			add_settings_field(
				'spotmap_custom_messages['.$index.']',
				$index,
				[$this, 'generate_text_area'],
				'spotmap-messages-group',
				'spotmap-messages',
				['spotmap_custom_messages['.$index.']', $value
				]
			);
		}
		register_setting( 'spotmap-thirdparties-group', 'spotmap_api_tokens');
		add_settings_section(
			'spotmap-thirdparty',
			__('Thirdparty API Tokens'),
			'',
			'spotmap-thirdparties-group'
		);
		foreach (['mapbox','thunderforest','timezonedb','linz.govt.nz','geoservices.ign.fr','osdatahub.os.uk'] as $index) {
			$value = isset( get_option('spotmap_api_tokens')[$index] ) ? get_option('spotmap_api_tokens')[$index] : '';
			add_settings_field(
				'spotmap_api_tokens['.$index.']',
				$index,
				[$this, 'generate_text_field'],
				'spotmap-thirdparties-group',
				'spotmap-thirdparty',
				['spotmap_api_tokens['.$index.']', $value]
			);
		}
		// DEFAULT SECTION
		add_settings_section(
			'spotmap-defaults',
			__('Default Values'),
			[$this,'settings_section_defaults'],
			'spotmap-defaults-group'
		);
		register_setting( 'spotmap-defaults-group', 'spotmap_default_values');
		foreach (get_option('spotmap_default_values') as $index => $value) {
			// echo '                                      '.$value;
			add_settings_field(
				'spotmap_default_values['.$index.']',
				$index,
				[$this, 'generate_text_field'],
				'spotmap-defaults-group',
				'spotmap-defaults',
				['spotmap_default_values['.$index.']', $value]
			);
		}
	}
	
	function generate_text_field($args){
		// get the value of the setting we've registered with register_setting()
		$setting = $args[1];
		?>
		<input type="text" name="<?php echo $args[0]?>" value="<?php echo isset( $setting ) ? esc_attr( $setting ) : ''; ?>">
		<?php
	}
	
	function generate_text_area($args){
		// get the value of the setting we've registered with register_setting()
		$setting = $args[1];
		?>
		<textarea type="text" maxlength="500" cols="50" rows=3 name="<?php echo $args[0]?>"><?php echo isset( $setting ) ? esc_attr( $setting ) : ''; ?></textarea>
		<?php
	}

	function generate_password_field($args){
		// get the value of the setting we've registered with register_setting()
		$setting = $args[1];
		?>
		<input type="password" name="<?php echo $args[0]?>"value="<?php echo isset( $setting ) ? esc_attr( $setting ) : ''; ?>">
		<p class="description">Leave this empty if the feed is public</p>
		<?php
	}

	function settings_section_findmespot($args){
		echo '<p id='.$args['id'].'>Enter your Feed details here</p>';
	}
	
	function settings_section_messages($args){
		echo '<p id='.$args['id'].'>'.__("If you have sensitive Information in your predefined messages, you can overide those messages here.").'<br>
		</p>';
	}
	
	function settings_section_defaults($args){
		echo '<p id='.$args['id'].'>'.__("Change the default values for shortcodes attributes.")."<br>".__("Are you sure what you are doing?")."<br>".__("Changes made here could lead to malfunctions.").'
		</p>';
	}
	
	function spotmap_validate_feed_name($new_feed_name){
		foreach ($new_feed_name as $index => &$feed_name) {
			$feed_name = sanitize_text_field($feed_name);
			$old_feed_name = get_option("spotmap_findmespot_name")[$index];
			if(empty($feed_name)){
				continue;
			} else if ($feed_name == $old_feed_name){
				continue;
			}
			$feed_id= get_option("spotmap_findmespot_id")[$index];
			$result = $this->db->rename_feed_name($old_feed_name, $feed_name);
		}
		return $new_feed_name;
	}
	
	function spotmap_validate_feed_id($new_feed_id){
		foreach ($new_feed_id as $index => &$feed_id) {
			$feed_id = sanitize_text_field($feed_id);
			// error_log($feed_id);
			$old_feed_id = get_option("spotmap_findmespot_id")[$index];
			if(empty($feed_id)){
				unset($new_feed_id[$index]);
				continue;
			} else if ($feed_id == $old_feed_id){
				continue;
			}

			$feed_url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$feed_id.'/message.json';
			$json = json_decode( wp_remote_retrieve_body( wp_remote_get( $feed_url )), true);
			//if feed is empty bail out here
			if (empty($json) || isset($json['response']['errors']) && $json['response']['errors']['error']['code'] === "E-0160"){
				// error_log('stay with old value');
				add_settings_error( 'spotmap_feed_id', '', 'Error: The feed id: "'.$feed_id.'" is not valid.', 'error' );
			}
		}
		return $new_feed_id;
	}

	function display_options_page(){
		include_once  plugin_dir_path( dirname( __FILE__ ) ) . 'admin/partials/spotmap-admin-display.php';
	}

	function allow_gpx_upload($mime_types){
		$mime_types['gpx'] = 'text/xml'; 
		return $mime_types;
	}
	function add_link_plugin_overview( $links ) {
		$mylinks = [
			'<a href="' . admin_url( 'options-general.php?page=spotmap' ) . '">'.__("Settings").'</a>',
			'<a href="https://wordpress.org/support/plugin/spotmap/">'.__("Get Support").'</a>',
		];
		return array_merge( $mylinks,$links );
	}

	/**
	 * This function gets called by cron. It checks the SPOT API for new data.
	 * Note: The SPOT API shouldn't be called more often than 150sec otherwise the servers ip will be blocked.
	 */
	function get_feed_data(){
		// error_log("Checking for new feed data ...");
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-api-crawler.php';
		foreach (get_option("spotmap_api_providers") as $key => $name) {
			$ids = get_option("spotmap_".$key."_id");
			$count = count($ids);
			if($count < 1){
				continue;
			}
			$crawler = new Spotmap_Api_Crawler("findmespot");
			for ($i=0; $i < $count; $i++) {
				if($key == 'findmespot'){
					$feed_name = get_option('spotmap_'.$key.'_name')[$i];
					$id = $ids[$i];
					$pwd = get_option('spotmap_'.$key.'_password')[$i];
					
					$crawler->get_data($feed_name, $id, $pwd);
				}
			}

		}
		// error_log("cron job started");
        if (!get_option('spotmap_options')) {
			// trigger_error('no values found');
			return;
		}
		foreach (get_option("spotmap_options") as $key => $count) {
			if($count < 1){
				continue;
			}
			
		}
	}
	function get_local_timezone(){
		global $wpdb;
		$row = $wpdb->get_row("SELECT * FROM " . $wpdb->prefix . "spotmap_points WHERE local_timezone IS NULL ORDER BY time DESC LIMIT 1;");
		// error_log('get tz data');

		if(empty($row)){
			return;
		}
		$token = get_option('spotmap_api_tokens')['timezonedb'];
		$url = "http://api.timezonedb.com/v2.1/get-time-zone?key=".get_option('spotmap_api_tokens')["timezonedb"]."&format=json&by=position&lat=".$row->latitude."&lng=".$row->longitude;
		$response = wp_remote_get( $url );
		// error_log( wp_remote_retrieve_response_code($response) );
		$json = wp_remote_retrieve_body( $response );
		if ( wp_remote_retrieve_response_code($response) != 200){
			// wait a sec longer ....
			wp_schedule_single_event( time()+8, 'spotmap_get_timezone_hook' );
			return;
		}
		$response = json_decode($json, true);
		// error_log(print_r(json_decode($json, true),true));
		$wpdb->query( $wpdb->prepare( "
			UPDATE `{$wpdb->prefix}spotmap_points`
			SET `local_timezone` = %s
			WHERE id = %s",
			[$response['zoneName'],$row->id] ) 
		);
		wp_schedule_single_event( time()+2, 'spotmap_get_timezone_hook' );
	}
	function get_maps_config_content($section){
		$maps_file = plugin_dir_path( dirname( __FILE__ ) ) . 'config/maps.json';
		if(file_exists($maps_file)){
			return json_decode(file_get_contents($maps_file),true)[$section];
		}
		return;
	}

	public function get_overlays(){
		return $this->get_maps_config_content("overlays");
	}

	public function get_maps(){
		$maps = $this->get_maps_config_content("baseLayers");

		// remove maps which need an API key
		$api_names = [
			["option" => 'mapbox', "token"=>"mapboxToken"],
			["option" => 'thunderforest', "token"=>"thunderforestToken"],
			["option" => 'linz.govt.nz', "token"=>"LINZToken"],
			["option" => 'geoservices.ign.fr', "token"=>"geoportailToken"],
			["option" => 'osdatahub.os.uk', "token"=>"osdatahubToken"],
		];
		$api_tokens = get_option('spotmap_api_tokens');
		foreach ($maps as $name => &$data) {
			foreach ($api_names as $i => $options) {
				if(isset($data['options'][$options['token']])){
					if(!empty($api_tokens[$options['option']])){
						$data['options'][$options['token']] = $api_tokens[$options['option']];
					} else {
						unset($maps[$name]);
					}
				}
			}
		}
		return $maps;
	}
}
