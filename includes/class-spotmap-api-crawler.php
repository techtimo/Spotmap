<?php

class Spotmap_Api_Crawler
{
    private $api;
    public $db;

    public function __construct(String $api_provider)
    {
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-database.php';
        $this->db = new Spotmap_Database();
        $this->api = $api_provider;
    }

    public function get_data($feed_name, $id, $pwd = "")
    {
        if ($this->api === 'findmespot') {
            return $this->get_data_findmespot($feed_name, $id, $pwd);
        } elseif ($this->api === 'victron') {
            return $this->get_data_victron($feed_name, $id, $pwd);
        } elseif ($this->api === 'garmin-inreach') {
            return $this->get_data_garmin_inreach($feed_name, $id, $pwd);
        } else {
            trigger_error("API {$this->api} is unknown", E_USER_WARNING);
        }
    }

    /**
     * Fetches the latest GPS position from the Victron VRM API for one installation
     * and inserts it via insert_row(). The rolling-anchor deduplication in insert_row()
     * suppresses stationary pings automatically, so this can safely be called on every
     * cron tick regardless of how often the device actually moves.
     *
     * @param string $feed_name     Feed name (stored in DB).
     * @param string $installation_id  Victron idSite, e.g. "522142".
     * @param string $token         Personal access token.
     * @return bool|null true on insert, false on API error, null if no GPS data.
     */
    private function get_data_victron(string $feed_name, string $installation_id, string $token)
    {
        $response = wp_remote_get(
            'https://vrmapi.victronenergy.com/v2/installations/' . rawurlencode($installation_id) . '/widgets/GPS',
            [
                'headers' => [ 'X-Authorization' => 'Token ' . $token ],
                'timeout' => 15,
            ]
        );

        if (is_wp_error($response)) {
            return false;
        }

        $json = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($json['success'])) {
            trigger_error('Victron API error for installation ' . $installation_id, E_USER_WARNING);
            return false;
        }

        $attrs       = $json['records']['data']['attributes'] ?? [];
        $seconds_ago = $attrs['secondsAgo']['value'] ?? null;
        if ($seconds_ago === null) {
            return null;
        }

        $lat   = isset($attrs[4]['valueFloat']) ? (float) $attrs[4]['valueFloat'] : null;
        $lng   = isset($attrs[5]['valueFloat']) ? (float) $attrs[5]['valueFloat'] : null;
        $speed = isset($attrs[142]['valueFloat']) ? round((float) $attrs[142]['valueFloat'] * 3.6, 2) : null; // m/s → km/h
        $alt   = isset($attrs[584]['valueFloat']) ? (int) $attrs[584]['valueFloat'] : null;

        if ($lat === null || $lng === null) {
            return null;
        }

        $data = [
            'feed_name' => $feed_name,
            'feed_id'   => $installation_id,
            'type'      => 'TRACK',
            'time'      => time() - (int) $seconds_ago,
            'latitude'  => $lat,
            'longitude' => $lng,
        ];
        if ($speed !== null) {
            $data['speed'] = $speed;
        }
        if ($alt !== null) {
            $data['altitude'] = $alt;
        }

        return $this->db->insert_row($data) !== false;
    }

    /**
     * Fetches tracking points from a Garmin inReach MapShare KML feed.
     *
     * Initial import (cursor present in wp_options, or no points in DB):
     *   Walks backwards in time from now to GARMIN_EPOCH in 7-day windows, up to
     *   GARMIN_CHUNKS_PER_TICK windows per cron call. Progress is stored in
     *   wp_options so the import continues across multiple ticks without
     *   risking a PHP timeout.  When the cursor reaches GARMIN_EPOCH the option
     *   is deleted and the feed switches to incremental mode automatically.
     *
     *   After each tick's backfill chunks (except the very first tick), an
     *   open-ended incremental fetch also runs to capture live points arriving
     *   while the historical backfill is still in progress.
     *
     * Incremental mode (no cursor, points exist):
     *   Single request: d1 = last stored point time + 1 second.
     *
     * The Garmin MapShare API rejects large date ranges; 7-day windows are
     * safely within its limits.
     *
     * @param string $feed_name         Feed name (stored in DB).
     * @param string $mapshare_address  MapShare username (share.garmin.com/Feed/Share/{address}).
     * @param string $password          Optional MapShare password (Basic Auth, empty username).
     * @return int|false Total rows inserted this tick, or false on unrecoverable HTTP error.
     */
    private function get_data_garmin_inreach(string $feed_name, string $mapshare_address, string $password)
    {
        // Garmin inReach launched in 2011; no GPS data exists before this date.
        $garmin_epoch     = mktime(0, 0, 0, 1, 1, 2011);
        $chunk_secs       = 7 * 86400;   // 7-day API windows stay within Garmin's limits
        $chunks_per_tick  = 20;           // up to 140 days of history per cron tick

        $cursor_key = 'spotmap_garmin_cursor_' . md5($feed_name);
        $cursor     = get_option($cursor_key, null);

        // Determine whether we are in initial-import or incremental mode.
        // A cursor option means an import is in progress.
        // An empty DB for this feed means we are starting a fresh import.
        global $wpdb;
        $last_time = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT MAX(time) FROM {$wpdb->prefix}spotmap_points WHERE feed_name = %s",
                $feed_name
            )
        );
        $db_is_empty = ($last_time === 0);

        if ($cursor !== null || $db_is_empty) {
            // ── Initial / resuming chunked import (reverse: now → garmin_epoch) ──
            //
            // Cursor is stored as ['at' => unix_timestamp, 'empty_streak' => int].
            // 'at' marks the upper boundary of the next chunk to fetch; it decrements
            // each iteration.  When the feed has returned nothing for several
            // consecutive 7-day windows we switch to 60-day fast-forward chunks to
            // skip silent years quickly.  As soon as data appears we drop back to
            // 7-day windows so every point is captured with fine granularity.
            $fast_forward_secs  = 60 * 86400;  // jump size when feed is silent
            $empty_streak_limit = 4;            // consecutive empty chunks before fast-forwarding

            $now = time();

            if ($cursor === null) {
                $cursor = [ 'at' => $now, 'empty_streak' => 0 ];
                update_option($cursor_key, $cursor, false);
                $this->garmin_log($feed_name, 'initial_import_start', [
                    'from'      => gmdate('Y-m-d', $now),
                    'direction' => 'reverse',
                ]);
            }

            $inserted = 0;

            for ($i = 0; $i < $chunks_per_tick && (int) $cursor['at'] > $garmin_epoch; $i++) {
                $advance     = ($cursor['empty_streak'] >= $empty_streak_limit)
                               ? $fast_forward_secs
                               : $chunk_secs;
                $chunk_start = max((int) $cursor['at'] - $advance, $garmin_epoch);
                $chunk_end   = (int) $cursor['at'];
                $url         = 'https://share.garmin.com/Feed/Share/' . rawurlencode($mapshare_address)
                             . '?d1=' . gmdate('Y-m-d\TH:i\Z', $chunk_start)
                             . '&d2=' . gmdate('Y-m-d\TH:i\Z', $chunk_end);

                $this->garmin_log($feed_name, 'chunk_fetch', [
                    'd1'           => gmdate('Y-m-d', $chunk_start),
                    'd2'           => gmdate('Y-m-d', $chunk_end),
                    'chunk'        => $i + 1,
                    'fast_forward' => $advance === $fast_forward_secs,
                    'empty_streak' => $cursor['empty_streak'],
                ]);

                $count = $this->garmin_fetch_and_insert_kml($url, $password, $feed_name, $mapshare_address);
                if ($count === false) {
                    // HTTP/parse error — preserve cursor so the next tick retries this window.
                    $this->garmin_log($feed_name, 'chunk_error', [
                        'd1'              => gmdate('Y-m-d', $chunk_start),
                        'inserted_so_far' => $inserted,
                    ]);
                    return $inserted > 0 ? $inserted : false;
                }

                $this->garmin_log($feed_name, 'chunk_done', [
                    'd1'       => gmdate('Y-m-d', $chunk_start),
                    'd2'       => gmdate('Y-m-d', $chunk_end),
                    'inserted' => $count,
                ]);

                $inserted              += $count;
                $cursor['at']           = $chunk_start - 1;
                $cursor['empty_streak'] = ($count === 0)
                    ? $cursor['empty_streak'] + 1
                    : 0;
                update_option($cursor_key, $cursor, false);
            }

            if ((int) $cursor['at'] <= $garmin_epoch) {
                delete_option($cursor_key);
                $this->garmin_log($feed_name, 'initial_import_complete', [
                    'total_inserted_this_tick' => $inserted,
                ]);
            } else {
                // Also check for live points that arrived since the first chunk seeded the DB.
                // Skip on the very first tick ($db_is_empty) because last_time is 0.
                if (! $db_is_empty) {
                    $inc_url  = 'https://share.garmin.com/Feed/Share/' . rawurlencode($mapshare_address)
                              . '?d1=' . gmdate('Y-m-d\TH:i\Z', $last_time + 1);
                    $this->garmin_log($feed_name, 'incremental_during_backfill', [
                        'd1' => gmdate('Y-m-d H:i:s', $last_time + 1),
                    ]);
                    $live      = $this->garmin_fetch_and_insert_kml($inc_url, $password, $feed_name, $mapshare_address);
                    $inserted += ($live ?: 0);
                }
                $this->garmin_log($feed_name, 'tick_done_resuming_next', [
                    'cursor'                   => gmdate('Y-m-d', (int) $cursor['at']),
                    'empty_streak'             => $cursor['empty_streak'],
                    'total_inserted_this_tick' => $inserted,
                ]);
            }

            return $inserted;
        }

        // ── Incremental mode ────────────────────────────────────────────────
        $url = 'https://share.garmin.com/Feed/Share/' . rawurlencode($mapshare_address)
             . '?d1=' . gmdate('Y-m-d\TH:i\Z', $last_time + 1);
        $this->garmin_log($feed_name, 'incremental_fetch', [
            'd1' => gmdate('Y-m-d H:i:s', $last_time + 1),
        ]);
        $count = $this->garmin_fetch_and_insert_kml($url, $password, $feed_name, $mapshare_address);
        $this->garmin_log($feed_name, 'incremental_done', [
            'inserted' => $count === false ? 'error' : $count,
        ]);
        return $count;
    }

    /**
     * Fetches one Garmin MapShare KML URL, parses the Placemark elements,
     * and inserts each valid point via insert_row().
     *
     * @param string $url              Full URL including any d1/d2 parameters.
     * @param string $password         MapShare password (empty = public feed).
     * @param string $feed_name        Feed name for DB rows.
     * @param string $mapshare_address MapShare address stored as feed_id.
     * @return int|false Number of rows inserted (0 = valid empty response), false on error.
     */
    private function garmin_fetch_and_insert_kml(string $url, string $password, string $feed_name, string $mapshare_address)
    {
        $args = [ 'timeout' => 20 ];
        if (! empty($password)) {
            $args['headers'] = [
                'Authorization' => 'Basic ' . base64_encode(':' . $password),
            ];
        }

        $response = wp_remote_get($url, $args);
        if (is_wp_error($response)) {
            $this->garmin_log($feed_name, 'http_error', [ 'url' => $url, 'error' => $response->get_error_message() ]);
            return false;
        }

        $http_code = (int) wp_remote_retrieve_response_code($response);
        if ($http_code !== 200) {
            trigger_error(
                "Garmin inReach feed '{$feed_name}': HTTP {$http_code} from {$url}",
                E_USER_WARNING
            );
            $this->garmin_log($feed_name, 'http_non_200', [ 'url' => $url, 'http_code' => $http_code ]);
            return false;
        }

        $body = wp_remote_retrieve_body($response);
        if (empty($body)) {
            $this->garmin_log($feed_name, 'empty_body', [ 'url' => $url ]);
            return 0;
        }

        $prev_libxml = libxml_use_internal_errors(true);
        try {
            $xml = new SimpleXMLElement($body);
        } catch (Exception $e) {
            libxml_clear_errors();
            libxml_use_internal_errors($prev_libxml);
            trigger_error("Garmin inReach feed '{$feed_name}': failed to parse KML from {$url}", E_USER_WARNING);
            $this->garmin_log($feed_name, 'kml_parse_error', [ 'url' => $url, 'exception' => $e->getMessage() ]);
            return false;
        }
        libxml_clear_errors();
        libxml_use_internal_errors($prev_libxml);
        unset($body);

        $xml->registerXPathNamespace('kml', 'http://www.opengis.net/kml/2.2');

        $placemarks = $xml->xpath('//kml:Placemark');
        $this->garmin_log($feed_name, 'kml_parsed', [
            'url'        => $url,
            'placemarks' => count($placemarks),
        ]);

        $inserted = 0;
        $skipped  = 0;

        foreach ($placemarks as $placemark) {
            // Skip the LineString track-summary placemark.
            if (isset($placemark->LineString)) {
                continue;
            }

            $when = isset($placemark->TimeStamp->when)
                ? trim((string) $placemark->TimeStamp->when)
                : null;
            if (empty($when)) {
                $this->garmin_log($feed_name, 'skip_no_timestamp', []);
                $skipped++;
                continue;
            }
            $unixtime = strtotime($when);
            if ($unixtime === false || $unixtime <= 0) {
                $this->garmin_log($feed_name, 'skip_bad_timestamp', [ 'when' => $when ]);
                $skipped++;
                continue;
            }

            // Build ExtendedData key→value map.
            $ext = [];
            if (isset($placemark->ExtendedData->Data)) {
                foreach ($placemark->ExtendedData->Data as $node) {
                    $ext[ (string) ($node['name'] ?? '') ] = trim((string) ($node->value ?? ''));
                }
            }

            // Skip points without a valid GPS fix.
            if (isset($ext['Valid GPS Fix']) && strtolower($ext['Valid GPS Fix']) !== 'true') {
                $this->garmin_log($feed_name, 'skip_no_gps_fix', [
                    'when'  => $when,
                    'event' => $ext['Event'] ?? '',
                ]);
                $skipped++;
                continue;
            }

            // Altitude from ExtendedData (strip " m from MSL" suffix).
            $altitude = null;
            if (! empty($ext['Elevation'])) {
                $altitude = (int) round((float) $ext['Elevation']);
            }

            // Coordinates: prefer ExtendedData fields; fall back to <Point><coordinates>
            // (lon,lat[,alt] order) for event types that omit them from ExtendedData.
            $lat = isset($ext['Latitude']) ? (float) $ext['Latitude'] : null;
            $lng = isset($ext['Longitude']) ? (float) $ext['Longitude'] : null;
            if (($lat === null || $lng === null) && isset($placemark->Point->coordinates)) {
                $coords = array_map('trim', explode(',', (string) $placemark->Point->coordinates));
                if (count($coords) >= 2) {
                    $lng = (float) $coords[0];
                    $lat = (float) $coords[1];
                    if ($altitude === null && isset($coords[2]) && $coords[2] !== '') {
                        $altitude = (int) round((float) $coords[2]);
                    }
                }
                $this->garmin_log($feed_name, 'coords_from_point_element', [
                    'when' => $when,
                    'lat'  => $lat,
                    'lng'  => $lng,
                ]);
            }
            if ($lat === null || $lng === null) {
                $this->garmin_log($feed_name, 'skip_no_coords', [
                    'when'  => $when,
                    'event' => $ext['Event'] ?? '',
                ]);
                $skipped++;
                continue;
            }

            // Speed: Garmin reports km/h — no conversion needed (strip " km/h" suffix).
            $speed = null;
            if (! empty($ext['Velocity'])) {
                $speed = round((float) $ext['Velocity'], 2);
            }

            // Bearing: strip " ° True" suffix.
            $bearing = null;
            if (! empty($ext['Course'])) {
                $bearing = round((float) $ext['Course'], 2);
            }

            // Garmin inReach KML Event field reference:
            //   "Tracking message received."       Type 17 — periodic tracking ping            → TRACK
            //   "Location received."               Type 16 — on-demand location request        → TRACK
            //   "Tracking interval received."      Type 30 — tracking settings changed         → TRACK
            //   "Tracking turned on from device."  Type 38 — tracking session started          → NEWMOVEMENT
            //   "Tracking turned off from device." Type 29 — tracking session ended            → STOP
            //   "Quick Text to MapShare received"  Type 52 — preset quick-text to MapShare     → CUSTOM
            //   "Msg to shared map received"       Type 45 — typed message to MapShare         → CUSTOM
            //   "Text message received."           Type 13 — typed message to a contact        → CUSTOM
            // Note: In Emergency=True is the ONLY reliable SOS indicator; quick texts like
            // "J'ai besoin d'aide" are NOT emergencies (they are preset convenience messages).
            $in_emergency = strtolower($ext['In Emergency'] ?? '') === 'true';
            $text_message = $ext['Text'] ?? '';
            $event        = $ext['Event'] ?? '';
            if ($in_emergency) {
                $type = 'SOS';
            } elseif ($text_message !== '') {
                $type = 'CUSTOM';
            } elseif ($event === 'Tracking turned on from device.') {
                $type = 'NEWMOVEMENT';
            } elseif ($event === 'Tracking turned off from device.') {
                $type = 'STOP';
            } else {
                $type = 'TRACK';
            }

            $row = [
                'feed_name'      => $feed_name,
                'feed_id'        => $mapshare_address,
                'type'           => $type,
                'time'           => $unixtime,
                'latitude'       => $lat,
                'longitude'      => $lng,
                'device_name'    => $ext['Name'] ?? null,
                'model'          => $ext['Device Type'] ?? null,
                'message'        => $event !== '' ? $event : null,
                'custom_message' => $text_message !== '' ? $text_message : null,
            ];
            if ($altitude !== null) {
                $row['altitude'] = $altitude;
            }
            if ($speed !== null) {
                $row['speed'] = $speed;
            }
            if ($bearing !== null) {
                $row['bearing'] = $bearing;
            }

            $result = $this->db->insert_row($row);
            if ($result !== false && $result !== 0) {
                $inserted++;
                $this->garmin_log($feed_name, 'point_inserted', [
                    'when' => $when,
                    'type' => $type,
                    'lat'  => $lat,
                    'lng'  => $lng,
                ]);
            }
        }

        $this->garmin_log($feed_name, 'kml_processed', [
            'url'      => $url,
            'inserted' => $inserted,
            'skipped'  => $skipped,
        ]);

        return $inserted;
    }

    /**
     * Emits a structured debug line when WP_DEBUG is enabled.
     * Output goes to the PHP error log via trigger_error(E_USER_NOTICE),
     * matching the pattern used by Spotmap_Ingest::log_ingest_event().
     *
     * @param string               $feed_name Feed name for context.
     * @param string               $event     Short event identifier.
     * @param array<string, mixed> $context   Arbitrary key→value pairs.
     */
    private function garmin_log(string $feed_name, string $event, array $context): void
    {
        if (! defined('WP_DEBUG') || ! WP_DEBUG) {
            return;
        }
        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_trigger_error
        trigger_error(
            sprintf(
                '[%s] [spotmap garmin] feed=%s event=%s context=%s',
                gmdate('c'),
                $feed_name,
                $event,
                wp_json_encode($context)
            ),
            E_USER_NOTICE
        );
    }

    private function get_data_findmespot($feed_name, $id, $pwd)
    {
        $i = 0;
        while (true) {
            $feed_url = 'https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/'.$id.'/message.json?start='.$i;
            if (!empty($pwd)) {
                $feed_url .= '&feedPassword=' . $pwd;
            }

            $jsonraw = wp_remote_retrieve_body(wp_remote_get($feed_url));
            if (empty($jsonraw)) {
                return false;
            }

            $json = json_decode($jsonraw, true)['response'];

            if (!empty($json['errors']['error']['code'])) {
                //E-0195 means the feed has no points to show
                $error_code = $json['errors']['error']['code'];
                if ($error_code === "E-0195") {
                    return true;
                }
                trigger_error($json['errors']['error']['description'], E_USER_WARNING);
                return false;
            }
            $messages = $json['feedMessageResponse']['messages']['message'];

            $found_existing = false;
            foreach ((array)$messages as &$point) {
                if ($this->db->does_point_exist($point['id'])) {
                    $found_existing = true;
                    break;
                }
                $point['feedName'] = $feed_name;
                $point['feedId'] = $id;
                $this->db->insert_point($point);
            }

            if ($found_existing) {
                return true;
            }

            $count = (int) $json['feedMessageResponse']['count'];
            $total = (int) $json['feedMessageResponse']['totalCount'];
            $i    += $count;
            if ($i >= $total) {
                return true;
            }
        }

    }
}
