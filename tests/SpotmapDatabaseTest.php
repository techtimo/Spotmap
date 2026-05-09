<?php

class SpotmapDatabaseTest extends WP_UnitTestCase
{
    private static Spotmap_Database $db;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        require_once dirname(__DIR__) . '/includes/class-spotmap-database.php';
        self::$db = new Spotmap_Database();
    }

    /**
     * Builds a valid point array with sensible defaults. Override any key via $overrides.
     */
    private function make_point(array $overrides = []): array
    {
        return array_merge([
            'feedName'       => 'test-feed',
            'feedId'         => 'feed-001',
            'messageType'    => 'OK',
            'unixTime'       => 1700000000,
            'latitude'       => 47.3769,
            'longitude'      => 8.5417,
            'modelId'        => 'SPOT-X',
            'messengerName'  => 'Test Device',
            'messageContent' => '',
        ], $overrides);
    }

    private function make_track_point(array $overrides = []): array
    {
        return $this->make_point(array_merge(['messageType' => 'TRACK'], $overrides));
    }

    // --- insert_point ---

    public function test_insert_point_returns_success(): void
    {
        $result = self::$db->insert_point($this->make_point());
        $this->assertSame(1, $result);
    }

    public function test_insert_point_with_unixtime_1_is_ignored(): void
    {
        $result = self::$db->insert_point($this->make_point([ 'unixTime' => 1 ]));
        $this->assertSame(0, $result);
    }

    public function test_insert_point_stores_correct_values(): void
    {
        self::$db->insert_point($this->make_point([
            'feedName'    => 'alpine-route',
            'messageType' => 'HELP',
            'latitude'    => 46.9481,
            'longitude'   => 7.4474,
        ]));

        global $wpdb;
        $row = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}spotmap_points ORDER BY id DESC LIMIT 1");

        $this->assertSame('alpine-route', $row->feed_name);
        $this->assertSame('HELP', $row->type);
        $this->assertEqualsWithDelta(46.9481, (float) $row->latitude, 0.0001);
        $this->assertEqualsWithDelta(7.4474, (float) $row->longitude, 0.0001);
    }

    // --- get_all_feednames ---

    public function test_get_all_feednames_returns_inserted_feeds(): void
    {
        self::$db->insert_point($this->make_point([ 'feedName' => 'feed-a' ]));
        self::$db->insert_point($this->make_point([ 'feedName' => 'feed-b' ]));

        $names = self::$db->get_all_feednames();

        $this->assertContains('feed-a', $names);
        $this->assertContains('feed-b', $names);
    }

    public function test_get_all_feednames_deduplicates(): void
    {
        self::$db->insert_point($this->make_point([ 'feedName' => 'solo-feed', 'unixTime' => 1700000001 ]));
        self::$db->insert_point($this->make_point([ 'feedName' => 'solo-feed', 'unixTime' => 1700000002 ]));

        $names = self::$db->get_all_feednames();

        $this->assertSame(1, count(array_keys($names, 'solo-feed')));
    }

    // --- get_last_point ---

    public function test_get_last_point_returns_most_recently_inserted(): void
    {
        // Space > 10 min apart so deduplication does not skip the second insert.
        self::$db->insert_point($this->make_point([ 'unixTime' => 1700000001 ]));
        self::$db->insert_point($this->make_point([ 'unixTime' => 1700000001 + 601 ]));

        $last = self::$db->get_last_point();

        $this->assertSame((string) (1700000001 + 601), $last->time);
    }

    // --- does_point_exist ---

    public function test_does_point_exist_returns_true_after_insert(): void
    {
        self::$db->insert_point($this->make_point());

        global $wpdb;
        $id = $wpdb->insert_id;

        $this->assertTrue(self::$db->does_point_exist($id));
    }

    public function test_does_point_exist_returns_false_for_nonexistent_id(): void
    {
        $this->assertFalse(self::$db->does_point_exist(999999));
    }

    // --- get_points ---

    public function test_get_points_filters_by_feed(): void
    {
        self::$db->insert_point($this->make_point([ 'feedName' => 'feed-x', 'unixTime' => 1700000010 ]));
        self::$db->insert_point($this->make_point([ 'feedName' => 'feed-y', 'unixTime' => 1700000011 ]));

        $points = self::$db->get_points([ 'feeds' => [ 'feed-x' ] ]);

        $this->assertCount(1, $points);
        $this->assertSame('feed-x', $points[0]->feed_name);
    }

    public function test_get_points_filters_by_type(): void
    {
        self::$db->insert_point($this->make_point([ 'messageType' => 'OK',   'unixTime' => 1700000020 ]));
        // Space > 10 min apart so deduplication does not skip the second insert.
        self::$db->insert_point($this->make_point([ 'messageType' => 'HELP', 'unixTime' => 1700000020 + 601 ]));

        $points = self::$db->get_points([ 'type' => [ 'HELP' ] ]);

        $this->assertCount(1, $points);
        $this->assertSame('HELP', $points[0]->type);
    }

    public function test_get_points_respects_limit(): void
    {
        // Space > 10 min apart so deduplication does not skip any insert.
        for ($i = 0; $i < 5; $i++) {
            self::$db->insert_point($this->make_point([ 'feedName' => 'limit-feed', 'unixTime' => 1700000030 + $i * 601 ]));
        }

        $points = self::$db->get_points([ 'feeds' => [ 'limit-feed' ], 'limit' => 3 ]);

        $this->assertCount(3, $points);
    }

    public function test_get_points_returns_error_for_unknown_feed(): void
    {
        $result = self::$db->get_points([ 'feeds' => [ 'nonexistent-feed' ] ]);

        $this->assertIsArray($result);
        $this->assertTrue($result['error']);
    }

    // --- rename_feed_name ---

    public function test_rename_feed_name_updates_all_points(): void
    {
        self::$db->insert_point($this->make_point([ 'feedName' => 'old-name', 'unixTime' => 1700000040 ]));
        self::$db->insert_point($this->make_point([ 'feedName' => 'old-name', 'unixTime' => 1700000041 ]));

        self::$db->rename_feed_name('old-name', 'new-name');

        $this->assertNotContains('old-name', self::$db->get_all_feednames());
        $this->assertContains('new-name', self::$db->get_all_feednames());
    }

    // --- get_all_types ---

    public function test_get_all_types_returns_inserted_types(): void
    {
        self::$db->insert_point($this->make_point([ 'messageType' => 'OK',   'unixTime' => 1700000050 ]));
        // Space > 10 min apart so deduplication does not skip the second insert.
        self::$db->insert_point($this->make_point([ 'messageType' => 'HELP', 'unixTime' => 1700000050 + 601 ]));

        $types = self::$db->get_all_types();

        $this->assertContains('OK', $types);
        $this->assertContains('HELP', $types);
    }

    public function test_get_all_types_deduplicates(): void
    {
        self::$db->insert_point($this->make_point([ 'messageType' => 'CUSTOM', 'unixTime' => 1700000060 ]));
        self::$db->insert_point($this->make_point([ 'messageType' => 'CUSTOM', 'unixTime' => 1700000061 ]));

        $types = self::$db->get_all_types();

        $this->assertSame(1, count(array_keys($types, 'CUSTOM')));
    }

    // --- sanitize helpers (private static, accessed via reflection) ---

    private function sanitize(string $method, mixed ...$args): mixed
    {
        $ref = new ReflectionMethod(Spotmap_Database::class, $method);
        $ref->setAccessible(true);
        return $ref->invoke(null, ...$args);
    }

    // sanitize_select

    public function test_sanitize_select_passes_star(): void
    {
        $this->assertSame('*', $this->sanitize('sanitize_select', '*'));
    }

    public function test_sanitize_select_allows_valid_column(): void
    {
        $this->assertSame('latitude', $this->sanitize('sanitize_select', 'latitude'));
    }

    public function test_sanitize_select_allows_multiple_valid_columns(): void
    {
        $this->assertSame('latitude, longitude', $this->sanitize('sanitize_select', 'latitude, longitude'));
    }

    public function test_sanitize_select_drops_unknown_column(): void
    {
        $this->assertSame('latitude', $this->sanitize('sanitize_select', 'latitude, evil_col'));
    }

    public function test_sanitize_select_falls_back_to_star_when_all_invalid(): void
    {
        $this->assertSame('*', $this->sanitize('sanitize_select', '1 UNION SELECT user_pass FROM wp_users'));
    }

    // sanitize_identifier

    public function test_sanitize_identifier_returns_valid_column(): void
    {
        $this->assertSame('feed_name', $this->sanitize('sanitize_identifier', 'feed_name'));
    }

    public function test_sanitize_identifier_trims_whitespace(): void
    {
        $this->assertSame('time', $this->sanitize('sanitize_identifier', '  time  '));
    }

    public function test_sanitize_identifier_returns_null_for_unknown(): void
    {
        $this->assertNull($this->sanitize('sanitize_identifier', 'wp_users'));
    }

    public function test_sanitize_identifier_returns_null_for_injection_attempt(): void
    {
        $this->assertNull($this->sanitize('sanitize_identifier', "feed_name; DROP TABLE wp_spotmap_points"));
    }

    public function test_sanitize_identifier_returns_null_for_empty_string(): void
    {
        $this->assertNull($this->sanitize('sanitize_identifier', ''));
    }

    // sanitize_order

    public function test_sanitize_order_single_column_no_direction(): void
    {
        $this->assertSame('ORDER BY time', $this->sanitize('sanitize_order', 'time'));
    }

    public function test_sanitize_order_single_column_desc(): void
    {
        $this->assertSame('ORDER BY time DESC', $this->sanitize('sanitize_order', 'time DESC'));
    }

    public function test_sanitize_order_single_column_asc(): void
    {
        $this->assertSame('ORDER BY time ASC', $this->sanitize('sanitize_order', 'time ASC'));
    }

    public function test_sanitize_order_multiple_columns(): void
    {
        $this->assertSame('ORDER BY feed_name, time', $this->sanitize('sanitize_order', 'feed_name, time'));
    }

    public function test_sanitize_order_multiple_columns_with_directions(): void
    {
        $this->assertSame('ORDER BY feed_name ASC, time DESC', $this->sanitize('sanitize_order', 'feed_name ASC, time DESC'));
    }

    public function test_sanitize_order_drops_unknown_column(): void
    {
        $this->assertSame('ORDER BY time DESC', $this->sanitize('sanitize_order', 'time DESC, evil_col ASC'));
    }

    public function test_sanitize_order_returns_empty_string_for_injection(): void
    {
        $this->assertSame('', $this->sanitize('sanitize_order', "1; DROP TABLE wp_users"));
    }

    public function test_sanitize_order_returns_empty_string_when_all_invalid(): void
    {
        $this->assertSame('', $this->sanitize('sanitize_order', 'not_a_col, also_bad'));
    }

    // get_points: injection resistance (integration)

    public function test_get_points_select_injection_is_sanitized_and_query_succeeds(): void
    {
        self::$db->insert_point($this->make_point([ 'feedName' => 'sanitize-test', 'unixTime' => 1700900001 ]));

        $points = self::$db->get_points([
            'feeds'  => [ 'sanitize-test' ],
            'select' => '1 UNION SELECT user_pass,2,3 FROM wp_users-- ',
        ]);

        // Injection stripped → falls back to SELECT * → returns normal point objects
        $this->assertIsArray($points);
        $this->assertArrayNotHasKey('error', $points);
        $this->assertSame('sanitize-test', $points[0]->feed_name);
    }

    public function test_get_points_limit_injection_is_treated_as_integer(): void
    {
        // Space > 10 min apart so deduplication does not skip any insert.
        self::$db->insert_point($this->make_point([ 'feedName' => 'limit-test', 'unixTime' => 1700900010 ]));
        self::$db->insert_point($this->make_point([ 'feedName' => 'limit-test', 'unixTime' => 1700900010 + 601 ]));
        self::$db->insert_point($this->make_point([ 'feedName' => 'limit-test', 'unixTime' => 1700900010 + 1202 ]));

        $points = self::$db->get_points([
            'feeds' => [ 'limit-test' ],
            'limit' => '2; DROP TABLE wp_spotmap_points',
        ]);

        // absint('2; DROP...') === 2
        $this->assertCount(2, $points);
    }

    public function test_get_points_orderby_injection_is_ignored(): void
    {
        self::$db->insert_point($this->make_point([ 'feedName' => 'order-test', 'unixTime' => 1700900020 ]));

        $points = self::$db->get_points([
            'feeds'   => [ 'order-test' ],
            'orderBy' => "id; DROP TABLE wp_spotmap_points-- ",
        ]);

        $this->assertIsArray($points);
        $this->assertArrayNotHasKey('error', $points);
    }

    public function test_get_points_groupby_injection_is_ignored(): void
    {
        self::$db->insert_point($this->make_point([ 'feedName' => 'group-test', 'unixTime' => 1700900030 ]));

        $points = self::$db->get_points([
            'feeds'   => [ 'group-test' ],
            'groupBy' => "feed_name; DROP TABLE wp_spotmap_points",
        ]);

        $this->assertIsArray($points);
        $this->assertArrayNotHasKey('error', $points);
    }


    // --- does_media_exist / delete_media_point ---

    public function test_does_media_exist_returns_true_after_insert(): void
    {
        self::$db->insert_point($this->make_point([ 'modelId' => '42', 'unixTime' => 1700000070 ]));

        $this->assertTrue(self::$db->does_media_exist(42));
    }

    public function test_does_media_exist_returns_false_for_nonexistent(): void
    {
        $this->assertFalse(self::$db->does_media_exist(999888));
    }

    public function test_delete_media_point_removes_matching_points(): void
    {
        self::$db->insert_point($this->make_point([ 'modelId' => '77', 'unixTime' => 1700000080 ]));
        self::$db->insert_point($this->make_point([ 'modelId' => '77', 'unixTime' => 1700000081 ]));

        $result = self::$db->delete_media_point(77);

        $this->assertTrue($result);
        $this->assertFalse(self::$db->does_media_exist(77));
    }

    public function test_delete_media_point_returns_false_when_nothing_to_delete(): void
    {
        $this->assertFalse(self::$db->delete_media_point(999888));
    }

    // --- stationary deduplication ---

    /**
     * Arrival point (first in feed) must always be stored.
     */
    public function test_stationary_dedup_first_point_is_always_stored(): void
    {
        $result = self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-feed',
            'unixTime' => 1710000000,
            'latitude' => 47.3769,
            'longitude' => 8.5417,
        ]));

        $this->assertSame(1, $result);
    }

    /**
     * A second point within 25 m and < 10 min later must be skipped (return 0)
     * and the stored row updated with the new position (rolling anchor).
     */
    public function test_stationary_dedup_skips_nearby_point_within_10_min(): void
    {
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-near',
            'unixTime' => 1710000000,
            'latitude' => 47.376900,
            'longitude' => 8.541700,
        ]));

        // ~5 m away, 5 min later — should be skipped but anchor rolled forward.
        $result = self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-near',
            'unixTime' => 1710000300,
            'latitude' => 47.376940,  // ~4 m north
            'longitude' => 8.541700,
        ]));

        $this->assertSame(0, $result);

        // The stored row must now reflect the newer position, not the original one.
        global $wpdb;
        $row = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-near' LIMIT 1");
        $this->assertEqualsWithDelta(47.376940, (float) $row->latitude, 0.00001);
        $this->assertSame(1710000300, (int) $row->time);
    }

    /**
     * A second point > 10 min later (even if close) must be stored — device may have
     * moved away and returned, or the gap itself is meaningful.
     */
    public function test_stationary_dedup_stores_point_after_10_min_gap(): void
    {
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-time',
            'unixTime' => 1710000000,
            'latitude' => 47.3769,
            'longitude' => 8.5417,
        ]));

        // Same spot but 11 min later.
        $result = self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-time',
            'unixTime' => 1710000000 + 660,
            'latitude' => 47.3769,
            'longitude' => 8.5417,
        ]));

        $this->assertSame(1, $result);
    }

    /**
     * A point > 25 m away must be stored regardless of time gap.
     */
    public function test_stationary_dedup_stores_point_that_moved_beyond_25m(): void
    {
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-move',
            'unixTime' => 1710000000,
            'latitude' => 47.376900,
            'longitude' => 8.541700,
        ]));

        // ~30 m north, 2 min later.
        $result = self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-move',
            'unixTime' => 1710000120,
            'latitude' => 47.377170,  // ~30 m north
            'longitude' => 8.541700,
        ]));

        $this->assertSame(1, $result);
    }

    /**
     * Deduplication is per feed_name: a nearby point on a *different* feed
     * must not be suppressed.
     */
    public function test_stationary_dedup_does_not_affect_different_feed(): void
    {
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-feed-a',
            'unixTime' => 1710000000,
            'latitude' => 47.3769,
            'longitude' => 8.5417,
        ]));

        // Different feed, same location, within 10 min — must be stored.
        $result = self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-feed-b',
            'unixTime' => 1710000060,
            'latitude' => 47.3769,
            'longitude' => 8.5417,
        ]));

        $this->assertSame(1, $result);
    }

    /**
     * Three consecutive close pings result in exactly one DB row whose
     * coordinates reflect the LAST ping (rolling anchor).
     */
    public function test_stationary_dedup_rolls_anchor_through_chain(): void
    {
        global $wpdb;

        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-chain',
            'unixTime' => 1710000000,
            'latitude' => 47.376900,
            'longitude' => 8.541700,
        ]));
        // 2nd ping: ~4 m, 1 min — within thresholds.
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-chain',
            'unixTime' => 1710000060,
            'latitude' => 47.376940,
            'longitude' => 8.541700,
        ]));
        // 3rd ping: ~4 m further, 1 min — still within thresholds of the rolled anchor.
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-chain',
            'unixTime' => 1710000120,
            'latitude' => 47.376980,
            'longitude' => 8.541700,
        ]));

        $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-chain'");
        $this->assertSame(1, $count, 'Only one row should exist after three close pings.');

        $row = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-chain' LIMIT 1");
        $this->assertEqualsWithDelta(47.376980, (float) $row->latitude, 0.00001, 'Anchor should be at the last ping latitude.');
        $this->assertSame(1710000120, (int) $row->time);
    }

    /**
     * When a ping exceeds the time threshold the pending row is committed and
     * the new ping is inserted as a fresh row.
     *
     * Mirrors the user example:
     *   P1 (anchor) → several close pings roll the anchor → P_n arrives > 600 s
     *   after the current anchor → anchor is kept, P_n is a new row.
     */
    public function test_stationary_dedup_commits_anchor_on_time_breach(): void
    {
        global $wpdb;

        // P1: anchor.
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-commit',
            'unixTime' => 1710000000,
            'latitude' => 47.376900,
            'longitude' => 8.541700,
        ]));
        // P2–P4: close pings that roll the anchor forward.
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-commit',
            'unixTime' => 1710000060,
            'latitude' => 47.376940,
            'longitude' => 8.541700,
        ]));
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-commit',
            'unixTime' => 1710000120,
            'latitude' => 47.376980,
            'longitude' => 8.541700,
        ]));
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-commit',
            'unixTime' => 1710000590,  // 470 s since P3 — still within 600 s threshold.
            'latitude' => 47.377010,
            'longitude' => 8.541700,
        ]));

        // P5: arrives 610 s after the current anchor (P4) — exceeds time threshold.
        $result = self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-commit',
            'unixTime' => 1710000590 + 610,
            'latitude' => 47.377050,
            'longitude' => 8.541700,
        ]));

        $this->assertSame(1, $result, 'P5 should be inserted as a new row.');

        $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-commit'");
        $this->assertSame(2, $count, 'Two rows: the committed anchor and P5.');

        // The first (older) row must carry P4\'s coordinates (the last rolled anchor).
        $first = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-commit' ORDER BY time ASC LIMIT 1");
        $this->assertEqualsWithDelta(47.377010, (float) $first->latitude, 0.00001, 'First row should be the last rolled-anchor position.');
        $this->assertSame(1710000590, (int) $first->time);
    }

    /**
     * Each suppressed ping increments hidden_points on the anchor row.
     */
    public function test_stationary_dedup_increments_hidden_points(): void
    {
        global $wpdb;

        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-hidden',
            'unixTime' => 1710000000,
            'latitude' => 47.376900,
            'longitude' => 8.541700,
        ]));
        // 3 suppressed pings within thresholds.
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-hidden',
            'unixTime' => 1710000060,
            'latitude' => 47.376920,
            'longitude' => 8.541700,
        ]));
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-hidden',
            'unixTime' => 1710000120,
            'latitude' => 47.376940,
            'longitude' => 8.541700,
        ]));
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-hidden',
            'unixTime' => 1710000180,
            'latitude' => 47.376960,
            'longitude' => 8.541700,
        ]));

        $row = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-hidden' LIMIT 1");
        $this->assertSame(3, (int) $row->hidden_points, 'hidden_points should equal the number of suppressed pings.');
    }

    /**
     * After the anchor is committed (time threshold exceeded), the new row
     * starts with hidden_points = 0.
     */
    public function test_stationary_dedup_new_row_resets_hidden_points(): void
    {
        global $wpdb;

        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-hidden-reset',
            'unixTime' => 1710000000,
            'latitude' => 47.376900,
            'longitude' => 8.541700,
        ]));
        // One suppressed ping.
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-hidden-reset',
            'unixTime' => 1710000060,
            'latitude' => 47.376920,
            'longitude' => 8.541700,
        ]));
        // New point beyond time threshold — committed as a new row.
        self::$db->insert_point($this->make_track_point([
            'feedName' => 'dedup-hidden-reset',
            'unixTime' => 1710000060 + 700,
            'latitude' => 47.376940,
            'longitude' => 8.541700,
        ]));

        $rows = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-hidden-reset' ORDER BY time ASC");
        $this->assertCount(2, $rows);
        $this->assertSame(1, (int) $rows[0]->hidden_points, 'First row should have hidden_points = 1.');
        $this->assertSame(0, (int) $rows[1]->hidden_points, 'Second row should start with hidden_points = 0.');
    }

    /**
     * A TRACK ping arriving shortly after a CUSTOM event at the same location must
     * be inserted as a new row, not rolled into the CUSTOM row.
     *
     * Before the fix, get_last_point_for_feed() returned the last row of any type.
     * A TRACK ping within thresholds would then UPDATE the CUSTOM row, corrupting it
     * (type stays CUSTOM but lat/lon/time are overwritten, hidden_points grows).
     */
    public function test_stationary_dedup_does_not_update_non_track_row(): void
    {
        global $wpdb;

        // CUSTOM event stored first (e.g. user sends a message).
        self::$db->insert_point($this->make_point([
            'messageType' => 'CUSTOM',
            'feedName'    => 'dedup-cross-type',
            'unixTime'    => 1710000000,
            'latitude'    => 47.376900,
            'longitude'   => 8.541700,
        ]));

        // TRACK ping 5 min later at the same spot — must NOT update the CUSTOM row.
        $result = self::$db->insert_point($this->make_track_point([
            'feedName'  => 'dedup-cross-type',
            'unixTime'  => 1710000300,
            'latitude'  => 47.376900,
            'longitude' => 8.541700,
        ]));

        $this->assertSame(1, $result, 'TRACK ping after CUSTOM event must be inserted as a new row.');

        $rows = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}spotmap_points WHERE feed_name = 'dedup-cross-type' ORDER BY id ASC"
        );
        $this->assertCount(2, $rows, 'Both CUSTOM and TRACK rows must exist.');
        $this->assertSame('CUSTOM', $rows[0]->type, 'First row must remain CUSTOM.');
        $this->assertSame(0, (int) $rows[0]->hidden_points, 'CUSTOM row must not accumulate hidden_points from TRACK pings.');
        $this->assertSame('TRACK', $rows[1]->type, 'Second row must be the new TRACK row.');
    }
}
