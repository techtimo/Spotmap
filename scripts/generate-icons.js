/**
 * Generates PNG icons for the WordPress plugin directory from icon.svg.
 * Requires: npm install --save-dev svg2img
 * Usage:    node scripts/generate-icons.js
 */

const svg2img = require( 'svg2img' );
const fs = require( 'fs' );
const path = require( 'path' );

const SRC = path.resolve( __dirname, '../.wordpress-org/icon.svg' );
const OUT = path.resolve( __dirname, '../.wordpress-org' );

const sizes = [
    { name: 'icon-128x128.png', width: 128, height: 128 },
    { name: 'icon-256x256.png', width: 256, height: 256 },
];

const svg = fs.readFileSync( SRC, 'utf8' );

for ( const { name, width, height } of sizes ) {
    svg2img(
        svg,
        { width, height, preserveAspectRatio: true },
        ( err, buffer ) => {
            if ( err ) {
                console.error( `Failed to generate ${ name }:`, err );
                process.exit( 1 );
            }
            const dest = path.join( OUT, name );
            fs.writeFileSync( dest, buffer );
            console.log( `✓ ${ dest }` );
        }
    );
}
