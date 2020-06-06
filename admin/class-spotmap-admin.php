<?php

class Spotmap_Admin {

	public function enqueue_scripts(){
	}
	public function add_cron_schedule($schedules){
		$schedules['twohalf_min'] = array(
			'interval' => 150,
			'display'  => esc_html__( 'Every 2.5 Minutes' ),
		);
		return $schedules;
	}
	public function add_options_page(){
		add_options_page( 'Spotmap Options', 'Spotmap', 'manage_options', 'spotmap', array($this,'display_options_page') );
	}

	public function register_settings(){
		foreach (get_option("spotmap_options") as $key => $count) {
			if($count < 1){
				continue;
			}
			add_settings_section(
				$key.'-feeds',
				$key.' Feeds',
				[$this,'settings_section_'.$key],
				'spotmap-settings-group'
			);
			for ($i=0; $i < $count; $i++) { 
				register_setting( 'spotmap-settings-group', 'spotmap_'.$key.'_name'.$i);
				register_setting( 'spotmap-settings-group', 'spotmap_'.$key.'_id'.$i, ['sanitize_callback'=>[$this, 'spotmap_validate_feed_id']]);
				register_setting( 'spotmap-settings-group', 'spotmap_'.$key.'_password'.$i);
				
				add_settings_field(
					'spotmap_'.$key.'_name'.$i,
					'Feed Name',
					[$this, 'generate_text_field'],
					'spotmap-settings-group',
					'findmespot-feeds',
					['spotmap_'.$key.'_name'.$i]
				);
				add_settings_field(
					'spotmap_'.$key.'_id'.$i,
					'Feed Id',
					[$this, 'generate_text_field'],
					'spotmap-settings-group',
					'findmespot-feeds',
					['spotmap_'.$key.'_id'.$i]
				);
				add_settings_field(
					'spotmap_'.$key.'_password'.$i,
					'Feed password',
					[$this, 'generate_password_field'],
					'spotmap-settings-group',
					'findmespot-feeds',
					['spotmap_'.$key.'_password'.$i]	
					
				);

			}
		}
		add_settings_section(
			'spotmap_options',
			'Add new Feed',
			'',
			'spotmap-settings-group'
		);
		add_settings_field(
			'spotmap_options',
			'Add a new feed',
			[$this, 'generate_dropdown'],
			'spotmap-settings-group',
			'spotmap_options'	
			
		);
		register_setting( 'spotmap-settings-group', 'spotmap_options',['sanitize_callback'=>[$this, 'spotmap_validate_new_feed']] );
	}
	function generate_dropdown()
	{
		?>
			 <select id="spotmap_options" name="spotmap_options">
			 	<option name="spotmap_options" value="" selected="selected"></option>
			 <?php foreach (get_option("spotmap_options") as $key => $count) {
				 echo '<option name="spotmap_options" value="'.$key.'">'.$key.'</option>';
			 } ?>
			 </select>
		<?php
	 }
	function generate_text_field($args){
		// get the value of the setting we've registered with register_setting()
		$setting = get_option($args[0]);
		// output the field
		?>
		<input type="text" name="<?php echo $args[0]?>" value="<?php echo isset( $setting ) ? esc_attr( $setting ) : ''; ?>">
		<?php
	}

	function generate_password_field($args){
		// get the value of the setting we've registered with register_setting()
		$setting = get_option($args[0]);
		// output the field
		?>
		<input type="password" name="<?php echo $args[0]?>"value="<?php echo isset( $setting ) ? esc_attr( $setting ) : ''; ?>">
		<p class="description">Leave this empty if the feed is public</p>
		<?php
	}

	function settings_section_findmespot(){
		echo '<p>Here goes a detailed description.</p>';
	}
	
	function spotmap_validate_new_feed($new_value){
		$old = get_option("spotmap_options");
		if ($new_value == '')
			return $old;
		$old[$new_value]++;
		return $old;
	}
	function spotmap_validate_feed_id($new_feed_id){
		$new_feed_id = sanitize_text_field($new_feed_id);
		if(parse_url($new_feed_id)){
			$tmp = explode('glId=', $new_feed_id);
			$new_feed_id = end($tmp);
		}
		$feed_url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$new_feed_id.'/message.json';
		$json = json_decode( wp_remote_retrieve_body( wp_remote_get( $feed_url )), true);
		//if feed is empty bail out here
		if (empty($json) || isset($json['response']['errors']) && $json['response']['errors']['error']['code'] === "E-0160"){
			error_log('stay with old value');
			add_settings_error( 'spotmap_feed_id', '', 'Error: The feed id is not valid. Please enter a valid one', 'error' );
			return get_option('spotmap_feed_id');
		}
		return $new_feed_id;
	}

	function display_options_page(){
		include_once  plugin_dir_path( dirname( __FILE__ ) ) . 'admin/partials/spotmap-admin-display.php';
	}

	function settings_link( $links ) {
		$mylinks = ['<a href="' . admin_url( 'options-general.php?page=spotmap' ) . '">Settings</a>',];
		return array_merge( $mylinks,$links );
	}
}
