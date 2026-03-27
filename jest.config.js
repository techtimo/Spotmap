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
};
