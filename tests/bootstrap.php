<?php

putenv('WP_PHPUNIT__TESTS_CONFIG=' . __DIR__ . '/wp-tests-config.php');

define('WP_TESTS_PHPUNIT_POLYFILLS_PATH', dirname(__DIR__) . '/vendor/yoast/phpunit-polyfills');

require_once dirname(__DIR__) . '/vendor/wp-phpunit/wp-phpunit/includes/bootstrap.php';

require_once dirname(__DIR__) . '/vendor-prefixed/autoload.php';
require_once dirname(__DIR__) . '/includes/class-spotmap-options.php';
require_once dirname(__DIR__) . '/includes/class-spotmap-providers.php';
require_once dirname(__DIR__) . '/includes/class-spotmap-migrator.php';
require_once dirname(__DIR__) . '/includes/class-spotmap-database.php';
require_once dirname(__DIR__) . '/includes/class-spotmap-rest-api.php';
require_once dirname(__DIR__) . '/includes/class-spotmap-ingest.php';

// Matches the constant defined in spotmap.php — needed by Spotmap_Migrator::run().
define('SPOTMAP_VERSION', '1.0.0-rc.2');

// Recreate the plugin table from the authoritative schema before all tests.
// DROP + CREATE ensures a stale schema from a previous run never causes column errors.
global $wpdb;
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spotmap_points");
Spotmap_Database::create_table();
