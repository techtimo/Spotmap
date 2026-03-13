/**
 * Copy front-end dependencies from node_modules to public/ so WordPress can
 * enqueue them as separate scripts/styles (no bundling).
 *
 * Run via: npm run copy-deps          (dev – keeps source maps)
 *          npm run copy-deps:prod     (production – strips sourceMappingURL)
 */

const fs = require( 'fs' );
const path = require( 'path' );

const root = path.resolve( __dirname, '..' );
const pub = ( ...parts ) => path.join( root, 'public', ...parts );
const nm = ( ...parts ) => path.join( root, 'node_modules', ...parts );
const inc = ( ...parts ) => path.join( root, 'includes', ...parts );

const stripMaps = process.argv.includes( '--strip-maps' );

function stripSourceMappingURL( filePath ) {
	const content = fs.readFileSync( filePath, 'utf8' );
	const stripped = content.replace( /\/[*/]#\s*sourceMappingURL=.*?(?:\*\/|$)/gm, '' );
	if ( content !== stripped ) {
		fs.writeFileSync( filePath, stripped, 'utf8' );
		console.log( `  (stripped sourceMappingURL from ${ path.relative( root, filePath ) })` );
	}
}

function copyFile( src, dest ) {
	fs.mkdirSync( path.dirname( dest ), { recursive: true } );
	fs.copyFileSync( src, dest );
	console.log( `  ${ path.relative( root, src ) } -> ${ path.relative( root, dest ) }` );
}

/**
 * Copy a JS file. In dev mode, also copies the .map file if it exists.
 * In production mode (--strip-maps), strips the sourceMappingURL comment.
 */
function copyJsFile( src, dest ) {
	copyFile( src, dest );
	if ( stripMaps ) {
		stripSourceMappingURL( dest );
	} else {
		const mapSrc = src + '.map';
		if ( fs.existsSync( mapSrc ) ) {
			copyFile( mapSrc, dest + '.map' );
		}
	}
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

console.log( `Copying front-end dependencies${ stripMaps ? ' (production)' : ' (dev)' }...\n` );

// Leaflet core
copyJsFile( nm( 'leaflet', 'dist', 'leaflet.js' ), pub( 'leaflet', 'leaflet.js' ) );
copyFile( nm( 'leaflet', 'dist', 'leaflet.css' ), pub( 'leaflet', 'leaflet.css' ) );
copyDir( nm( 'leaflet', 'dist', 'images' ), pub( 'leaflet', 'images' ) );

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
copyJsFile( nm( 'leaflet-tilelayer-swiss', 'dist', 'Leaflet.TileLayer.Swiss.umd.js' ), pub( 'leaflet-tilelayer-swisstopo', 'Leaflet.TileLayer.Swiss.umd.js' ) );

// Font Awesome
copyFile( nm( '@fortawesome', 'fontawesome-free', 'css', 'all.min.css' ), inc( 'css', 'font-awesome-all.min.css' ) );
copyDir( nm( '@fortawesome', 'fontawesome-free', 'webfonts' ), inc( 'webfonts' ) );

// Plugin custom styles (authored in src/css/, served from public/css/)
const src = ( ...parts ) => path.join( root, 'src', ...parts );
copyFile( src( 'css', 'custom.css' ), pub( 'css', 'custom.css' ) );

console.log( '\nDone.' );
