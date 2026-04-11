<?php

class SpotmapAdminTest extends WP_UnitTestCase
{
    private static Spotmap_Admin $admin;

    private static \ReflectionProperty $cache_prop;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        require_once dirname(__DIR__) . '/admin/class-spotmap-admin.php';
        self::$admin      = new Spotmap_Admin();
        self::$cache_prop = (new ReflectionClass(Spotmap_Options::class))->getProperty('cache');
    }

    protected function setUp(): void
    {
        parent::setUp();
        self::$cache_prop->setValue(null, []);
    }

    // --- add_cron_schedule ---

    public function test_add_cron_schedule_adds_twohalf_min(): void
    {
        $result = self::$admin->add_cron_schedule([]);
        $this->assertArrayHasKey('twohalf_min', $result);
    }

    public function test_add_cron_schedule_interval_is_150_seconds(): void
    {
        $result = self::$admin->add_cron_schedule([]);
        $this->assertSame(150, $result['twohalf_min']['interval']);
    }

    public function test_add_cron_schedule_preserves_existing_schedules(): void
    {
        $existing = [ 'hourly' => [ 'interval' => 3600, 'display' => 'Once Hourly' ] ];
        $result   = self::$admin->add_cron_schedule($existing);
        $this->assertArrayHasKey('hourly', $result);
    }

    // --- allow_gpx_upload ---

    public function test_allow_gpx_upload_adds_gpx_mime_type(): void
    {
        $result = self::$admin->allow_gpx_upload([]);
        $this->assertArrayHasKey('gpx', $result);
        $this->assertSame('text/xml', $result['gpx']);
    }

    public function test_allow_gpx_upload_preserves_existing_types(): void
    {
        $existing = [ 'jpg' => 'image/jpeg' ];
        $result   = self::$admin->allow_gpx_upload($existing);
        $this->assertArrayHasKey('jpg', $result);
    }

    // --- add_link_plugin_overview ---

    public function test_add_link_plugin_overview_adds_settings_link(): void
    {
        $links = self::$admin->add_link_plugin_overview([]);
        $combined = implode(' ', $links);
        $this->assertStringContainsString('Settings', $combined);
    }

    public function test_add_link_plugin_overview_adds_support_link(): void
    {
        $links = self::$admin->add_link_plugin_overview([]);
        $combined = implode(' ', $links);
        $this->assertStringContainsString('Get Support', $combined);
    }

    // --- get_overlays ---

    public function test_get_overlays_returns_array(): void
    {
        $overlays = self::$admin->get_overlays();
        $this->assertIsArray($overlays);
    }

    // --- get_maps ---

    public function test_get_maps_returns_array(): void
    {
        $maps = self::$admin->get_maps();
        $this->assertIsArray($maps);
    }

    public function test_get_maps_always_includes_openstreetmap(): void
    {
        $maps = self::$admin->get_maps();
        $this->assertArrayHasKey('openstreetmap', $maps);
    }

    public function test_get_maps_excludes_maps_requiring_missing_token(): void
    {
        // Ensure mapbox token is not set.
        update_option(Spotmap_Options::OPTION_API_TOKENS, [ 'mapbox' => '' ]);

        $maps = self::$admin->get_maps();

        // No map should reference a mapboxToken placeholder anymore.
        foreach ($maps as $map) {
            $this->assertFalse(
                isset($map['options']['mapboxToken']) && $map['options']['mapboxToken'] === '',
                'Map with empty mapboxToken must be excluded'
            );
        }
    }

    public function test_get_maps_injects_token_when_set(): void
    {
        update_option(Spotmap_Options::OPTION_API_TOKENS, [ 'mapbox' => 'pk.test123' ]);

        $maps = self::$admin->get_maps();

        $mapbox_maps = array_filter($maps, fn ($m) => isset($m['options']['mapboxToken']));
        foreach ($mapbox_maps as $map) {
            $this->assertSame('pk.test123', $map['options']['mapboxToken']);
        }
    }

}
