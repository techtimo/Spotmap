#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Syncs the version from package.json into:
 *   - spotmap.php        (Plugin header "Version:" and SPOTMAP_VERSION constant)
 *   - composer.json      ("version" field)
 *   - pluginreadme.md    (Stable tag: — skipped for pre-release versions)
 *   - tests/bootstrap.php (SPOTMAP_VERSION constant)
 *
 * Usage: node scripts/bump-version.js
 * Typically called via: npm run version:bump
 */

const fs = require( 'fs' );
const path = require( 'path' );

const root = path.resolve( __dirname, '..' );

const arg = process.argv[ 2 ];
let version;

if ( arg ) {
    // Update package.json with the supplied version
    const pkgFile = path.join( root, 'package.json' );
    const pkg = JSON.parse( fs.readFileSync( pkgFile, 'utf8' ) );
    pkg.version = arg;
    fs.writeFileSync( pkgFile, JSON.stringify( pkg, null, 4 ) + '\n' );
    version = arg;
} else {
    version = require( path.join( root, 'package.json' ) ).version;
}

if ( ! version ) {
    console.error( 'Could not read version from package.json' );
    process.exit( 1 );
}

console.log( `Syncing version ${ version } ...` );

// --- spotmap.php ---
const phpFile = path.join( root, 'spotmap.php' );
let php = fs.readFileSync( phpFile, 'utf8' );

php = php.replace( /^( \* Version:\s+)[\d.]+(-[\w.]+)?/m, `$1${ version }` );
php = php.replace(
    /^(define\(\s*'SPOTMAP_VERSION',\s*')[\d.]+(-[\w.]+)?(')/m,
    `$1${ version }$3`
);

fs.writeFileSync( phpFile, php );
console.log( `  spotmap.php updated` );

// --- pluginreadme.md ---
const readmeFile = path.join( root, 'pluginreadme.md' );
let readme = fs.readFileSync( readmeFile, 'utf8' );

// Only update Stable tag for stable releases (no pre-release suffix)
if ( /^[\d]+\.[\d]+\.[\d]+$/.test( version ) ) {
    readme = readme.replace( /^(Stable tag:\s*)[\d.]+/m, `$1${ version }` );
    fs.writeFileSync( readmeFile, readme );
    console.log( `  pluginreadme.md Stable tag updated` );
} else {
    console.log(
        `  pluginreadme.md Stable tag skipped (pre-release: ${ version })`
    );
}

// --- composer.json ---
const composerFile = path.join( root, 'composer.json' );
let composer = fs.readFileSync( composerFile, 'utf8' );

composer = composer.replace(
    /("version":\s*")[\d.]+(-[\w.]+)?(")/,
    `$1${ version }$3`
);

fs.writeFileSync( composerFile, composer );
console.log( `  composer.json updated` );

// --- tests/bootstrap.php ---
const bootstrapFile = path.join( root, 'tests', 'bootstrap.php' );
let bootstrap = fs.readFileSync( bootstrapFile, 'utf8' );

bootstrap = bootstrap.replace(
    /^(define\(\s*'SPOTMAP_VERSION',\s*')[\d.]+(-[\w.]+)?(')/m,
    `$1${ version }$3`
);

fs.writeFileSync( bootstrapFile, bootstrap );
console.log( `  tests/bootstrap.php updated` );

console.log( 'Done.' );
