module.exports = {
    extends: [ 'plugin:@wordpress/eslint-plugin/recommended' ],
    env: {
        browser: true,
    },
    rules: {
        // @wordpress/* packages are WordPress externals, not bundled deps
        'import/no-unresolved': [ 'error', { ignore: [ '^@wordpress/' ] } ],
        // @wordpress/* packages are WordPress-provided externals; not bundled
        'import/no-extraneous-dependencies': [
            'error',
            {
                devDependencies: true,
                packageDir: [
                    '.',
                    './node_modules/@wordpress/icons',
                    './node_modules/@wordpress/env',
                ],
            },
        ],
        // Allow @returns as alias for @return (both are valid JSDoc)
        'jsdoc/check-tag-names': [ 'error', { definedTags: [ 'returns' ] } ],
        // Allow console.error/warn for legitimate error reporting
        'no-console': [ 'error', { allow: [ 'error', 'warn' ] } ],
        // __experimentalUnitControl is the only option for this API;
        // no stable UnitControl exists in the WordPress runtime externals
        '@wordpress/no-unsafe-wp-apis': [
            'error',
            { '@wordpress/components': [ '__experimentalUnitControl' ] },
        ],
    },
    overrides: [
        {
            // TypeScript types already document params — @param is redundant
            files: [ '**/*.ts', '**/*.tsx' ],
            rules: {
                'jsdoc/require-param': 'off',
                'jsdoc/check-tag-names': 'off',
            },
        },
        {
            files: [
                '**/__tests__/**/*.js',
                '**/__tests__/**/*.jsx',
                '**/__tests__/**/*.ts',
                '**/__tests__/**/*.tsx',
                '**/*.test.js',
                '**/*.test.jsx',
                '**/*.test.ts',
                '**/*.test.tsx',
            ],
            extends: [ 'plugin:@wordpress/eslint-plugin/test-unit' ],
        },
    ],
};
