const { execSync } = require( 'child_process' );
const dotenv = require( 'dotenv' );
const fs = require( 'fs' );
const path = require( 'path' );

const run = ( cmd ) => {
	console.log( `> ${ cmd }` );
	try {
		execSync( cmd, { stdio: 'inherit' } );
	} catch ( e ) {
		console.warn( `Warning: "${ cmd }" exited with code ${ e.status }` );
	}
};

// The plugin directory is mounted at this path inside every wp-env container.
const CONTAINER_PLUGIN_PATH = '/var/www/html/wp-content/plugins/Spotmap';

// Temp PHP file written by Node.js and executed via wp eval-file.
const TEMP_PHP_LOCAL = path.resolve(
	__dirname,
	'..',
	'tests',
	'e2e',
	'.inject.php'
);
const TEMP_PHP_CONTAINER = `${ CONTAINER_PLUGIN_PATH }/tests/e2e/.inject.php`;

/**
 * Write PHP code to a temp file and execute it via wp eval-file.
 * Avoids all shell-quoting issues: Node.js writes the file directly,
 * and wp eval-file only receives a simple file path argument.
 */
const runPhp = ( php, env = 'cli' ) => {
	fs.writeFileSync( TEMP_PHP_LOCAL, `<?php\n${ php }\n` );
	try {
		run(
			`npx wp-env run ${ env } -- wp eval-file ${ TEMP_PHP_CONTAINER }`
		);
	} finally {
		if ( fs.existsSync( TEMP_PHP_LOCAL ) ) {
			fs.unlinkSync( TEMP_PHP_LOCAL );
		}
	}
};

/** Converts a plain JS object to a PHP associative array literal. */
const phpArray = ( obj ) => {
	const pairs = Object.entries( obj ).map(
		( [ k, v ] ) => `'${ k }' => '${ v }'`
	);
	return `[ ${ pairs.join( ', ' ) } ]`;
};

// ---------------------------------------------------------------------------
// Load tokens from .env (gitignored — never committed)
// ---------------------------------------------------------------------------
const envFile = path.resolve( __dirname, '..', '.env' );
if ( fs.existsSync( envFile ) ) {
	dotenv.config( { path: envFile } );
} else {
	console.warn(
		'Warning: .env not found — token-gated maps will not be configured.'
	);
}

const TOKEN_OPTION_MAP = {
	SPOTMAP_TOKEN_MAPBOX: 'mapbox',
	SPOTMAP_TOKEN_THUNDERFOREST: 'thunderforest',
	SPOTMAP_TOKEN_TIMEZONEDB: 'timezonedb',
	SPOTMAP_TOKEN_LINZ: 'linz.govt.nz',
	SPOTMAP_TOKEN_GEOPORTAIL: 'geoservices.ign.fr',
	SPOTMAP_TOKEN_OSDATAHUB: 'osdatahub.os.uk',
};

const tokens = {};
for ( const [ envKey, optionKey ] of Object.entries( TOKEN_OPTION_MAP ) ) {
	const value = process.env[ envKey ];
	if ( value ) tokens[ optionKey ] = value;
}

// ---------------------------------------------------------------------------
// Dev environment setup (localhost:8888)
// ---------------------------------------------------------------------------
run( 'npx wp-env run cli -- wp plugin activate Spotmap/spotmap.php' );
run(
	'npx wp-env run cli -- wp post update 1 --post_title="Spotmap Demo" --post_content="<!-- wp:spotmap/spotmap /-->"'
);
run(
	'npx wp-env run cli -- wp eval-file /var/www/html/wp-content/plugins/Spotmap/examples/import-sample-data.php'
);

if ( Object.keys( tokens ).length > 0 ) {
	console.log(
		`> Injecting ${
			Object.keys( tokens ).length
		} API token(s) into wp_options…`
	);
	runPhp( `Spotmap_Options::save_api_tokens( ${ phpArray( tokens ) } );` );
} else {
	console.warn(
		'Warning: no tokens found in .env — skipping spotmap_api_tokens update.'
	);
}
