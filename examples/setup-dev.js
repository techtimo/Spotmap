const { execSync } = require( 'child_process' );

const run = ( cmd ) => {
	console.log( `> ${ cmd }` );
	try {
		execSync( cmd, { stdio: 'inherit' } );
	} catch ( e ) {
		console.warn( `Warning: "${ cmd }" exited with code ${ e.status }` );
	}
};

run( 'npx wp-env run cli -- wp plugin activate Spotmap/spotmap.php' );
run(
	'npx wp-env run cli -- wp post update 1 --post_title="Spotmap Demo" --post_content="<!-- wp:spotmap/spotmap /-->"'
);
run(
	'npx wp-env run cli -- wp eval-file /var/www/html/wp-content/plugins/Spotmap/examples/import-sample-data.php'
);
