<?php

class Spotmap_Database
{
    /**
     * Hard cap on rows returned by get_points() when no explicit limit is requested.
     * Prevents runaway memory use / PHP timeout on large datasets.
     * Callers can pass a lower $filter['limit'] to request fewer rows.
     */
    public const MAX_POINTS_PER_QUERY = 150000;

    private const ALLOWED_COLUMNS = [
            'id', 'type', 'time', 'latitude', 'longitude', 'altitude',
            'battery_status', 'message', 'custom_message', 'feed_name',
            'feed_id', 'model', 'device_name', 'local_timezone',
            'hdop', 'speed', 'bearing', 'hidden_points',
        ];

    private static function sanitize_select(string $select): string
    {
        if ($select === '*') {
            return '*';
        }
        $safe = array_filter(
            array_map('trim', explode(',', $select)),
            fn ($col) => in_array($col, self::ALLOWED_COLUMNS, true)
        );
        return $safe ? implode(', ', $safe) : '*';
    }

    private static function sanitize_identifier(string $value): ?string
    {
        $value = trim($value);
        return in_array($value, self::ALLOWED_COLUMNS, true) ? $value : null;
    }

    private static function sanitize_group_by(string $value): ?string
    {
        $cols = array_map('trim', explode(',', $value));
        $safe = array_filter($cols, fn ($col) => in_array($col, self::ALLOWED_COLUMNS, true));
        if (count($safe) !== count($cols)) {
            return null;
        }
        return implode(', ', $safe);
    }

    private static function sanitize_order(string $order_by): string
    {
        $safe = [];
        foreach (array_map('trim', explode(',', $order_by)) as $part) {
            $tokens = preg_split('/\s+/', $part, 2);
            $col    = self::sanitize_identifier($tokens[0]);
            if ($col === null) {
                continue;
            }
            $dir    = strtoupper($tokens[1] ?? '');
            $safe[] = $col . ($dir === 'DESC' ? ' DESC' : ($dir === 'ASC' ? ' ASC' : ''));
        }
        return $safe ? 'ORDER BY ' . implode(', ', $safe) : '';
    }

    /**
     * Loads option helper dependencies used by the database layer.
     *
     * @return void
     */
    public function __construct()
    {
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-spotmap-options.php';
    }

    /**
     * Create (or update) the plugin table. Safe to call multiple times via dbDelta.
     */
    public static function create_table(): void
    {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        // Column unit reference:
        //   altitude      — metres (integer), consistent across all providers.
        //   bearing       — degrees (float 0–360), consistent across all providers.
        //   speed         — km/h (float). NOTE: OsmAnd stores raw m/s (pre-existing bug);
        //                   Victron and Garmin inReach store km/h. Teltonika: unknown unit.
        //   hdop          — dimensionless HDOP value.
        //   time          — Unix timestamp (UTC seconds).
        $sql = "CREATE TABLE {$wpdb->prefix}spotmap_points (
		    `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
		    `type` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,
		    `time` int(11) unsigned NOT NULL,
		    `latitude` float(11,7) NOT NULL,
		    `longitude` float(11,7) NOT NULL,
		    `altitude` int(11) DEFAULT NULL,
		    `battery_status` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `custom_message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `feed_name` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `feed_id` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `model` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `device_name` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `local_timezone` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
		    `hdop` float DEFAULT NULL,
		    `speed` float DEFAULT NULL,
		    `bearing` float DEFAULT NULL,
		    `hidden_points` int(11) unsigned DEFAULT 0,
		    PRIMARY KEY (`id`),
		    UNIQUE KEY `id_UNIQUE` (`id`),
		    KEY `idx_feed_time` (`feed_name`, `time`)
		    ) $charset_collate";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql, true);
    }

    public function get_all_feednames()
    {
        global $wpdb;
        $from_db = $wpdb->get_col("SELECT DISTINCT feed_name FROM " . $wpdb->prefix . "spotmap_points WHERE feed_name IS NOT NULL");
        $configured = Spotmap_Options::get_feeds();
        $from_options = array_column($configured, 'name');
        return array_values(array_unique(array_merge($from_options, $from_db)));
    }

    /**
     * Returns summary stats for the admin dashboard widget.
     *
     * @return array{total_points: int, today_points: int, feeds: list<array{name: string, count: int, last_point: int}>}
     */
    public function get_dashboard_stats(): array
    {
        global $wpdb;
        $table = $wpdb->prefix . 'spotmap_points';

        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table}");

        $tz          = wp_timezone();
        $today_start = (new DateTime('today midnight', $tz))->getTimestamp();
        $today_end   = (new DateTime('tomorrow midnight', $tz))->getTimestamp() - 1;
        $today       = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE time BETWEEN %d AND %d",
                $today_start,
                $today_end
            )
        );

        $rows = $wpdb->get_results(
            "SELECT feed_name, COUNT(*) AS cnt, MAX(time) AS last_point
             FROM {$table}
             WHERE feed_name IS NOT NULL
             GROUP BY feed_name
             ORDER BY last_point DESC",
            ARRAY_A
        );

        $feeds = [];
        foreach ($rows as $row) {
            $feeds[] = [
                'name'       => $row['feed_name'],
                'count'      => (int) $row['cnt'],
                'last_point' => (int) $row['last_point'],
            ];
        }
        $type_rows = $wpdb->get_results(
            "SELECT type, COUNT(*) AS cnt FROM {$table} WHERE type IN ('POST', 'MEDIA') GROUP BY type",
            ARRAY_A
        );
        $type_counts = [];
        foreach ($type_rows as $row) {
            $type_counts[ $row['type'] ] = (int) $row['cnt'];
        }

        return [
            'total_points' => $total,
            'today_points' => $today,
            'feeds'        => $feeds,
            'type_counts'  => $type_counts,
        ];
    }

    /**
     * Returns a map of feed_name => point count for all feeds in the DB,
     * optionally restricted to a date range.
     *
     * $from and $to accept the same formats as get_points() date-range:
     * a date/datetime string (e.g. "2024-01-01") or a relative "last-7-days" string.
     *
     * @param string $from Optional lower bound (inclusive).
     * @param string $to   Optional upper bound (inclusive).
     * @return array<string, int>
     */
    public function get_point_counts_by_feed(string $from = '', string $to = ''): array
    {
        global $wpdb;
        $where = '';
        if (! empty($to)) {
            if (substr($to, 0, 5) === 'last-') {
                $rel_string = str_replace('-', ' ', substr($to, 5));
                $date       = date_create('@' . strtotime('-' . $rel_string));
            } else {
                $date = date_create($to);
            }
            if ($date !== null && $date !== false) {
                $where .= "AND FROM_UNIXTIME(time) <= '" . date_format($date, 'Y-m-d H:i:s') . "' ";
            }
        }
        if (! empty($from)) {
            if (substr($from, 0, 5) === 'last-') {
                $rel_string = str_replace('-', ' ', substr($from, 5));
                $date       = date_create('@' . strtotime('-' . $rel_string));
            } else {
                $date = date_create($from);
            }
            if ($date !== null && $date !== false) {
                $where .= "AND FROM_UNIXTIME(time) >= '" . date_format($date, 'Y-m-d H:i:s') . "' ";
            }
        }
        $rows = $wpdb->get_results(
            "SELECT feed_name, COUNT(*) AS cnt, MIN(time) AS first_point, MAX(time) AS last_point FROM " . $wpdb->prefix . "spotmap_points WHERE feed_name IS NOT NULL {$where}GROUP BY feed_name ORDER BY feed_name",
            ARRAY_A
        );
        $counts = [];
        foreach ($rows as $row) {
            $counts[ $row['feed_name'] ] = [
                'count'       => (int) $row['cnt'],
                'first_point' => isset($row['first_point']) ? (int) $row['first_point'] : null,
                'last_point'  => isset($row['last_point']) ? (int) $row['last_point'] : null,
            ];
        }
        return $counts;
    }

    /**
     * Returns aggregate statistics for a feed: point count, date range, avg altitude,
     * busiest day, and the day with the highest cumulative GPS distance.
     *
     * @param string $feed_name
     * @return array<string, mixed>
     */
    public function get_feed_stats(string $feed_name): array
    {
        global $wpdb;

        $table = $wpdb->prefix . 'spotmap_points';

        $agg = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT
					COUNT(*)            AS point_count,
					MIN(time)           AS first_point,
					MAX(time)           AS last_point,
					AVG(altitude)       AS avg_altitude
				FROM {$table}
				WHERE feed_name = %s",
                $feed_name
            ),
            ARRAY_A
        );

        $busiest = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT DATE(FROM_UNIXTIME(time)) AS day, COUNT(*) AS cnt
				FROM {$table}
				WHERE feed_name = %s
				GROUP BY day
				ORDER BY cnt DESC
				LIMIT 1",
                $feed_name
            ),
            ARRAY_A
        );

        $points = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT time, latitude, longitude
				FROM {$table}
				WHERE feed_name = %s
				ORDER BY time ASC",
                $feed_name
            ),
            ARRAY_A
        );

        // Accumulate GPS distance per calendar day (UTC).
        $distance_by_day = [];
        $prev            = null;
        $prev_day        = null;
        foreach ($points as $pt) {
            $day = gmdate('Y-m-d', (int) $pt['time']);
            if ($prev !== null && $prev_day === $day) {
                $distance_by_day[ $day ] = ($distance_by_day[ $day ] ?? 0.0)
                    + self::haversine_distance(
                        (float) $prev['latitude'],
                        (float) $prev['longitude'],
                        (float) $pt['latitude'],
                        (float) $pt['longitude']
                    ) / 1000.0;
            }
            $prev     = $pt;
            $prev_day = $day;
        }

        $max_distance_day  = null;
        $max_distance_km   = 0.0;
        foreach ($distance_by_day as $day => $km) {
            if ($km > $max_distance_km) {
                $max_distance_km  = $km;
                $max_distance_day = $day;
            }
        }

        return [
            'point_count'          => (int) ($agg['point_count'] ?? 0),
            'first_point'          => isset($agg['first_point']) ? (int) $agg['first_point'] : null,
            'last_point'           => isset($agg['last_point']) ? (int) $agg['last_point'] : null,
            'avg_altitude'         => isset($agg['avg_altitude']) ? (float) round($agg['avg_altitude']) : null,
            'busiest_day_date'     => $busiest['day']  ?? null,
            'busiest_day_count'    => isset($busiest['cnt']) ? (int) $busiest['cnt'] : null,
            'max_distance_day_date' => $max_distance_day,
            'max_distance_day_km'  => $max_distance_day !== null ? round($max_distance_km, 1) : null,
        ];
    }

    /**
     * Deletes all points for a given feed_name.
     *
     * @param string $feed_name
     * @return int Number of rows deleted.
     */
    public function delete_points_by_feed_name(string $feed_name): int
    {
        global $wpdb;
        $result = $wpdb->delete(
            $wpdb->prefix . 'spotmap_points',
            [ 'feed_name' => $feed_name ],
            [ '%s' ]
        );
        return $result === false ? 0 : (int) $result;
    }

    public function get_all_types()
    {
        global $wpdb;
        return $wpdb->get_col("SELECT DISTINCT type FROM " . $wpdb->prefix . "spotmap_points");
    }
    public function get_last_point($feed_id = null)
    {
        global $wpdb;
        $where = ' ';
        if (isset($feed)) {
            $where .= "AND feed_id = '".$feed_id."' ";
        }
        return $wpdb->get_row("SELECT * FROM " . $wpdb->prefix . "spotmap_points WHERE 1 ".$where." ORDER BY id DESC LIMIT 1");
    }


    public function get_points($filter)
    {
        // error_log(print_r($filter,true));

        $select   = self::sanitize_select($filter['select'] ?? '*');
        $group_by = empty($filter['groupBy']) ? null : self::sanitize_group_by($filter['groupBy']);
        $order    = empty($filter['orderBy']) ? '' : self::sanitize_order($filter['orderBy']);
        $limit    = 'LIMIT ' . (empty($filter['limit']) ? self::MAX_POINTS_PER_QUERY : absint($filter['limit']));
        global $wpdb;
        $where = '';
        if (!empty($filter['feeds'])) {
            $feeds_on_db = $this->get_all_feednames();
            foreach ($filter['feeds'] as $value) {
                if (!in_array($value, $feeds_on_db)) {
                    return ['error' => true,'title' => $value.' not found in DB','message' => "Change the 'devices' attribute of your Shortcode"];
                }
            }
            $placeholders = implode(', ', array_fill(0, count($filter['feeds']), '%s'));
            // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
            $where .= $wpdb->prepare("AND feed_name IN ($placeholders) ", ...$filter['feeds']);
        }
        if (!empty($filter['type'])) {
            $track_aliases = ['UNLIMITED-TRACK', 'EXTREME-TRACK'];
            $filter['type'] = array_values(array_unique(array_map(
                fn ($t) => in_array($t, $track_aliases, true) ? 'TRACK' : $t,
                $filter['type']
            )));
            $types_on_db = $this->get_all_types();
            $allowed_types = array_merge($types_on_db, array_keys(Spotmap_Options::get_marker_defaults()));
            foreach ($filter['type'] as $value) {
                if (!in_array($value, $allowed_types)) {
                    return ['error' => true,'title' => $value.' not found in DB','message' => "Change the 'devices' attribute of your Shortcode"];
                }
            }
            $placeholders = implode(', ', array_fill(0, count($filter['type']), '%s'));
            // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
            $where .= $wpdb->prepare("AND type IN ($placeholders) ", ...$filter['type']);
        }

        // either have a day or a range
        $date;
        if (!empty($filter['date'])) {
            $date = date_create($filter['date']);
            if ($date != null) {
                $date = date_format($date, "Y-m-d");
                $where .= "AND FROM_UNIXTIME(time) between '" . $date . " 00:00:00' and  '" . $date . " 23:59:59' ";
            }
        } elseif (!empty($filter['date-range'])) {
            if (!empty($filter['date-range']['to'])) {

                $date = date_create($filter['date-range']['to']);
                if (substr($filter['date-range']['to'], 0, 5) == 'last-') {
                    $rel_string = substr($filter['date-range']['to'], 5);
                    $rel_string = str_replace("-", " ", $rel_string);
                    $date = date_create("@".strtotime('-'.$rel_string));
                }

                if ($date != null) {
                    $where .= "AND FROM_UNIXTIME(time) <= '" . date_format($date, "Y-m-d H:i:s") . "' ";
                }
            }
            if (!empty($filter['date-range']['from'])) {
                $date = date_create($filter['date-range']['from']);
                if (substr($filter['date-range']['from'], 0, 5) == 'last-') {
                    $rel_string = substr($filter['date-range']['from'], 5);
                    $rel_string = str_replace("-", " ", $rel_string);
                    $date = date_create("@".strtotime('-'.$rel_string));
                }
                if ($date != null) {
                    $where .= "AND FROM_UNIXTIME(time) >= '" . date_format($date, "Y-m-d H:i:s") . "' ";
                }
            }
        }
        if (! empty($group_by)) {
            $type_sub = '';
            if (! empty($filter['type'])) {
                $sub_placeholders = implode(', ', array_fill(0, count($filter['type']), '%s'));
                // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
                $type_sub = $wpdb->prepare(" WHERE type IN ($sub_placeholders)", ...$filter['type']);
            }
            $where .= " AND id IN (SELECT max(id) FROM " . $wpdb->prefix . "spotmap_points" . $type_sub . " GROUP BY " . $group_by . " )";
        }

        $query = "SELECT ".$select.", custom_message FROM " . $wpdb->prefix . "spotmap_points WHERE 1 ".$where." ".$order. " " .$limit;
        // error_log("Query: " .$query);
        $points = $wpdb->get_results($query);
        foreach ($points as &$point) {
            $point->unixtime = $point->time;
            // $point->date = date_i18n( get_option('date_format'), $date );
            $point->date = wp_date(get_option('date_format'), $point->unixtime);
            $point->time = wp_date(get_option('time_format'), $point->unixtime);
            if (!empty($point->local_timezone)) {
                $timezone = new DateTimeZone($point->local_timezone);
                $point->localdate = wp_date(get_option('date_format'), $point->unixtime, $timezone);
                $point->localtime = wp_date(get_option('time_format'), $point->unixtime, $timezone);
            }
            if (! empty($point->custom_message)) {
                $point->message = $point->custom_message;
            }
            unset($point->custom_message);
        }
        return $points;
    }

    /**
     * Returns the haversine great-circle distance in metres between two coordinates.
     */
    private static function haversine_distance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r    = 6371000.0; // Earth radius in metres
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $dphi = deg2rad($lat2 - $lat1);
        $dlam = deg2rad($lon2 - $lon1);
        $a    = sin($dphi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($dlam / 2) ** 2;
        return 2 * $r * asin(sqrt($a));
    }

    /**
     * Returns the most-recently inserted point for a given feed_name, or null.
     */
    private function get_last_point_for_feed(string $feed_name, string $type = ''): ?object
    {
        global $wpdb;
        if ($type !== '') {
            return $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = %s AND type = %s ORDER BY id DESC LIMIT 1",
                    $feed_name,
                    $type
                )
            ) ?: null;
        }
        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = %s ORDER BY id DESC LIMIT 1",
                $feed_name
            )
        ) ?: null;
    }

    /**
     * Low-level insert: accepts DB column names directly.
     *
     * Required keys: feed_name, type, time, latitude, longitude.
     * All other columns are optional.
     *
     * Coordinate bounds are validated; if invalid, the last known point's
     * coordinates for the same feed_id are used as a fallback.
     *
     * Rolling-anchor deduplication: if the new point is within the configured
     * import-min-distance of the last stored TRACK point for the same feed AND within
     * import-min-time seconds, all mutable fields (latitude, longitude, time,
     * altitude, speed, bearing, hdop, battery_status) of the existing row are
     * updated with the new values and 0 is returned.  The anchor rolls forward
     * with every suppressed ping, so the last stored row always reflects the
     * most recent reported position.  A point is permanently committed only
     * when the next ping exceeds either threshold.
     * The first arrival point is always kept because no prior point exists yet.
     * Deduplication only compares against previous TRACK rows — non-TRACK events
     * (CUSTOM, STOP, HELP, SOS, …) are never used as the rolling anchor.
     *
     * @param array<string, mixed> $data           Column → value pairs (DB column names).
     * @param bool                 $schedule_tz     Whether to schedule the timezone lookup event.
     * @return int|false Number of rows inserted, or false on error.
     */
    public function insert_row(array $data, bool $schedule_tz = true)
    {
        global $wpdb;
        $last_point = $this->get_last_point($data['feed_id'] ?? null);

        if (($data['latitude'] ?? 0) > 90 || ($data['latitude'] ?? 0) < -90) {
            $data['latitude'] = $last_point->latitude ?? 0;
        }
        if (($data['longitude'] ?? 0) > 180 || ($data['longitude'] ?? 0) < -180) {
            $data['longitude'] = $last_point->longitude ?? 0;
        }

        // Stationary-deduplication: skip points that are too close in space and time.
        // Only applies to TRACK type; all event types are always stored.
        if (! empty($data['feed_name']) && ($data['type'] ?? '') === 'TRACK') {
            $prev = $this->get_last_point_for_feed($data['feed_name'], 'TRACK');
            if ($prev !== null) {
                $distance_m = self::haversine_distance(
                    (float) $prev->latitude,
                    (float) $prev->longitude,
                    (float) $data['latitude'],
                    (float) $data['longitude']
                );
                $time_diff_s  = abs((int) $data['time'] - (int) $prev->time);
                $min_distance = (int) Spotmap_Options::get_setting('import-min-distance', 25);
                $min_time     = (int) Spotmap_Options::get_setting('import-min-time', 600);
                if ($distance_m <= $min_distance && $time_diff_s < $min_time) {
                    // Rolling-anchor: replace the pending row with the new position so
                    // the anchor moves forward with each suppressed ping.
                    $mutable = [ 'time', 'latitude', 'longitude', 'altitude', 'speed', 'bearing', 'hdop', 'battery_status' ];
                    $update                  = array_intersect_key($data, array_flip($mutable));
                    // Only advance the timestamp — never roll it backward. This matters
                    // for SPOT feeds where the API returns messages newest-first, so
                    // suppressed pings would otherwise overwrite the anchor with an older time.
                    if (isset($update['time']) && (int) $update['time'] < (int) $prev->time) {
                        unset($update['time']);
                    }
                    $update['hidden_points'] = (int) ($prev->hidden_points ?? 0) + 1;
                    $wpdb->update(
                        $wpdb->prefix . 'spotmap_points',
                        $update,
                        array( 'id' => $prev->id ),
                        null,
                        array( '%d' )
                    );
                    return 0;
                }
            }
        }

        $result = $wpdb->insert($wpdb->prefix . 'spotmap_points', $data);

        if ($result && $schedule_tz) {
            wp_schedule_single_event(time(), 'spotmap_get_timezone_hook');
        }

        return $result;
    }

    /**
     * Returns the per-feed custom message override for a given message type, or null if none set.
     *
     * @param string $feed_name
     * @param string $msg_type
     * @return string|null
     */
    private function resolve_feed_custom_message(string $feed_name, string $msg_type): ?string
    {
        foreach (Spotmap_Options::get_feeds() as $feed) {
            if (($feed['name'] ?? '') === $feed_name) {
                $override = $feed['custom_messages'][ $msg_type ] ?? '';
                return $override !== '' ? $override : null;
            }
        }
        return null;
    }

    public function insert_point($point, $multiple = false)
    {
        // error_log(print_r($point,true));
        if ($point['unixTime'] == 1) {
            return 0;
        }
        $msg_type       = in_array($point['messageType'], [ 'EXTREME-TRACK', 'UNLIMITED-TRACK' ], true) ? 'TRACK' : $point['messageType'];
        $custom_message = $this->resolve_feed_custom_message($point['feedName'], $msg_type);
        $data = [
            'feed_name'      => $point['feedName'],
            'type'           => $msg_type,
            'time'           => $point['unixTime'],
            'latitude'       => $point['latitude'],
            'longitude'      => $point['longitude'],
            'model'          => $point['modelId'],
            'device_name'    => $point['messengerName'],
            'message'        => !empty($point['messageContent']) ? $point['messageContent'] : null,
            'custom_message' => $custom_message,
            'feed_id'        => $point['feedId'],
        ];
        if (array_key_exists('id', $point)) {
            $data['id'] = $point['id'];
        }
        if (array_key_exists('battery_status', $point)) {
            $data['battery_status'] = $point['batteryState'];
        }
        if (array_key_exists('altitude', $point)) {
            $data['altitude'] = $point['altitude'];
        }
        if (array_key_exists('local_timezone', $point)) {
            $data['local_timezone'] = $point['local_timezone'];
        }
        return $this->insert_row($data);
    }
    /**
     * This function checks if a point is preseent in the db
     * @param $id int The id of the point to check
     *
     * @return bool true if point with same id is in db else false
     */
    public function does_point_exist($id)
    {
        global $wpdb;
        $result = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE id = {$id}");
        return $result ? true : false;
    }

    public function does_media_exist($attachment_id)
    {
        global $wpdb;
        $result = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE model = %d",
            $attachment_id
        ));
        return (bool) $result;
    }
    public function delete_media_point($attachment_id)
    {
        global $wpdb;
        $result = $wpdb->delete($wpdb->prefix . 'spotmap_points', array('model' => $attachment_id));

        return $result ? true : false;
    }
    /**
     * Update the latitude/longitude of a single point.
     *
     * @param int   $id        Row ID.
     * @param float $latitude  New latitude  (-90 … 90).
     * @param float $longitude New longitude (-180 … 180).
     * @return bool True on success, false on invalid coordinates or DB error.
     */
    public function update_point_position(int $id, float $latitude, float $longitude): bool
    {
        if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
            return false;
        }
        global $wpdb;
        $result = $wpdb->update(
            $wpdb->prefix . 'spotmap_points',
            [ 'latitude' => $latitude, 'longitude' => $longitude ],
            [ 'id' => $id ],
            [ '%f', '%f' ],
            [ '%d' ]
        );
        return $result !== false;
    }

    public function rename_feed_name($old_name, $new_name)
    {
        global $wpdb;
        // error_log('reanem feed');
        $wpdb->query($wpdb->prepare(
            "
			UPDATE `{$wpdb->prefix}spotmap_points`
			SET `feed_name` = %s
			WHERE feed_name = %s",
            [$new_name,$old_name]
        ));
        // error_log(print_r($wpdb->queries,true));

    }

}
