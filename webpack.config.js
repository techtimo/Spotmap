const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,
	entry: {
		...defaultConfig.entry(),
		'spotmap-map':   './src/spotmap-map/index.ts',
		'spotmap-admin': './src/spotmap-admin/index.js',
	},
	module: {
		...defaultConfig.module,
		rules: [
			...( defaultConfig.module?.rules || [] ),
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: [ /node_modules/, /__tests__/ ],
			},
		],
	},
	resolve: {
		...defaultConfig.resolve,
		extensions: [ '.ts', '.tsx', '.js', '.jsx' ],
	},
};
