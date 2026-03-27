import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * All base layer keys from config/maps.yaml.
 * Token-gated maps will simply be absent from spotmapjsobj.maps at runtime —
 * listing all keys here is safe because LayerManager skips unknown keys.
 */
const ALL_MAP_KEYS = [
    'mb-outdoors',
    'mb-satelite',
    'mb-streets',
    'tf-landscape',
    'tf-transport',
    'tf-atlas',
    'tf-outdoors',
    'tf-cycle',
    'openstreetmap',
    'opentopomap',
    'spain-ign-topo',
    'france-ign-topo',
    'newzealand-topo50',
    'newzealand-topo250',
    'stamen-watercolor',
    'esri-natgeoworldmap',
    'uk-os-outdoor',
    'uk-os-road',
    'uk-os-light',
    'usgs-topo',
    'usgs-topo-sat',
    'usgs-sat',
];

/**
 * Maps .env variable names to the WP option keys used in spotmap_api_tokens.
 * These match the 'option' field in Spotmap_Admin::get_maps().
 */
const TOKEN_OPTION_MAP: Record< string, string > = {
    SPOTMAP_TOKEN_MAPBOX: 'mapbox',
    SPOTMAP_TOKEN_THUNDERFOREST: 'thunderforest',
    SPOTMAP_TOKEN_TIMEZONEDB: 'timezonedb',
    SPOTMAP_TOKEN_LINZ: 'linz.govt.nz',
    SPOTMAP_TOKEN_GEOPORTAIL: 'geoservices.ign.fr',
    SPOTMAP_TOKEN_OSDATAHUB: 'osdatahub.os.uk',
};

// The plugin directory is mounted at this path inside every wp-env container.
const CONTAINER_PLUGIN_PATH = '/var/www/html/wp-content/plugins/Spotmap';

// Temp PHP file written by Node.js, executed inside the container via eval-file.
// Written to the plugin dir so it is automatically available at the container path.
const TEMP_PHP_LOCAL = path.resolve( process.cwd(), 'tests/e2e/.inject.php' );
const TEMP_PHP_CONTAINER = `${ CONTAINER_PLUGIN_PATH }/tests/e2e/.inject.php`;

function run( cmd: string ): void {
    // eslint-disable-next-line no-console
    console.log( `\n> ${ cmd }` );
    execSync( cmd, { stdio: 'inherit' } );
}

/**
 * Write PHP code to a temp file and execute it via wp eval-file.
 * This avoids all shell-quoting issues: the PHP source is written directly
 * by Node.js (no shell involved), and wp eval-file only receives a file path.
 */
function runPhp( php: string, env: string = 'tests-cli' ): void {
    fs.writeFileSync( TEMP_PHP_LOCAL, `<?php\n${ php }\n` );
    try {
        run(
            `npx wp-env run ${ env } -- wp eval-file ${ TEMP_PHP_CONTAINER }`
        );
    } finally {
        fs.unlinkSync( TEMP_PHP_LOCAL );
    }
}

/** Converts a JS object to a PHP associative array literal. */
function phpArray( obj: Record< string, string > ): string {
    const pairs = Object.entries( obj )
        .map( ( [ k, v ] ) => `'${ k }' => '${ v }'` )
        .join( ', ' );
    return `[ ${ pairs } ]`;
}

export default async function globalSetup(): Promise< void > {
    // Load private tokens from .env (gitignored)
    const envFile = path.resolve( process.cwd(), '.env' );
    if ( fs.existsSync( envFile ) ) {
        dotenv.config( { path: envFile } );
    } else {
        console.warn(
            'Warning: .env not found — token-gated maps will be excluded.'
        );
    }

    // Ensure the plugin is active on the tests environment (port 8889)
    run( 'npx wp-env run tests-cli -- wp plugin activate Spotmap/spotmap.php' );

    // Build the tokens object from env vars
    const tokens: Record< string, string > = {};
    for ( const [ envKey, optionKey ] of Object.entries( TOKEN_OPTION_MAP ) ) {
        const value = process.env[ envKey ];
        if ( value ) {
            tokens[ optionKey ] = value;
        }
    }

    // Inject tokens via a temp PHP file — no shell quoting required
    if ( Object.keys( tokens ).length > 0 ) {
        runPhp(
            `Spotmap_Options::save_api_tokens( ${ phpArray( tokens ) } );`
        );
    }

    // Build block content listing every map key.
    // PHP will only expose maps whose tokens are set, so spotmapjsobj.maps will
    // be correctly filtered — but the block must list all keys upfront.
    const blockAttrs = JSON.stringify( {
        maps: ALL_MAP_KEYS,
        feeds: [],
        styles: {},
    } );
    // Block content only contains double-quotes and no single-quotes, so it is
    // safe inside a PHP single-quoted string.
    const blockContent = `<!-- wp:spotmap/spotmap ${ blockAttrs } /-->`;

    runPhp(
        `wp_update_post( [ 'ID' => 1, 'post_content' => '${ blockContent }', 'post_status' => 'publish' ] );`
    );
}
