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
		<table class="form-table">
			<tr valign="top">
				<th scope="row">Spot Feed ID</th>
				<td><input type="text" name="spotmap_feed_id" value="<?php echo esc_attr( get_option('spotmap_feed_id') ); ?>" /></td>
			</tr>
			<tr valign="top">
				<th scope="row">Feed password</th>
				<td>
					<input type="password" name="spotmap_feed_password" value="<?php echo esc_attr( get_option('spotmap_feed_password') ); ?>" />
					<p class="description" id="tagline-description">Leave this empty if the feed is public</p>
				</td>
			</tr>
		</table>
<?php submit_button(); ?>
	</form>
</div>