<?php

class Spotmap_Admin
{
    public $db;

    public function __construct()
    {
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-database.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-options.php';
        $this->db = new Spotmap_Database();
    }

    public function enqueue_scripts($hook)
    {
        if ($hook !== 'settings_page_spotmap') {
            return;
        }

        wp_enqueue_style('font-awesome', plugin_dir_url(__DIR__) . 'includes/css/font-awesome-all.min.css');

        $asset_file = plugin_dir_path(__DIR__) . 'build/spotmap-admin.asset.php';
        $asset      = file_exists($asset_file)
            ? require $asset_file
            : [ 'dependencies' => [], 'version' => '1.0.0' ];

        wp_enqueue_script(
            'spotmap-admin',
            plugin_dir_url(__DIR__) . 'build/spotmap-admin.js',
            $asset['dependencies'],
            $asset['version'],
            true
        );

        wp_localize_script('spotmap-admin', 'spotmapAdminData', [
            'restUrl'  => rest_url('spotmap/v1/'),
            'nonce'    => wp_create_nonce('wp_rest'),
            'REDACTED' => Spotmap_Rest_Api::REDACTED,
            'feeds'    => $this->db->get_all_feednames(),
        ]);

        if (file_exists(plugin_dir_path(__DIR__) . 'build/spotmap-admin.css')) {
            wp_enqueue_style(
                'spotmap-admin',
                plugin_dir_url(__DIR__) . 'build/spotmap-admin.css',
                [ 'wp-components' ],
                $asset['version']
            );
        }

        // Enqueue the Spotmap map engine for the Edit Points tab.
        $public_url = plugin_dir_url(__DIR__) . 'public/';
        wp_enqueue_style('spotmap-leaflet', $public_url . 'leaflet/leaflet.css');
        wp_enqueue_style('spotmap-beautify-marker', $public_url . 'leaflet-beautify-marker/leaflet-beautify-marker-icon.css');
        wp_enqueue_style('spotmap-custom', $public_url . 'css/custom.css');

        wp_enqueue_script('spotmap-leaflet', $public_url . 'leaflet/leaflet.js', [], false, true);
        wp_enqueue_script('spotmap-beautify-marker', $public_url . 'leaflet-beautify-marker/leaflet-beautify-marker-icon.js', [ 'spotmap-leaflet' ], false, true);
        wp_enqueue_script('spotmap-text-path', $public_url . 'leaflet-textpath/leaflet.textpath.js', [ 'spotmap-leaflet' ], false, true);

        $map_asset_file = plugin_dir_path(__DIR__) . 'build/spotmap-map.asset.php';
        $map_asset      = file_exists($map_asset_file)
            ? require $map_asset_file
            : [ 'dependencies' => [], 'version' => '1.0.0' ];
        wp_enqueue_script(
            'spotmap-map-admin',
            plugin_dir_url(__DIR__) . 'build/spotmap-map.js',
            array_merge($map_asset['dependencies'], [ 'spotmap-leaflet', 'spotmap-beautify-marker', 'spotmap-text-path' ]),
            $map_asset['version'],
            true
        );
        wp_localize_script('spotmap-map-admin', 'spotmapjsobj', [
            'ajaxUrl'       => admin_url('admin-ajax.php'),
            'maps'          => $this->get_maps(),
            'overlays'      => $this->get_overlays(),
            'url'           => $public_url,
            'feeds'         => $this->db->get_all_feednames(),
            'defaultValues' => Spotmap_Options::get_settings(),
            'marker'        => Spotmap_Options::get_marker_options(),
        ]);
    }

    public function ensure_cron_scheduled()
    {
        if (get_transient('spotmap_cron_checked')) {
            return;
        }
        if (! wp_next_scheduled('spotmap_api_crawler_hook')) {
            wp_schedule_event(time(), 'twohalf_min', 'spotmap_api_crawler_hook');
        }
        if (! wp_next_scheduled('spotmap_garmin_crawler_hook')) {
            wp_schedule_event(time(), 'twohalf_min', 'spotmap_garmin_crawler_hook');
        }
        set_transient('spotmap_cron_checked', 1, 5 * MINUTE_IN_SECONDS);
    }

    public function add_cron_schedule($schedules)
    {
        $schedules['twohalf_min'] = [
            'interval' => 150,
            'display'  => esc_html__('Every 2.5 Minutes'),
        ];
        return $schedules;
    }

    public function add_options_page()
    {
        add_options_page('Spotmap Options', 'Spotmap 🗺', 'manage_options', 'spotmap', [ $this, 'display_options_page' ]);
    }

    public function display_options_page()
    {
        echo '<div id="spotmap-admin-root" class="wrap"></div>';
    }

    public function add_link_plugin_overview($links)
    {
        $mylinks = [
            '<a href="' . admin_url('options-general.php?page=spotmap#feeds') . '">' . __('Settings') . '</a>',
            '<a href="https://wordpress.org/support/plugin/spotmap/">' . __('Get Support') . '</a>',
        ];
        return array_merge($mylinks, $links);
    }

    /**
     * Called by cron. Fetches new data from all configured tracking feeds.
     * Note: The SPOT API must not be polled more than once per 150 seconds.
     */
    public function get_feed_data()
    {
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-api-crawler.php';

        $feeds              = Spotmap_Options::get_feeds();
        $findmespot_crawler = null;
        $victron_crawler    = null;
        foreach ($feeds as $feed) {
            if (! empty($feed['paused'])) {
                continue;
            }
            $type = $feed['type'] ?? '';
            if ($type === 'findmespot') {
                if ($findmespot_crawler === null) {
                    $findmespot_crawler = new Spotmap_Api_Crawler('findmespot');
                }
                $findmespot_crawler->get_data(
                    $feed['name']     ?? '',
                    $feed['feed_id']  ?? '',
                    $feed['password'] ?? ''
                );
            } elseif ($type === 'victron') {
                if ($victron_crawler === null) {
                    $victron_crawler = new Spotmap_Api_Crawler('victron');
                }
                $victron_crawler->get_data(
                    $feed['name']            ?? '',
                    $feed['installation_id'] ?? '',
                    $feed['token']           ?? ''
                );
            }
        }
    }

    public function get_garmin_feed_data()
    {
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-api-crawler.php';
        $crawler = null;
        foreach (Spotmap_Options::get_feeds() as $feed) {
            if (! empty($feed['paused']) || ($feed['type'] ?? '') !== 'garmin-inreach') {
                continue;
            }
            if ($crawler === null) {
                $crawler = new Spotmap_Api_Crawler('garmin-inreach');
            }
            $crawler->get_data(
                $feed['name']             ?? '',
                $feed['mapshare_address'] ?? '',
                $feed['password']         ?? ''
            );
        }
    }

    public function crawl_single_feed(array $feed): int|false
    {
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-api-crawler.php';
        $type = $feed['type'] ?? '';
        if ($type === 'findmespot') {
            return (new Spotmap_Api_Crawler('findmespot'))->get_data(
                $feed['name']     ?? '',
                $feed['feed_id']  ?? '',
                $feed['password'] ?? ''
            );
        }
        if ($type === 'victron') {
            return (new Spotmap_Api_Crawler('victron'))->get_data(
                $feed['name']            ?? '',
                $feed['installation_id'] ?? '',
                $feed['token']           ?? ''
            );
        }
        if ($type === 'garmin-inreach') {
            return (new Spotmap_Api_Crawler('garmin-inreach'))->get_data(
                $feed['name']             ?? '',
                $feed['mapshare_address'] ?? '',
                $feed['password']         ?? ''
            );
        }
        return false;
    }

    public function get_local_timezone()
    {
        global $wpdb;
        $row = $wpdb->get_row("SELECT * FROM " . $wpdb->prefix . "spotmap_points WHERE local_timezone IS NULL ORDER BY time DESC LIMIT 1;");

        if (empty($row)) {
            return;
        }
        $token = Spotmap_Options::get_api_token('timezonedb');
        if (empty($token)) {
            return;
        }
        $url      = "http://api.timezonedb.com/v2.1/get-time-zone?key=" . $token . "&format=json&by=position&lat=" . $row->latitude . "&lng=" . $row->longitude;
        $response = wp_remote_get($url);
        if (wp_remote_retrieve_response_code($response) != 200) {
            wp_schedule_single_event(time() + 8, 'spotmap_get_timezone_hook');
            return;
        }
        $data = json_decode(wp_remote_retrieve_body($response), true);
        $wpdb->query(
            $wpdb->prepare(
                "UPDATE `{$wpdb->prefix}spotmap_points` SET `local_timezone` = %s WHERE id = %s",
                [ $data['zoneName'], $row->id ]
            )
        );
        wp_schedule_single_event(time() + 2, 'spotmap_get_timezone_hook');
    }

    public function get_maps_config_content($section)
    {
        static $config = null;
        if ($config === null) {
            $maps_file = plugin_dir_path(dirname(__FILE__)) . 'config/maps.yaml';
            if (! file_exists($maps_file)) {
                return null;
            }
            $config = \Spotmap\Symfony\Component\Yaml\Yaml::parseFile($maps_file);
        }
        return $config[ $section ] ?? null;
    }

    public function get_overlays()
    {
        return $this->get_maps_config_content('overlays');
    }

    public function get_maps()
    {
        $maps      = $this->get_maps_config_content('baseLayers');
        $api_names = [
            [ 'option' => 'mapbox',             'token' => 'mapboxToken' ],
            [ 'option' => 'thunderforest',       'token' => 'thunderforestToken' ],
            [ 'option' => 'linz.govt.nz',        'token' => 'LINZToken' ],
            [ 'option' => 'geoservices.ign.fr',  'token' => 'geoportailToken' ],
            [ 'option' => 'osdatahub.os.uk',     'token' => 'osdatahubToken' ],
        ];
        $api_tokens = Spotmap_Options::get_api_tokens();
        foreach ($maps as $name => &$data) {
            foreach ($api_names as $item) {
                if (isset($data['options'][ $item['token'] ])) {
                    if (! empty($api_tokens[ $item['option'] ])) {
                        $data['options'][ $item['token'] ] = $api_tokens[ $item['option'] ];
                    } else {
                        unset($maps[ $name ]);
                    }
                }
            }
        }
        return $maps;
    }

    public function allow_gpx_upload($mime_types)
    {
        $mime_types['gpx'] = 'text/xml';
        return $mime_types;
    }

    public function add_images_to_map($attachment_id): int
    {
        $media_feeds = array_filter(
            Spotmap_Options::get_feeds(),
            fn ($f) => ($f['type'] ?? '') === 'media'
        );
        if (empty($media_feeds)) {
            return 0;
        }

        $filepath  = get_attached_file($attachment_id);
        $file_type = wp_check_filetype($filepath);
        if (! in_array($file_type['type'], [ 'image/jpeg', 'image/tiff' ], true)) {
            return 0;
        }
        $exif = exif_read_data($filepath, 0, true);
        if (! isset($exif['GPS'])) {
            return 0;
        }
        if (! isset($exif['EXIF']['DateTimeOriginal'])) {
            return 0;
        }
        if (! isset($exif['GPS']['GPSLatitude'], $exif['GPS']['GPSLatitudeRef'],
            $exif['GPS']['GPSLongitude'], $exif['GPS']['GPSLongitudeRef'])) {
            return 0;
        }

        $latitude  = $this->gps($exif['GPS']['GPSLatitude'], $exif['GPS']['GPSLatitudeRef']);
        $longitude = $this->gps($exif['GPS']['GPSLongitude'], $exif['GPS']['GPSLongitudeRef']);
        $timestamp = strtotime($exif['EXIF']['DateTimeOriginal']);
        $inserted = 0;
        foreach ($media_feeds as $feed) {
            $feed_name = $feed['name'] ?? 'media';
            $result    = $this->db->insert_point([
                'latitude'      => $latitude,
                'longitude'     => $longitude,
                'unixTime'      => $timestamp,
                'timestamp'     => $timestamp,
                'feedName'      => $feed_name,
                'feedId'        => $feed_name,
                'messengerName' => $feed_name,
                'messageType'   => 'MEDIA',
                'modelId'       => $attachment_id,
            ]);
            if ($result !== false) {
                $inserted++;
            }
        }
        return $inserted;
    }

    public function import_existing_media(): int
    {
        $media_feeds = array_filter(
            Spotmap_Options::get_feeds(),
            fn ($f) => ($f['type'] ?? '') === 'media'
        );
        if (empty($media_feeds)) {
            return 0;
        }

        $attachments = get_posts([
            'post_type'      => 'attachment',
            'post_mime_type' => 'image',
            'posts_per_page' => -1,
        ]);

        $imported = 0;
        foreach ($attachments as $attachment) {
            if ($this->db->does_media_exist($attachment->ID)) {
                continue;
            }
            $imported += $this->add_images_to_map($attachment->ID);
        }
        return $imported;
    }

    public function delete_images_from_map($attachment_id)
    {
        $this->db->delete_media_point($attachment_id);
    }

    // https://stackoverflow.com/questions/2526304/php-extract-gps-exif-data
    private function gps($coordinate, $hemisphere)
    {
        if (is_string($coordinate)) {
            $coordinate = array_map('trim', explode(',', $coordinate));
        }
        for ($i = 0; $i < 3; $i++) {
            $part = explode('/', $coordinate[ $i ]);
            if (count($part) == 1) {
                $coordinate[ $i ] = $part[0];
            } elseif (count($part) == 2) {
                $coordinate[ $i ] = floatval($part[0]) / floatval($part[1]);
            } else {
                $coordinate[ $i ] = 0;
            }
        }
        list($degrees, $minutes, $seconds) = $coordinate;
        $sign = ($hemisphere == 'W' || $hemisphere == 'S') ? -1 : 1;
        return $sign * ($degrees + $minutes / 60 + $seconds / 3600);
    }
}
