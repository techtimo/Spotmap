<?php

// Database credentials matching wp-env defaults (used inside the Docker container).
define( 'DB_NAME', 'wordpress_test' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', 'password' );
define( 'DB_HOST', 'mysql' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

define( 'WP_TESTS_DOMAIN', 'localhost' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Spotmap Tests' );
define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );

define( 'ABSPATH', '/var/www/html/' );
