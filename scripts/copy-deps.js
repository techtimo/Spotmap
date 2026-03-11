/**
 * Copy front-end dependencies from node_modules to public/ so WordPress can
 * enqueue them as separate scripts/styles (no bundling).
 *
 * Run via: npm run copy-deps
 */

const fs = require( 'fs' );
const path = require( 'path' );

const root = path.resolve( __dirname, '..' );
const pub = ( ...parts ) => path.join( root, 'public', ...parts );
const nm = ( ...parts ) => path.join( root, 'node_modules', ...parts );
const inc = ( ...parts ) => path.join( root, 'includes', ...parts );

function copyFile( src, dest ) {
	fs.mkdirSync( path.dirname( dest ), { recursive: true } );
	fs.copyFileSync( src, dest );
	console.log( `  ${ path.relative( root, src ) } -> ${ path.relative( root, dest ) }` );
}

function copyDir( src, dest ) {
	fs.mkdirSync( dest, { recursive: true } );
	for ( const entry of fs.readdirSync( src, { withFileTypes: true } ) ) {
		const srcPath = path.join( src, entry.name );
		const destPath = path.join( dest, entry.name );
		if ( entry.isDirectory() ) {
			copyDir( srcPath, destPath );
		} else {
			fs.copyFileSync( srcPath, destPath );
			console.log( `  ${ path.relative( root, srcPath ) } -> ${ path.relative( root, destPath ) }` );
		}
	}
}

console.log( 'Copying front-end dependencies...\n' );

// Leaflet core
copyFile( nm( 'leaflet', 'dist', 'leaflet.js' ), pub( 'leaflet', 'leaflet.js' ) );
copyFile( nm( 'leaflet', 'dist', 'leaflet.css' ), pub( 'leaflet', 'leaflet.css' ) );
// Leaflet marker images: custom colored icons live in public/leaflet/images/
// and already include the standard ones, so skip copying upstream images.

// Leaflet Fullscreen (file names changed in v5)
copyFile( nm( 'leaflet.fullscreen', 'dist', 'Control.FullScreen.umd.js' ), pub( 'leafletfullscreen', 'leaflet.fullscreen.js' ) );
copyFile( nm( 'leaflet.fullscreen', 'dist', 'Control.FullScreen.css' ), pub( 'leafletfullscreen', 'leaflet.fullscreen.css' ) );

// Leaflet GPX
copyFile( nm( 'leaflet-gpx', 'gpx.js' ), pub( 'leaflet-gpx', 'gpx.js' ) );
copyDir( nm( 'leaflet-gpx', 'icons' ), pub( 'leaflet-gpx' ) );

// Leaflet EasyButton
copyFile( nm( 'leaflet-easybutton', 'src', 'easy-button.js' ), pub( 'leaflet-easy-button', 'easy-button.js' ) );
copyFile( nm( 'leaflet-easybutton', 'src', 'easy-button.css' ), pub( 'leaflet-easy-button', 'easy-button.css' ) );

// Leaflet TextPath
copyFile( nm( 'leaflet-textpath', 'leaflet.textpath.js' ), pub( 'leaflet-textpath', 'leaflet.textpath.js' ) );

// Leaflet TileLayer Swiss
copyFile( nm( 'leaflet-tilelayer-swiss', 'dist', 'Leaflet.TileLayer.Swiss.umd.js' ), pub( 'leaflet-tilelayer-swisstopo', 'Leaflet.TileLayer.Swiss.umd.js' ) );

// Font Awesome
copyFile( nm( '@fortawesome', 'fontawesome-free', 'css', 'all.min.css' ), inc( 'css', 'font-awesome-all.min.css' ) );
copyDir( nm( '@fortawesome', 'fontawesome-free', 'webfonts' ), inc( 'webfonts' ) );

// TODO: remove source map file references from copied CSS files, or copy source maps as well

console.log( '\nDone.' );
