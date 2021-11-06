<?php

class Spotmap_Admin {

	public $db;

	function __construct() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		$this->db = new Spotmap_Database();
	}
	
	public function enqueue_scripts(){
		wp_enqueue_style( 'font-awesome', plugin_dir_url( __DIR__ ). 'includes/css/font-awesome-5.15-all.min.css');
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
		// error_log(print_r(get_option('spotmap_marker'),TRUE));
		
		// FEED SECTION
		foreach (get_option("spotmap_api_providers") as $provider => $name) {
			$ids = get_option("spotmap_".$provider."_id");
			
			$count = empty($ids) ? 1 : count($ids);

			register_setting( 'spotmap-feed-group', 'spotmap_'.$provider.'_name',['sanitize_callback'=>[$this, 'validate_feed_name']]);
			register_setting( 'spotmap-feed-group', 'spotmap_'.$provider.'_id', ['sanitize_callback'=>[$this, 'validate_feed_id']]);
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
					'name' => ['label' => __('Feed Name'), 'type' => 'text'], 
					'id' => ['label' => __('Feed Id'), 'type' => 'text'], 
					'password' => ['label' => __('Feed password'), 'type' => 'password', "description" => __("Leave this empty if the feed is public")], 
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
						[$this, 'generate_settings'],
						'spotmap-feed-group',
						'findmespot-feeds',
						['id' => 'spotmap_'.$provider.'_' . $key . '['.$i.']',
						'value' => $pre_populated_value,
						'description' => isset($value["description"]) ? $value["description"] : '',
						'type' => isset($value["type"]) ? $value["type"] : '',]
					);
				}
			}
		}
		// MARKER SHAPE SECTION
		register_setting( 'spotmap-marker-group', 'spotmap_marker');
		$point_types = ['HELP','HELP-CANCEL','CUSTOM','OK','STATUS','UNLIMITED-TRACK','NEWMOVEMENT','STOP',];
		add_settings_section(
			'spotmap-marker-shape-section',
			__('Marker display options'),
			[$this,'settings_section_marker'],
			'spotmap-marker-group'
		);
		$dropdown_options = [
			[ __("Tiny dot"), "circle-dot"],
			[ __("Medium marker"), "circle"],
			[ __("Big marker"), "marker"],
		];
		$settings = [];
		foreach ($point_types as $point_type) {
			$settings[$point_type] = [
				"type" => "dropdown",
				"options" => $dropdown_options,
				"id" => "spotmap_marker[" . $point_type . "][iconShape]",
				"value" => isset( get_option('spotmap_marker')[$point_type]['iconShape'] ) ? get_option('spotmap_marker')[$point_type]['iconShape'] : ''
			];
		}
		$this::add_bulk_settings($settings,'spotmap-marker-group','spotmap-marker-shape-section');

		// MARKER ICON SECTION
		add_settings_section(
			'spotmap-marker-icon-section',
			__('Marker icon options'),
			[$this,'settings_section_icons'],
			'spotmap-marker-group',
		);
		error_log(print_r(get_option('spotmap_marker'),TRUE));

		$settings = [];
		foreach ($point_types as $point_type) {
			$settings[$point_type] = [
				"type" => "icon",
				"size" => 30,
				"id" => "spotmap_marker[".$point_type."][icon]",
				"value" => isset(get_option('spotmap_marker')[$point_type]['icon'] ) ? get_option('spotmap_marker')[$point_type]['icon'] : '',
			];
		}

		$this::add_bulk_settings($settings,'spotmap-marker-group','spotmap-marker-icon-section');
		

		// CUSTOM MESSAGES 
		
		add_settings_section(
			'spotmap-marker-custom-message-section',
			__('Set Custom messages'),
			[$this,'settings_section_messages'],
			'spotmap-marker-group'
		);
		$settings = [];
		foreach ($point_types as $point_type) {
			$settings[$point_type] = [
				"type" => in_array($point_type,["HELP", "HELP-CANCEL", "CUSTOM", "OK"]) ? "textarea" : "text",
				"id" => "spotmap_marker[".$point_type."][customMessage]",
				"value" => isset(get_option('spotmap_marker')[$point_type]['customMessage'] ) ? get_option('spotmap_marker')[$point_type]['customMessage'] : '',
			];
		}

		$this::add_bulk_settings($settings,'spotmap-marker-group','spotmap-marker-custom-message-section');


		// API SECTION
		register_setting( 'spotmap-thirdparties-group', 'spotmap_api_tokens');
		add_settings_section(
			'spotmap-thirdparty-section',
			__('Thirdparty API Tokens'),
			[$this, 'settings_section_thirdparty'],
			'spotmap-thirdparties-group'
		);
		$settings = [
			'timezonedb'=> [
				"label" => "timezonedb.com",
				"type" => 'text',
				"description" => __("Do you travel to other timezones? Store and show the local time of a position with a timezonedb API token. <a href=\"https://timezonedb.com/register\">Register for free</a>"),
			],
			'mapbox'=> [
				"label" => "mapbox.com",
				"type" => 'text',
				"description" => __("Get Satelite  images and nice looking maps. The maps cover the whole world. Sign up for a free <a href=\"https://account.mapbox.com/access-tokens/\">Mapbox API Token</a>. Remember to restrict the token usage to your domain only."),
			],
			'thunderforest'=> [
				"label" => "thunderforest.com",
				"type" => 'text',
				"description" => __("Get another set of maps with Thunderforest. Create a free account <a href=\"https://manage.thunderforest.com/users/sign_up?plan_id=5\">here</a>."),
			],
			'linz.govt.nz'=> [
				"label" => "Land Information New Zealand",
				"type" => 'text',
				"description" => __("Kia Ora! Are you planning to have an adventure in New Zealand? Register a free account at <a href=\"https://www.linz.govt.nz/data/linz-data-service/guides-and-documentation/creating-an-api-key\">Land Information New Zealand</a> to get the official NZ Topo Map."), 
			],
			'geoservices.ign.fr'=> [
				"label" => "Géoportail France",
				"type" => 'text',
				"description" => __("For adventures in France answer <a href=\"https://www.sphinxonline.com/surveyserver/s/etudesmk/Geoservices_2021/questionnaire.htm\">this survey</a>. (Answer the following: création de clé gratuites -> pour un site Web -> Referer (enter your wordpress url) -> enter personal data -> done) The register process can take several days. You will receive the API key via mail."),
			],
			'osdatahub.os.uk'=> [
				"label" => "UK Ordnance Survey",
				"type" => 'text',
				"description" => "For adventures in the UK, you can create a free plan at the <a href=\"https://osdatahub.os.uk/plans\">UK Ordnance Survey</a>. Afterwards follow the guide on <a href=\"https://osdatahub.os.uk/docs/wmts/gettingStarted\">how to create a project</a>.",
			],
		];
		foreach ($settings as $index => &$setting) {
			$setting["id"] = 'spotmap_api_tokens['.$index.']';
			$setting["value"] = isset( get_option('spotmap_api_tokens')[$index] ) ? get_option('spotmap_api_tokens')[$index] : '';
		}

		$this::add_bulk_settings($settings,'spotmap-thirdparties-group','spotmap-thirdparty-section');

		// DEFAULT SECTION
		add_settings_section(
			'spotmap-defaults',
			__('Default Values'),
			[$this,'settings_section_defaults'],
			'spotmap-defaults-group'
		);
		$settings = [
				'maps' =>  [
					"type" => "textarea",
				],
				'height' =>  [
					"type" => "number",
				],
				'mapcenter' =>  [
					"type" => "dropdown",
					"options" => [
						["all"],
						["last"],
						["last-trip"],
						["gpx"]
					]
				],
				'width' =>  [
					"type" => "dropdown",
					"options" => [
						["normal"],
						["full"]
					]
				],
				'color' =>  [
					"type" => "text",
				],
				'splitlines' =>  [
					"type" => "number",
				],
		];
		foreach ($settings as $index => &$setting) {
			$setting["id"] = 'spotmap_default_values['.$index.']';
			$setting["value"] = isset( get_option('spotmap_default_values')[$index] ) ? get_option('spotmap_default_values')[$index] : '';
		}
		$this::add_bulk_settings($settings,'spotmap-defaults-group','spotmap-defaults');
	}


	function add_bulk_settings($settings, $settings_group, $settings_section){
		foreach ($settings as $index => $value) {
			add_settings_field(
				$value["id"],
				isset($value["label"])? $value["label"] : $index,
				[$this, 'generate_settings'],
				$settings_group,
				$settings_section,
				$value
			);
		}
	}

	function generate_settings($args){
		// error_log(print_r($args,TRUE));
		foreach (['text', 'password','number',] as $type) {
			if ($args['type'] == $type) { 
				$this::generate_text_field($args);
			}
		}
		if('textarea' == $args['type']) {
			$this::generate_textarea($args);
		}
		if('dropdown' == $args['type']) {
			$this::generate_dropdown_field($args);
		}
		if('icon' == $args['type']) {
			$this::generate_icon_field($args);
		}
	}
	function generate_textarea($args){
		$maxlength = isset( $args['maxlength'] ) ? $args['maxlength'] : '500'; 
		$cols = isset( $args['cols'] ) ? $args['cols'] : '50'; 
		$rows = isset( $args['rows'] ) ? $args['rows'] : '2'; 
		
		?>
		<textarea type="text" maxlength="<?php echo $maxlength?>" cols="<?php echo $cols?>" rows="<?php echo $rows?>" name="<?php echo $args['id']?>"><?php echo isset( $args['value'] ) ? esc_attr( $args['value'] ) : ''; ?></textarea>
		<?php
	}
	
	function generate_text_field($args){
		$size = isset( $args['size'] ) ? ' size="'.$args['size'].'"' : ' size="50"';
		?>
		<input type="<?php echo $args['type']?>" <?php echo $size?> name="<?php echo $args['id']?>" value="<?php echo isset( $args['value'] ) ? esc_attr( $args['value'] ) : ''; ?>">
		<?php echo isset( $args['description'] ) ? "<p class=\"description\">".$args['description']."</p>" : ''; ?>
		
		<?php
	}
	function generate_icon_field($args){
		$size = isset( $args['size'] ) ? ' size="'.$args['size'].'"' : ' size="50"'; 
		// get the value of the setting we've registered with register_setting()
		?>
		<input class=spotmap-icon-input type="<?php echo $args['type']?>" <?php echo $size?> name="<?php echo $args['id']?>" value="<?php echo isset( $args['value'] ) ? esc_attr( $args['value'] ) : ''; ?>">
		<?php echo isset( $args['value'] ) ? ' <i id="'.$args['id'].'-icon" style="font-size: 24px;" class="fas fa-'.$args['value'].'"></i>' : ''; ?>
		<?php echo isset( $args['description'] ) ? "<p class=\"description\">".$args['description']."</p>" : ''; ?>
		
		<?php
	}

	function generate_dropdown_field($args){
		?>
		<select name="<?php echo $args['id']?>">
		<?php foreach ($args['options'] as $key ) {
			$option_label = isset($key["label"])? $key["label"] : $key[0];
			$option_value = $option_label;
			if(isset($key["value"])){
				$option_value = $key["value"];
			}
			else if(!isset($key["value"]) && isset($key[1])){
				$option_value = $key[1];
			}
			$option_value = isset($key["value"])? $key["value"] : $key[1];
			$selected = $args["value"] == $option_value ? 'selected="selected"': '';
			echo '<option '.$selected.' name="spotmap_options" value="'.$option_value.'">'.$option_label.'</option>';
		
		} 
		?></select>

		<?php echo isset( $args['description'] ) ? "<p class=\"description\">".$args['description']."</p>" : ''; ?>
		
		<?php
	}

	function settings_section_findmespot($args){
		echo '<p id='.$args['id'].'>'.__('Enter your SPOT XML Feed details here. If you are not sure what you should enter here, head over to the <a href="https://www.findmespot.com/en-us/support/spot-x/get-help/general/spot-api-support">API support page from SPOT</a> to get more information').'.</p>';
	}
	
	function settings_section_messages($args){
		echo '<p id='.$args['id'].'>'.__("Do you share sensible data in your messages sent from your spot? (e.g. phone numbers)").'<br>' . __("Here you can override the displayed message.").'</p>';
	}
	function settings_section_icons($args){
		echo '<p id='.$args['id'].'>'.__("In this section you can modify the icons that are displayed on the map. (If you have chosen a medium or big marker)").'.<br>' . 
		__("Search under the following link for other icons that suits your needs") . ': <a target="_blank" href="https://fontawesome.com/icons?d=gallery&p=2&q=search&m=free">fontawesome.com</a>.</br></p>';
	}	
	function settings_section_marker($args){
		echo '<p id='.$args['id'].'>'.__("Change the marker size for each message type.").'<br>
		</p>';
	}
	function settings_section_thirdparty($args){
		echo '<p id='.$args['id'].'>'.__("Here you have links to a variety of different services. Each one of them is free for personal use. Follow the stated link, create an account and copy the API Key in the corresponding field.").'<br>
		</p>';
	}
	
	function settings_section_defaults($args){
		echo '<p id='.$args['id'].'>'.__("Change the default values for shortcodes attributes.")."<br>".__("Changes made here could lead to malfunctions.").'
		</p>';
	}
	
	function validate_feed_name($new_feed_name){
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
	
	function validate_feed_id($new_feed_id){
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
