<?php

class SpotmapMigratorTest extends WP_UnitTestCase
{
    private static \ReflectionProperty $cache_prop;

    // -------------------------------------------------------------------------
    // Real feed IDs from a production 0.11.2 installation (33-char SPOT format).
    // -------------------------------------------------------------------------
    private const FEED_ID_TIMOALT   = '0XXu6oxljOfKDqPG1iefyeK4Q2lbal1Sz';
    private const FEED_ID_ELIA      = '07bNOnYeUGdYIqFy0b8Bd3uiFVjqgnzTk';
    private const FEED_ID_TIMO_LISA = '0fXV0BPboRvq36mrop3ZEMoeiasEk4Hgm';

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        self::$cache_prop = (new ReflectionClass(Spotmap_Options::class))->getProperty('cache');
    }

    protected function setUp(): void
    {
        parent::setUp();
        delete_option('spotmap_version');
        delete_option('spotmap_feeds');
        delete_option('spotmap_findmespot_name');
        delete_option('spotmap_findmespot_id');
        delete_option('spotmap_findmespot_password');
        delete_option('spotmap_api_providers');
        self::$cache_prop->setValue(null, []);
    }

    // -------------------------------------------------------------------------
    // Helpers — mirror exact production wp_options rows
    // -------------------------------------------------------------------------

    /**
     * Seeds the three feeds from the real 0.11.2 installation.
     * All feeds are public (empty password).
     */
    private function seed_real_production_data(): void
    {
        update_option('spotmap_findmespot_name', [ 'timoalt', 'Elia', 'timo&lisa' ]);
        update_option('spotmap_findmespot_id', [ self::FEED_ID_TIMOALT, self::FEED_ID_ELIA, self::FEED_ID_TIMO_LISA ]);
        update_option('spotmap_findmespot_password', [ '', '', '' ]);
        update_option('spotmap_api_providers', [ 'findmespot' => 'Spot Feed' ]);
    }

    /**
     * Seeds two feeds, one with a password.
     */
    private function seed_two_feeds_one_with_password(): void
    {
        update_option('spotmap_findmespot_name', [ 'timoalt', 'Elia' ]);
        update_option('spotmap_findmespot_id', [ self::FEED_ID_TIMOALT, self::FEED_ID_ELIA ]);
        update_option('spotmap_findmespot_password', [ '', 'secret123' ]);
        update_option('spotmap_api_providers', [ 'findmespot' => 'Spot Feed' ]);
    }

    // -------------------------------------------------------------------------
    // Core migration: real production data
    // -------------------------------------------------------------------------

    public function test_migration_creates_spotmap_feeds_option(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();

        $this->assertNotFalse(get_option('spotmap_feeds'));
    }

    public function test_migration_converts_three_feeds(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $this->assertCount(3, Spotmap_Options::get_feeds());
    }

    public function test_migration_preserves_all_feed_names(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $names = array_column(Spotmap_Options::get_feeds(), 'name');
        $this->assertContains('timoalt', $names);
        $this->assertContains('Elia', $names);
        $this->assertContains('timo&lisa', $names);
    }

    public function test_migration_preserves_all_feed_ids(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $feed_ids = array_column(Spotmap_Options::get_feeds(), 'feed_id');
        $this->assertContains(self::FEED_ID_TIMOALT, $feed_ids);
        $this->assertContains(self::FEED_ID_ELIA, $feed_ids);
        $this->assertContains(self::FEED_ID_TIMO_LISA, $feed_ids);
    }

    public function test_migration_preserves_ampersand_in_feed_name(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $names = array_column(Spotmap_Options::get_feeds(), 'name');
        // sanitize_text_field must not corrupt the ampersand.
        $this->assertContains('timo&lisa', $names);
    }

    public function test_migration_sets_provider_type_to_findmespot(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        foreach (Spotmap_Options::get_feeds() as $feed) {
            $this->assertSame('findmespot', $feed['type']);
        }
    }

    public function test_migration_assigns_unique_id_to_each_feed(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $ids = array_column(Spotmap_Options::get_feeds(), 'id');
        $this->assertCount(3, array_unique($ids), 'Every feed must get a distinct id');
    }

    public function test_migration_preserves_password(): void
    {
        $this->seed_two_feeds_one_with_password();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $feeds = Spotmap_Options::get_feeds();
        $elia  = null;
        foreach ($feeds as $f) {
            if ($f['feed_id'] === self::FEED_ID_ELIA) {
                $elia = $f;
                break;
            }
        }
        $this->assertNotNull($elia);
        $this->assertSame('secret123', $elia['password']);
    }

    public function test_migration_empty_password_stays_empty(): void
    {
        $this->seed_real_production_data();

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        foreach (Spotmap_Options::get_feeds() as $feed) {
            $this->assertSame('', $feed['password']);
        }
    }

    // -------------------------------------------------------------------------
    // Cleanup of legacy options
    // -------------------------------------------------------------------------

    public function test_migration_deletes_old_name_option(): void
    {
        $this->seed_real_production_data();
        Spotmap_Migrator::run();
        $this->assertFalse(get_option('spotmap_findmespot_name'));
    }

    public function test_migration_deletes_old_id_option(): void
    {
        $this->seed_real_production_data();
        Spotmap_Migrator::run();
        $this->assertFalse(get_option('spotmap_findmespot_id'));
    }

    public function test_migration_deletes_old_password_option(): void
    {
        $this->seed_real_production_data();
        Spotmap_Migrator::run();
        $this->assertFalse(get_option('spotmap_findmespot_password'));
    }

    public function test_migration_deletes_api_providers_option(): void
    {
        $this->seed_real_production_data();
        Spotmap_Migrator::run();
        $this->assertFalse(get_option('spotmap_api_providers'));
    }

    // -------------------------------------------------------------------------
    // Version tracking
    // -------------------------------------------------------------------------

    public function test_migration_writes_spotmap_version(): void
    {
        Spotmap_Migrator::run();
        $this->assertSame(SPOTMAP_VERSION, get_option('spotmap_version'));
    }

    public function test_run_is_noop_when_already_on_current_version(): void
    {
        update_option('spotmap_version', SPOTMAP_VERSION);
        update_option('spotmap_feeds', [ [ 'id' => 'existing', 'type' => 'findmespot', 'name' => 'timoalt', 'feed_id' => self::FEED_ID_TIMOALT, 'password' => '' ] ]);
        // Plant old options to prove they are NOT deleted on a no-op run.
        update_option('spotmap_findmespot_id', [ self::FEED_ID_TIMOALT ]);

        Spotmap_Migrator::run();

        $this->assertNotFalse(get_option('spotmap_findmespot_id'), 'Old option must survive a no-op run');
    }

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------

    public function test_migration_with_no_old_feeds_creates_empty_array(): void
    {
        update_option('spotmap_findmespot_name', []);
        update_option('spotmap_findmespot_id', []);
        update_option('spotmap_findmespot_password', []);
        update_option('spotmap_api_providers', [ 'findmespot' => 'Spot Feed' ]);

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $this->assertSame([], Spotmap_Options::get_feeds());
    }

    public function test_migration_skips_entries_with_empty_feed_id(): void
    {
        // Middle entry has no feed ID — simulates a partially deleted feed from 0.x.y.
        update_option('spotmap_findmespot_name', [ 'timoalt', 'broken', 'Elia' ]);
        update_option('spotmap_findmespot_id', [ self::FEED_ID_TIMOALT, '', self::FEED_ID_ELIA ]);
        update_option('spotmap_findmespot_password', [ '', '', '' ]);

        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $feeds = Spotmap_Options::get_feeds();
        $this->assertCount(2, $feeds, 'Entry with empty feed_id must be dropped');
        $feed_ids = array_column($feeds, 'feed_id');
        $this->assertNotContains('', $feed_ids);
    }

    public function test_migration_with_no_old_options_creates_empty_feeds(): void
    {
        // Plugin installed but never configured before being updated to 1.0.0.
        Spotmap_Migrator::run();
        self::$cache_prop->setValue(null, []);

        $feeds = get_option('spotmap_feeds');
        $this->assertIsArray($feeds);
        $this->assertCount(0, $feeds);
    }

    public function test_migration_with_no_old_options_still_writes_version(): void
    {
        Spotmap_Migrator::run();
        $this->assertSame(SPOTMAP_VERSION, get_option('spotmap_version'));
    }
}
