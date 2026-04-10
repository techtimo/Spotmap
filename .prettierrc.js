const wordpressConfig = require( '@wordpress/prettier-config' );

module.exports = {
    ...wordpressConfig,
    useTabs: false,
    tabWidth: 4,
    overrides: [
        {
            files: [ '*.yml', '*.yaml' ],
            options: {
                tabWidth: 2,
            },
        },
    ],
};
