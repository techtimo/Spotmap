<?php
	$active_tab = isset( $_GET[ 'tab' ] ) ? $_GET[ 'tab' ] : 'feed';
	$tabs = [ 
		'feed' => 'Feed',
		'marker'=> __("Marker"),
		'thirdparties' => __("Additional Services"),
		'defaults' => __('Defaults'),
	];
?>

<div class="wrap">
	<h1>Spotmap Settings</h1>
	<h2 class="nav-tab-wrapper">
	<?php 
		foreach( $tabs as $tab => $name ){
			$class = ( $tab == $active_tab ) ? ' nav-tab-active' : '';
			echo "<a class='nav-tab$class' href='?page=spotmap&tab=$tab'>$name</a>";
		}
	?>
    </h2>
	<form method="post" action="options.php">
		<?php if ($active_tab == 'feed') {?>
			<?php settings_fields( 'spotmap-feed-group' );
			do_settings_sections( 'spotmap-feed-group' ); ?>

			<h2>Add new Feed</h2>
			<table class="form-table" role="presentation"><tbody><tr><th scope="row">Add a new feed</th><td>
			<select id="spotmap-add-feed-select">
				<option value="" selected="selected"></option>
				<?php foreach (get_option("spotmap_api_providers") as $key => $name) {
					echo '<option name="spotmap_options" value="'.$key.'">'.$name.'</option>';
				} ?>			 </select><div class="button button-secondary" id="spotmap-add-feed-button">Add Feed</div>
			</td></tr></tbody></table>
		<?php 
		} else if ($active_tab == 'messages'){
			settings_fields( 'spotmap-messages-group' );
			do_settings_sections( 'spotmap-messages-group' ); 
		} else if ($active_tab == 'thirdparties'){
			settings_fields( 'spotmap-thirdparties-group' );
			do_settings_sections( 'spotmap-thirdparties-group' );
		} else if ($active_tab == 'defaults'){ 
			settings_fields( 'spotmap-defaults-group' );
			do_settings_sections( 'spotmap-defaults-group' );
		} else if ($active_tab == 'marker'){ 
			settings_fields( 'spotmap-marker-group' );
			do_settings_sections( 'spotmap-marker-group' );
		} 
			
		submit_button(); ?>
	</form>
</div>
