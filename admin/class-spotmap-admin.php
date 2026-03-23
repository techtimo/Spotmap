<?php

class Spotmap_Admin {

	public $db;

	function __construct() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-options.php';
		$this->db = new Spotmap_Database();
	}

	public function enqueue_scripts( $hook ) {
		if ( $hook !== 'settings_page_spotmap' ) {
			return;
		}

		wp_enqueue_style( 'font-awesome', plugin_dir_url( __DIR__ ) . 'includes/css/font-awesome-all.min.css' );

		$asset_file = plugin_dir_path( __DIR__ ) . 'build/spotmap-admin/index.asset.php';
		$asset      = file_exists( $asset_file )
			? require $asset_file
			: [ 'dependencies' => [], 'version' => '1.0.0' ];

		wp_enqueue_script(
			'spotmap-admin',
			plugin_dir_url( __DIR__ ) . 'build/spotmap-admin.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_localize_script( 'spotmap-admin', 'spotmapAdminData', [
			'restUrl'  => rest_url( 'spotmap/v1/' ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
			'REDACTED' => Spotmap_Rest_Api::REDACTED,
		] );

		if ( file_exists( plugin_dir_path( __DIR__ ) . 'build/spotmap-admin/index.css' ) ) {
			wp_enqueue_style(
				'spotmap-admin',
				plugin_dir_url( __DIR__ ) . 'build/spotmap-admin/index.css',
				[ 'wp-components' ],
				$asset['version']
			);
		}
	}

	public function ensure_cron_scheduled() {
		if ( get_transient( 'spotmap_cron_checked' ) ) {
			return;
		}
		if ( ! wp_next_scheduled( 'spotmap_api_crawler_hook' ) ) {
			wp_schedule_event( time(), 'twohalf_min', 'spotmap_api_crawler_hook' );
		}
		set_transient( 'spotmap_cron_checked', 1, 5 * MINUTE_IN_SECONDS );
	}

	public function add_cron_schedule( $schedules ) {
		$schedules['twohalf_min'] = [
			'interval' => 150,
			'display'  => esc_html__( 'Every 2.5 Minutes' ),
		];
		return $schedules;
	}

	public function add_options_page() {
		add_options_page( 'Spotmap Options', 'Spotmap 🗺', 'manage_options', 'spotmap', [ $this, 'display_options_page' ] );
	}

	public function display_options_page() {
		echo '<div id="spotmap-admin-root" class="wrap"></div>';
	}

	public function add_link_plugin_overview( $links ) {
		$mylinks = [
			'<a href="' . admin_url( 'options-general.php?page=spotmap' ) . '">' . __( 'Settings' ) . '</a>',
			'<a href="https://wordpress.org/support/plugin/spotmap/">' . __( 'Get Support' ) . '</a>',
		];
		return array_merge( $mylinks, $links );
	}

	/**
	 * Called by cron. Fetches new data from all configured tracking feeds.
	 * Note: The SPOT API must not be polled more than once per 150 seconds.
	 */
	function get_feed_data() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-api-crawler.php';

		$feeds           = Spotmap_Options::get_feeds();
		$findmespot_crawler = null;
		foreach ( $feeds as $feed ) {
			$type = $feed['type'] ?? '';
			if ( $type === 'findmespot' ) {
				if ( $findmespot_crawler === null ) {
					$findmespot_crawler = new Spotmap_Api_Crawler( 'findmespot' );
				}
				$findmespot_crawler->get_data(
					$feed['name']     ?? '',
					$feed['feed_id']  ?? '',
					$feed['password'] ?? ''
				);
			}
			// Future provider types handled here as they are implemented.
		}
	}

	function get_local_timezone() {
		global $wpdb;
		$row = $wpdb->get_row( "SELECT * FROM " . $wpdb->prefix . "spotmap_points WHERE local_timezone IS NULL ORDER BY time DESC LIMIT 1;" );

		if ( empty( $row ) ) {
			return;
		}
		$token = Spotmap_Options::get_api_token( 'timezonedb' );
		if ( empty( $token ) ) {
			return;
		}
		$url      = "http://api.timezonedb.com/v2.1/get-time-zone?key=" . $token . "&format=json&by=position&lat=" . $row->latitude . "&lng=" . $row->longitude;
		$response = wp_remote_get( $url );
		if ( wp_remote_retrieve_response_code( $response ) != 200 ) {
			wp_schedule_single_event( time() + 8, 'spotmap_get_timezone_hook' );
			return;
		}
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE `{$wpdb->prefix}spotmap_points` SET `local_timezone` = %s WHERE id = %s",
				[ $data['zoneName'], $row->id ]
			)
		);
		wp_schedule_single_event( time() + 2, 'spotmap_get_timezone_hook' );
	}

	function get_maps_config_content( $section ) {
		static $config = null;
		if ( $config === null ) {
			$maps_file = plugin_dir_path( dirname( __FILE__ ) ) . 'config/maps.yaml';
			if ( ! file_exists( $maps_file ) ) return null;
			$config = \Spotmap\Symfony\Component\Yaml\Yaml::parseFile( $maps_file );
		}
		return $config[ $section ] ?? null;
	}

	public function get_overlays() {
		return $this->get_maps_config_content( 'overlays' );
	}

	public function get_maps() {
		$maps      = $this->get_maps_config_content( 'baseLayers' );
		$api_names = [
			[ 'option' => 'mapbox',             'token' => 'mapboxToken' ],
			[ 'option' => 'thunderforest',       'token' => 'thunderforestToken' ],
			[ 'option' => 'linz.govt.nz',        'token' => 'LINZToken' ],
			[ 'option' => 'geoservices.ign.fr',  'token' => 'geoportailToken' ],
			[ 'option' => 'osdatahub.os.uk',     'token' => 'osdatahubToken' ],
		];
		$api_tokens = Spotmap_Options::get_api_tokens();
		foreach ( $maps as $name => &$data ) {
			foreach ( $api_names as $item ) {
				if ( isset( $data['options'][ $item['token'] ] ) ) {
					if ( ! empty( $api_tokens[ $item['option'] ] ) ) {
						$data['options'][ $item['token'] ] = $api_tokens[ $item['option'] ];
					} else {
						unset( $maps[ $name ] );
					}
				}
			}
		}
		return $maps;
	}

	function allow_gpx_upload( $mime_types ) {
		$mime_types['gpx'] = 'text/xml';
		return $mime_types;
	}

	public function add_images_to_map( $attachment_id ) {
		$filepath = get_attached_file( $attachment_id );
		$exif     = exif_read_data( $filepath, 0, true );
		if ( ! isset( $exif['GPS'] ) ) { return; }
		if ( ! isset( $exif['EXIF']['DateTimeOriginal'] ) ) { return; }

		$latitude  = $this->gps( $exif['GPS']['GPSLatitude'],  $exif['GPS']['GPSLatitudeRef'] );
		$longitude = $this->gps( $exif['GPS']['GPSLongitude'], $exif['GPS']['GPSLongitudeRef'] );
		$timestamp = strtotime( $exif['EXIF']['DateTimeOriginal'] );
		$image     = get_post_field( 'guid', $attachment_id );

		$this->db->insert_point( [
			'latitude'       => $latitude,
			'longitude'      => $longitude,
			'unixTime'       => $timestamp,
			'timestamp'      => $timestamp,
			'feedName'       => 'media',
			'feedId'         => 'media',
			'messengerName'  => 'media',
			'messageType'    => 'MEDIA',
			'modelId'        => $attachment_id,
			'messageContent' => $image,
		] );
	}

	public function delete_images_from_map( $attachment_id ) {
		$this->db->delete_media_point( $attachment_id );
	}

	// https://stackoverflow.com/questions/2526304/php-extract-gps-exif-data
	private function gps( $coordinate, $hemisphere ) {
		if ( is_string( $coordinate ) ) {
			$coordinate = array_map( 'trim', explode( ',', $coordinate ) );
		}
		for ( $i = 0; $i < 3; $i++ ) {
			$part = explode( '/', $coordinate[ $i ] );
			if ( count( $part ) == 1 ) {
				$coordinate[ $i ] = $part[0];
			} elseif ( count( $part ) == 2 ) {
				$coordinate[ $i ] = floatval( $part[0] ) / floatval( $part[1] );
			} else {
				$coordinate[ $i ] = 0;
			}
		}
		list( $degrees, $minutes, $seconds ) = $coordinate;
		$sign = ( $hemisphere == 'W' || $hemisphere == 'S' ) ? -1 : 1;
		return $sign * ( $degrees + $minutes / 60 + $seconds / 3600 );
	}
}
