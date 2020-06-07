<?php
/**
 * Created by PhpStorm.
 * User: Work
 * Date: 6/19/2019
 * Time: 11:34 PM
 */
?>

<div class="wrap">
	<h1>Spotmap Settings</h1>
	<form method="post" action="options.php">
<?php settings_fields( 'spotmap-settings-group' );
do_settings_sections( 'spotmap-settings-group' ); ?>

<h2>Add new Feed</h2>
<table class="form-table" role="presentation"><tbody><tr><th scope="row">Add a new feed</th><td>
<select id="spotmap-add-feed-select">
			<option value="" selected="selected"></option>
			<?php foreach (get_option("spotmap_api_providers") as $key => $name) {
				 echo '<option name="spotmap_options" value="'.$key.'">'.$name.'</option>';
			 } ?>			 </select><div class="button button-secondary" id="spotmap-add-feed-button">Add Feed</div>
		</td></tr></tbody></table>
<?php submit_button(); ?>
	</form>
</div>
