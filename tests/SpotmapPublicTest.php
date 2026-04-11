<?php

class SpotmapPublicTest extends WP_Ajax_UnitTestCase
{
    private static Spotmap_Public $public;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        require_once dirname(__DIR__) . '/public/class-spotmap-public.php';
        require_once dirname(__DIR__) . '/admin/class-spotmap-admin.php';
        self::$public = new Spotmap_Public();
    }

    protected function setUp(): void
    {
        parent::setUp();
    }

    // --- get_positions (AJAX handler) ---

    /**
     * Capture the JSON sent by wp_send_json before it calls wp_die.
     *
     * WP_Ajax_UnitTestCase's dieHandler calls ob_get_clean() and stores output
     * in $this->_last_response, then throws WPAjaxDieContinueException.
     */
    private function capture_positions(): array
    {
        $this->_last_response = '';
        ob_start();
        try {
            self::$public->get_positions();
        } catch (\WPDieException $e) {
            // dieHandler already cleaned the buffer into $this->_last_response.
        }
        return json_decode($this->_last_response, true) ?? [];
    }

    public function test_get_positions_returns_empty_when_no_feeds_in_post(): void
    {
        $_POST = [];

        $data = $this->capture_positions();

        $this->assertFalse($data['error']);
        $this->assertTrue($data['empty']);
    }

    public function test_get_positions_returns_error_for_unknown_feed(): void
    {
        $_POST = [ 'feeds' => [ 'nonexistent-feed' ] ];

        $data = $this->capture_positions();

        $this->assertTrue($data['error']);
    }

    public function test_get_positions_returns_points_for_known_feed(): void
    {
        // Insert a point so the feed exists in the DB.
        $db = new Spotmap_Database();
        $db->insert_point([
            'feedName'       => 'ajax-test-feed',
            'feedId'         => 'fid-ajax',
            'messageType'    => 'OK',
            'unixTime'       => 1700002000,
            'latitude'       => 47.0,
            'longitude'      => 8.0,
            'modelId'        => 'SPOT-X',
            'messengerName'  => 'Device',
            'messageContent' => '',
        ]);

        $_POST = [ 'feeds' => [ 'ajax-test-feed' ] ];

        $data = $this->capture_positions();

        $this->assertIsArray($data);
        $this->assertNotEmpty($data);
    }
}
