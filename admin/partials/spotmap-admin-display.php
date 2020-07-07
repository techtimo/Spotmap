<?php
/**
 * Created by PhpStorm.
 * User: Work
 * Date: 6/19/2019
 * Time: 11:34 PM
 */
$active_tab = isset( $_GET[ 'tab' ] ) ? $_GET[ 'tab' ] : 'feed';

?>

<div class="wrap">
	<h1>Spotmap Settings</h1>
	<h2 class="nav-tab-wrapper">
            <a href="?page=spotmap&tab=feed" class="nav-tab">Feed</a>
            <a href="?page=spotmap&tab=settings" class="nav-tab">Settings</a>
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
			<?php } else { ?>
				<?php settings_fields( 'spotmap-settings-group' );
				do_settings_sections( 'spotmap-settings-group' ); ?>
				<?php settings_fields( 'spotmap-messages-group' );
				do_settings_sections( 'spotmap-messages-group' ); ?>
			<?php }?>
		<?php submit_button(); ?>
	</form>
</div>
