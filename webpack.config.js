const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
    ...defaultConfig,
    entry: {
        ...defaultConfig.entry(),
        'spotmap-map': './src/map-engine/index.ts',
        'spotmap-admin': './src/spotmap-admin/index.js',
        'post-location': './src/post-location/index.js',
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
