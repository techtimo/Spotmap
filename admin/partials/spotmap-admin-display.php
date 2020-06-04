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

<?php submit_button(); ?>
	</form>
</div>
