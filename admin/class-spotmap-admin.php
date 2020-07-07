<?php

class Spotmap_Admin {

	public $db;

	function __construct() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		$this->db = new Spotmap_Database();
	}
	
	public function enqueue_scripts(){
		wp_enqueue_script('spotmap-settings', plugins_url('js/settings.js', __FILE__), array('jquery'), false, true);
	}
	public function add_cron_schedule($schedules){
		$schedules['twohalf_min'] = array(
			'interval' => 150,
			'display'  => esc_html__( 'Every 2.5 Minutes' ),
		);
		return $schedules;
	}
	public function add_options_page(){
		add_options_page( 'Spotmap Options', 'Spotmap', 'manage_options', 'spotmap', [$this,'display_options_page'] );
	}

	public function register_settings(){
		foreach (get_option("spotmap_api_providers") as $key => $name) {
			$ids = get_option("spotmap_".$key."_id");
			$count = count($ids);
			register_setting( 'spotmap-feed-group', 'spotmap_'.$key.'_name',['sanitize_callback'=>[$this, 'spotmap_validate_feed_name']]);
			register_setting( 'spotmap-feed-group', 'spotmap_'.$key.'_id', ['sanitize_callback'=>[$this, 'spotmap_validate_feed_id']]);
			register_setting( 'spotmap-feed-group', 'spotmap_'.$key.'_password');
			if($count < 1){
				continue;
			}
			add_settings_section(
				$key.'-feeds',
				$name,
				[$this,'settings_section_'.$key],
				'spotmap-feed-group'
			);
			for ($i=0; $i < $count; $i++) { 
				
				add_settings_field(
					'spotmap_'.$key.'_name['.$i.']',
					'Feed Name',
					[$this, 'generate_text_field'],
					'spotmap-feed-group',
					'findmespot-feeds',
					['spotmap_'.$key.'_name['.$i.']',
					get_option('spotmap_'.$key.'_name')[$i]]
				);
				add_settings_field(
					'spotmap_'.$key.'_id['.$i.']',
					'Feed Id',
					[$this, 'generate_text_field'],
					'spotmap-feed-group',
					'findmespot-feeds',
					['spotmap_'.$key.'_id['.$i.']',get_option('spotmap_'.$key.'_id')[$i]]
				);
				add_settings_field(
					'spotmap_'.$key.'_password['.$i.']',
					'Feed password',
					[$this, 'generate_password_field'],
					'spotmap-feed-group',
					'findmespot-feeds',
					['spotmap_'.$key.'_password['.$i.']',get_option('spotmap_'.$key.'_password')[$i]]	
				);
				
			}
		}
		register_setting( 'spotmap-messages-group', 'spotmap_custom_messages');
		add_settings_section(
			'spotmap-messages',
			'Set Custom messages',
			[$this,'settings_section_messages'],
			'spotmap-messages-group'
		);
		foreach (['HELP','HELP-CANCEL','CUSTOM','OK','STATUS','UNLIMITED-TRACK','NEW-MOVEMENT'] as $index) {
			$value = isset( get_option('spotmap_custom_messages')[$index] ) ? get_option('spotmap_custom_messages')[$index] : '';
			add_settings_field(
				'spotmap_custom_messages['.$index.']',
				$index,
				[$this, 'generate_text_field'],
				'spotmap-messages-group',
				'spotmap-messages',
				['spotmap_custom_messages['.$index.']', $value
				]
			);
		}
		register_setting( 'spotmap-settings-group', 'spotmap_mapbox_token');
		add_settings_section(
			'mapbox',
			'Mapbox',
			'',
			'spotmap-settings-group'
		);
		add_settings_field(
			'spotmap_mapbox_token',
			'Mapbox API',
			[$this, 'generate_text_field'],
			'spotmap-settings-group',
			'mapbox',
			['spotmap_mapbox_token',
			get_option('spotmap_mapbox_token')]
		);
	}
	
	function generate_text_field($args){
		// get the value of the setting we've registered with register_setting()
		$setting = $args[1];
		?>
		<input type="text" name="<?php echo $args[0]?>" value="<?php echo isset( $setting ) ? esc_attr( $setting ) : ''; ?>">
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
		echo '<p id='.$args['id'].'>If you have sensitive Information in your custom messages, you can overide those messages here.</p>';
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
				error_log('stay with old value');
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
	function settings_link( $links ) {
		$mylinks = ['<a href="' . admin_url( 'options-general.php?page=spotmap' ) . '">Settings</a>',];
		return array_merge( $mylinks,$links );
	}

	/**
	 * This function gets called by cron. It checks the SPOT API for new data.
	 * Note: The SPOT API shouldn't be called more often than 150sec otherwise the servers ip will be blocked.
	 */
	function get_feed_data(){
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

}
