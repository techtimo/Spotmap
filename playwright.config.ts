import { defineConfig, devices } from '@playwright/test';

export default defineConfig( {
    testDir: './tests/e2e',
    globalSetup: './tests/e2e/global-setup.ts',
    use: {
        baseURL: 'http://localhost:8889',
    },
    projects: [ { name: 'chromium', use: { ...devices[ 'Desktop Chrome' ] } } ],
} );
