#!/usr/bin/env node
// Regenerates src/spotmap-admin/icons.js from FA metadata.
// Run: node scripts/generate-fa-icons.js
const yaml = require( 'js-yaml' );
const fs = require( 'fs' );
const icons = yaml.load(
	fs.readFileSync(
		'node_modules/@fortawesome/fontawesome-free/metadata/icons.yml',
		'utf8'
	)
);
const solid = Object.entries( icons )
	.filter( ( [ , v ] ) => v.styles && v.styles.includes( 'solid' ) )
	.map( ( [ k ] ) => k )
	.sort();
const out = [
	'/**',
	' * All Font Awesome 5 Free solid icon names, derived from FA metadata.',
	' * Regenerate: node scripts/generate-fa-icons.js',
	' */',
	'export const ICONS = [',
	...solid.reduce( ( rows, _, i ) => {
		if ( i % 8 === 0 )
			rows.push(
				'\t' +
					solid
						.slice( i, i + 8 )
						.map( ( x ) => JSON.stringify( x ) )
						.join( ', ' ) +
					','
			);
		return rows;
	}, [] ),
	'];',
].join( '\n' );
fs.writeFileSync( 'src/spotmap-admin/icons.js', out );
console.log( 'Written', solid.length, 'icons to src/spotmap-admin/icons.js' );
