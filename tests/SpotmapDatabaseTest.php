<?php

class SpotmapDatabaseTest extends WP_UnitTestCase {

	private static Spotmap_Database $db;

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		require_once dirname( __DIR__ ) . '/includes/class-spotmap-database.php';
		self::$db = new Spotmap_Database();
	}

	/**
	 * Builds a valid point array with sensible defaults. Override any key via $overrides.
	 */
	private function make_point( array $overrides = [] ): array {
		return array_merge( [
			'feedName'       => 'test-feed',
			'feedId'         => 'feed-001',
			'messageType'    => 'OK',
			'unixTime'       => 1700000000,
			'latitude'       => 47.3769,
			'longitude'      => 8.5417,
			'modelId'        => 'SPOT-X',
			'messengerName'  => 'Test Device',
			'messageContent' => '',
		], $overrides );
	}

	// --- insert_point ---

	public function test_insert_point_returns_success(): void {
		$result = self::$db->insert_point( $this->make_point() );
		$this->assertSame( 1, $result );
	}

	public function test_insert_point_with_unixtime_1_is_ignored(): void {
		$result = self::$db->insert_point( $this->make_point( [ 'unixTime' => 1 ] ) );
		$this->assertSame( 0, $result );
	}

	public function test_insert_point_stores_correct_values(): void {
		self::$db->insert_point( $this->make_point( [
			'feedName'    => 'alpine-route',
			'messageType' => 'HELP',
			'latitude'    => 46.9481,
			'longitude'   => 7.4474,
		] ) );

		global $wpdb;
		$row = $wpdb->get_row( "SELECT * FROM {$wpdb->prefix}spotmap_points ORDER BY id DESC LIMIT 1" );

		$this->assertSame( 'alpine-route', $row->feed_name );
		$this->assertSame( 'HELP', $row->type );
		$this->assertEqualsWithDelta( 46.9481, (float) $row->latitude, 0.0001 );
		$this->assertEqualsWithDelta( 7.4474, (float) $row->longitude, 0.0001 );
	}

	// --- get_all_feednames ---

	public function test_get_all_feednames_returns_inserted_feeds(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'feed-a' ] ) );
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'feed-b' ] ) );

		$names = self::$db->get_all_feednames();

		$this->assertContains( 'feed-a', $names );
		$this->assertContains( 'feed-b', $names );
	}

	public function test_get_all_feednames_deduplicates(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'solo-feed', 'unixTime' => 1700000001 ] ) );
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'solo-feed', 'unixTime' => 1700000002 ] ) );

		$names = self::$db->get_all_feednames();

		$this->assertSame( 1, count( array_keys( $names, 'solo-feed' ) ) );
	}

	// --- get_last_point ---

	public function test_get_last_point_returns_most_recently_inserted(): void {
		self::$db->insert_point( $this->make_point( [ 'unixTime' => 1700000001 ] ) );
		self::$db->insert_point( $this->make_point( [ 'unixTime' => 1700000002 ] ) );

		$last = self::$db->get_last_point();

		$this->assertSame( '1700000002', $last->time );
	}

	// --- does_point_exist ---

	public function test_does_point_exist_returns_true_after_insert(): void {
		self::$db->insert_point( $this->make_point() );

		global $wpdb;
		$id = $wpdb->insert_id;

		$this->assertTrue( self::$db->does_point_exist( $id ) );
	}

	public function test_does_point_exist_returns_false_for_nonexistent_id(): void {
		$this->assertFalse( self::$db->does_point_exist( 999999 ) );
	}

	// --- get_points ---

	public function test_get_points_filters_by_feed(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'feed-x', 'unixTime' => 1700000010 ] ) );
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'feed-y', 'unixTime' => 1700000011 ] ) );

		$points = self::$db->get_points( [ 'feeds' => [ 'feed-x' ] ] );

		$this->assertCount( 1, $points );
		$this->assertSame( 'feed-x', $points[0]->feed_name );
	}

	public function test_get_points_filters_by_type(): void {
		self::$db->insert_point( $this->make_point( [ 'messageType' => 'OK',   'unixTime' => 1700000020 ] ) );
		self::$db->insert_point( $this->make_point( [ 'messageType' => 'HELP', 'unixTime' => 1700000021 ] ) );

		$points = self::$db->get_points( [ 'type' => [ 'HELP' ] ] );

		$this->assertCount( 1, $points );
		$this->assertSame( 'HELP', $points[0]->type );
	}

	public function test_get_points_respects_limit(): void {
		for ( $i = 0; $i < 5; $i++ ) {
			self::$db->insert_point( $this->make_point( [ 'unixTime' => 1700000030 + $i ] ) );
		}

		$points = self::$db->get_points( [ 'limit' => 3 ] );

		$this->assertCount( 3, $points );
	}

	public function test_get_points_returns_error_for_unknown_feed(): void {
		$result = self::$db->get_points( [ 'feeds' => [ 'nonexistent-feed' ] ] );

		$this->assertIsArray( $result );
		$this->assertTrue( $result['error'] );
	}

	// --- rename_feed_name ---

	public function test_rename_feed_name_updates_all_points(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'old-name', 'unixTime' => 1700000040 ] ) );
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'old-name', 'unixTime' => 1700000041 ] ) );

		self::$db->rename_feed_name( 'old-name', 'new-name' );

		$this->assertNotContains( 'old-name', self::$db->get_all_feednames() );
		$this->assertContains( 'new-name', self::$db->get_all_feednames() );
	}

	// --- get_all_types ---

	public function test_get_all_types_returns_inserted_types(): void {
		self::$db->insert_point( $this->make_point( [ 'messageType' => 'OK',   'unixTime' => 1700000050 ] ) );
		self::$db->insert_point( $this->make_point( [ 'messageType' => 'HELP', 'unixTime' => 1700000051 ] ) );

		$types = self::$db->get_all_types();

		$this->assertContains( 'OK',   $types );
		$this->assertContains( 'HELP', $types );
	}

	public function test_get_all_types_deduplicates(): void {
		self::$db->insert_point( $this->make_point( [ 'messageType' => 'CUSTOM', 'unixTime' => 1700000060 ] ) );
		self::$db->insert_point( $this->make_point( [ 'messageType' => 'CUSTOM', 'unixTime' => 1700000061 ] ) );

		$types = self::$db->get_all_types();

		$this->assertSame( 1, count( array_keys( $types, 'CUSTOM' ) ) );
	}

	// --- sanitize helpers (private static, accessed via reflection) ---

	private function sanitize( string $method, mixed ...$args ): mixed {
		$ref = new ReflectionMethod( Spotmap_Database::class, $method );
		$ref->setAccessible( true );
		return $ref->invoke( null, ...$args );
	}

	// sanitize_select

	public function test_sanitize_select_passes_star(): void {
		$this->assertSame( '*', $this->sanitize( 'sanitize_select', '*' ) );
	}

	public function test_sanitize_select_allows_valid_column(): void {
		$this->assertSame( 'latitude', $this->sanitize( 'sanitize_select', 'latitude' ) );
	}

	public function test_sanitize_select_allows_multiple_valid_columns(): void {
		$this->assertSame( 'latitude, longitude', $this->sanitize( 'sanitize_select', 'latitude, longitude' ) );
	}

	public function test_sanitize_select_drops_unknown_column(): void {
		$this->assertSame( 'latitude', $this->sanitize( 'sanitize_select', 'latitude, evil_col' ) );
	}

	public function test_sanitize_select_falls_back_to_star_when_all_invalid(): void {
		$this->assertSame( '*', $this->sanitize( 'sanitize_select', '1 UNION SELECT user_pass FROM wp_users' ) );
	}

	// sanitize_identifier

	public function test_sanitize_identifier_returns_valid_column(): void {
		$this->assertSame( 'feed_name', $this->sanitize( 'sanitize_identifier', 'feed_name' ) );
	}

	public function test_sanitize_identifier_trims_whitespace(): void {
		$this->assertSame( 'time', $this->sanitize( 'sanitize_identifier', '  time  ' ) );
	}

	public function test_sanitize_identifier_returns_null_for_unknown(): void {
		$this->assertNull( $this->sanitize( 'sanitize_identifier', 'wp_users' ) );
	}

	public function test_sanitize_identifier_returns_null_for_injection_attempt(): void {
		$this->assertNull( $this->sanitize( 'sanitize_identifier', "feed_name; DROP TABLE wp_spotmap_points" ) );
	}

	public function test_sanitize_identifier_returns_null_for_empty_string(): void {
		$this->assertNull( $this->sanitize( 'sanitize_identifier', '' ) );
	}

	// sanitize_order

	public function test_sanitize_order_single_column_no_direction(): void {
		$this->assertSame( 'ORDER BY time', $this->sanitize( 'sanitize_order', 'time' ) );
	}

	public function test_sanitize_order_single_column_desc(): void {
		$this->assertSame( 'ORDER BY time DESC', $this->sanitize( 'sanitize_order', 'time DESC' ) );
	}

	public function test_sanitize_order_single_column_asc(): void {
		$this->assertSame( 'ORDER BY time ASC', $this->sanitize( 'sanitize_order', 'time ASC' ) );
	}

	public function test_sanitize_order_multiple_columns(): void {
		$this->assertSame( 'ORDER BY feed_name, time', $this->sanitize( 'sanitize_order', 'feed_name, time' ) );
	}

	public function test_sanitize_order_multiple_columns_with_directions(): void {
		$this->assertSame( 'ORDER BY feed_name ASC, time DESC', $this->sanitize( 'sanitize_order', 'feed_name ASC, time DESC' ) );
	}

	public function test_sanitize_order_drops_unknown_column(): void {
		$this->assertSame( 'ORDER BY time DESC', $this->sanitize( 'sanitize_order', 'time DESC, evil_col ASC' ) );
	}

	public function test_sanitize_order_returns_empty_string_for_injection(): void {
		$this->assertSame( '', $this->sanitize( 'sanitize_order', "1; DROP TABLE wp_users" ) );
	}

	public function test_sanitize_order_returns_empty_string_when_all_invalid(): void {
		$this->assertSame( '', $this->sanitize( 'sanitize_order', 'not_a_col, also_bad' ) );
	}

	// get_points: injection resistance (integration)

	public function test_get_points_select_injection_is_sanitized_and_query_succeeds(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'sanitize-test', 'unixTime' => 1700900001 ] ) );

		$points = self::$db->get_points( [
			'feeds'  => [ 'sanitize-test' ],
			'select' => '1 UNION SELECT user_pass,2,3 FROM wp_users-- ',
		] );

		// Injection stripped → falls back to SELECT * → returns normal point objects
		$this->assertIsArray( $points );
		$this->assertArrayNotHasKey( 'error', $points );
		$this->assertSame( 'sanitize-test', $points[0]->feed_name );
	}

	public function test_get_points_limit_injection_is_treated_as_integer(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'limit-test', 'unixTime' => 1700900010 ] ) );
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'limit-test', 'unixTime' => 1700900011 ] ) );
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'limit-test', 'unixTime' => 1700900012 ] ) );

		$points = self::$db->get_points( [
			'feeds' => [ 'limit-test' ],
			'limit' => '2; DROP TABLE wp_spotmap_points',
		] );

		// absint('2; DROP...') === 2
		$this->assertCount( 2, $points );
	}

	public function test_get_points_orderby_injection_is_ignored(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'order-test', 'unixTime' => 1700900020 ] ) );

		$points = self::$db->get_points( [
			'feeds'   => [ 'order-test' ],
			'orderBy' => "id; DROP TABLE wp_spotmap_points-- ",
		] );

		$this->assertIsArray( $points );
		$this->assertArrayNotHasKey( 'error', $points );
	}

	public function test_get_points_groupby_injection_is_ignored(): void {
		self::$db->insert_point( $this->make_point( [ 'feedName' => 'group-test', 'unixTime' => 1700900030 ] ) );

		$points = self::$db->get_points( [
			'feeds'   => [ 'group-test' ],
			'groupBy' => "feed_name; DROP TABLE wp_spotmap_points",
		] );

		$this->assertIsArray( $points );
		$this->assertArrayNotHasKey( 'error', $points );
	}

	// --- does_media_exist / delete_media_point ---

	public function test_does_media_exist_returns_true_after_insert(): void {
		self::$db->insert_point( $this->make_point( [ 'modelId' => '42', 'unixTime' => 1700000070 ] ) );

		$this->assertTrue( self::$db->does_media_exist( 42 ) );
	}

	public function test_does_media_exist_returns_false_for_nonexistent(): void {
		$this->assertFalse( self::$db->does_media_exist( 999888 ) );
	}

	public function test_delete_media_point_removes_matching_points(): void {
		self::$db->insert_point( $this->make_point( [ 'modelId' => '77', 'unixTime' => 1700000080 ] ) );
		self::$db->insert_point( $this->make_point( [ 'modelId' => '77', 'unixTime' => 1700000081 ] ) );

		$result = self::$db->delete_media_point( 77 );

		$this->assertTrue( $result );
		$this->assertFalse( self::$db->does_media_exist( 77 ) );
	}

	public function test_delete_media_point_returns_false_when_nothing_to_delete(): void {
		$this->assertFalse( self::$db->delete_media_point( 999888 ) );
	}
}
