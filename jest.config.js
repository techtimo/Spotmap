// eslint-disable-next-line import/no-extraneous-dependencies
const defaultConfig = require( '@wordpress/jest-preset-default/jest-preset' );

module.exports = {
    ...defaultConfig,
    setupFilesAfterEnv: [
        ...( defaultConfig.setupFilesAfterEnv ?? [] ),
        '<rootDir>/jest.setup.js',
    ],
    testPathIgnorePatterns: [
        ...( defaultConfig.testPathIgnorePatterns ?? [] ),
        '/__tests__/fixtures\\.js$',
    ],
    // uuid ships as ESM in newer resolutions; allow it through Babel transform
    // even when nested under @wordpress/components/node_modules/uuid
    transformIgnorePatterns: [ '/node_modules/(?!(.*\\/)?uuid/)' ],
};
