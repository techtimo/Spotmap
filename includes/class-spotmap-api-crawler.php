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
     * Fetches tracking points from a Garmin inReach MapShare KML feed and inserts
     * new ones via insert_row(). Incremental: only requests points since the
     * last stored point for this feed (or all points on first run).
     *
     * @param string $feed_name       Feed name (stored in DB).
     * @param string $mapshare_address  The MapShare username (share.garmin.com/Feed/Share/{address}).
     * @param string $password        Optional MapShare password (Basic Auth, empty username).
     * @return int|false Number of new rows inserted, or false on HTTP/parse error.
     */
    private function get_data_garmin_inreach(string $feed_name, string $mapshare_address, string $password)
    {
        global $wpdb;

        $url = 'https://share.garmin.com/Feed/Share/' . rawurlencode($mapshare_address);

        // Incremental polling: fetch only points after the last stored one.
        // On first run (no points yet) use a far-past anchor so the API returns
        // all available history instead of just today's points (which is what
        // the parameterless request returns).
        $last_time = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT MAX(time) FROM {$wpdb->prefix}spotmap_points WHERE feed_name = %s",
                $feed_name
            )
        );
        $d1 = ! empty($last_time)
            ? gmdate('Y-m-d\TH:i\Z', (int) $last_time + 1)
            : '2000-01-01T00:00Z';
        $url .= '?d1=' . $d1;

        $args = [ 'timeout' => 20 ];
        if (! empty($password)) {
            $args['headers'] = [
                'Authorization' => 'Basic ' . base64_encode(':' . $password),
            ];
        }

        $response = wp_remote_get($url, $args);
        if (is_wp_error($response)) {
            return false;
        }

        $http_code = (int) wp_remote_retrieve_response_code($response);
        if ($http_code !== 200) {
            trigger_error(
                "Garmin inReach feed '{$feed_name}': HTTP {$http_code} from {$url}",
                E_USER_WARNING
            );
            return false;
        }

        $body = wp_remote_retrieve_body($response);
        if (empty($body)) {
            return false;
        }

        $prev_libxml = libxml_use_internal_errors(true);
        try {
            $xml = new SimpleXMLElement($body);
        } catch (Exception $e) {
            libxml_clear_errors();
            libxml_use_internal_errors($prev_libxml);
            trigger_error("Garmin inReach feed '{$feed_name}': failed to parse KML", E_USER_WARNING);
            return false;
        }
        libxml_clear_errors();
        libxml_use_internal_errors($prev_libxml);
        unset($body);

        $xml->registerXPathNamespace('kml', 'http://www.opengis.net/kml/2.2');

        $inserted = 0;

        foreach ($xml->xpath('//kml:Placemark') as $placemark) {
            // Skip the LineString summary placemark at the end.
            if (isset($placemark->LineString)) {
                continue;
            }

            $when = isset($placemark->TimeStamp->when)
                ? trim((string) $placemark->TimeStamp->when)
                : null;
            if (empty($when)) {
                continue;
            }
            $unixtime = strtotime($when);
            if ($unixtime === false || $unixtime <= 0) {
                continue;
            }

            $ext = [];
            if (isset($placemark->ExtendedData->Data)) {
                foreach ($placemark->ExtendedData->Data as $data_node) {
                    $name        = (string) ($data_node['name'] ?? '');
                    $ext[ $name ] = trim((string) ($data_node->value ?? ''));
                }
            }

            // Skip points without a valid GPS fix.
            if (isset($ext['Valid GPS Fix']) && strtolower($ext['Valid GPS Fix']) !== 'true') {
                continue;
            }

            $lat = isset($ext['Latitude']) ? (float) $ext['Latitude'] : null;
            $lng = isset($ext['Longitude']) ? (float) $ext['Longitude'] : null;
            if ($lat === null || $lng === null) {
                continue;
            }

            $altitude = null;
            if (! empty($ext['Elevation'])) {
                $altitude = (int) round((float) $ext['Elevation']);
            }

            // Garmin reports km/h — no conversion needed.
            $speed = null;
            if (! empty($ext['Velocity'])) {
                $speed = round((float) $ext['Velocity'], 2);
            }

            $bearing = null;
            if (! empty($ext['Course'])) {
                $bearing = round((float) $ext['Course'], 2);
            }

            // Garmin inReach KML Event field reference (Type IDs from MapShare feed):
            //
            //   "Tracking message received."         Type 17 — automatic periodic ping at tracking interval → TRACK
            //   "Location received."                 Type 16 — on-demand ping triggered by an external location request → TRACK
            //   "Tracking interval received."        Type 30 — tracking settings changed, point has location → TRACK
            //   "Tracking turned on from device."    Type 38 — user started tracking session → NEWMOVEMENT
            //   "Tracking turned off from device."   Type 29 — user stopped tracking session → STOP
            //   "Quick Text to MapShare received"    Type 52 — user sent a preset quick-text to the MapShare page → CUSTOM
            //   "Msg to shared map received"         Type 45 — user sent a typed message to the MapShare page → CUSTOM
            //   "Text message received."             Type 13 — user sent a fully typed message to a contact → CUSTOM
            //
            // Note: preset quick texts ("Quick Text to MapShare received") look alarming
            // (e.g. "J'ai besoin d'aide") but are NOT emergencies. A real SOS is always
            // signalled by In Emergency=True (holding the SOS button + device confirmation),
            // independent of any message text.
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
                'message'        => $ext['Event'] ?? null,
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
            }
        }

        return $inserted;
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
                    return false;
                }
                trigger_error($json['errors']['error']['description'], E_USER_WARNING);
                return false;
            }
            $messages = $json['feedMessageResponse']['messages']['message'];


            // loop through the data, if a msg is in the db all the others are there as well
            foreach ((array)$messages as &$point) {
                if ($this->db->does_point_exist($point['id'])) {
                    // trigger_error($point['id']. " already exists", E_USER_WARNING);
                    return;
                }
                $point['feedName'] = $feed_name;
                $point['feedId'] = $id;
                $this->db->insert_point($point);
            }
            $i += $json['feedMessageResponse']['count'] + 1;
            return true;
        }

    }
}
