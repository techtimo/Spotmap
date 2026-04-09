import apiFetch from '@wordpress/api-fetch';
import * as api from '../api';

jest.mock( '@wordpress/api-fetch', () => {
    const mock = jest.fn();
    mock.use = jest.fn();
    return { __esModule: true, default: mock };
} );

const BASE = 'http://localhost/wp-json/spotmap/v1';

beforeEach( () => {
    apiFetch.mockResolvedValue( {} );
} );

afterEach( () => {
    apiFetch.mockReset();
} );

describe( 'REDACTED constant', () => {
    it( 'equals window.spotmapAdminData.REDACTED', () => {
        expect( api.REDACTED ).toBe( '__REDACTED__' );
    } );
} );

describe( 'feeds', () => {
    it( 'getFeeds — GET /feeds', async () => {
        await api.getFeeds();
        expect( apiFetch ).toHaveBeenCalledWith( { url: `${ BASE }/feeds` } );
    } );

    it( 'createFeed — POST /feeds with data', async () => {
        const data = { type: 'findmespot', name: 'test' };
        await api.createFeed( data );
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/feeds`,
            method: 'POST',
            data,
        } );
    } );

    it( 'updateFeed — PUT /feeds/:id with data', async () => {
        const data = { name: 'updated' };
        await api.updateFeed( 'abc123', data );
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/feeds/abc123`,
            method: 'PUT',
            data,
        } );
    } );

    it( 'deleteFeed — DELETE /feeds/:id', async () => {
        await api.deleteFeed( 'abc123' );
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/feeds/abc123`,
            method: 'DELETE',
            data: { delete_points: false },
        } );
    } );
} );

describe( 'providers', () => {
    it( 'getProviders — GET /providers', async () => {
        await api.getProviders();
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/providers`,
        } );
    } );
} );

describe( 'markers', () => {
    it( 'getMarkers — GET /markers', async () => {
        await api.getMarkers();
        expect( apiFetch ).toHaveBeenCalledWith( { url: `${ BASE }/markers` } );
    } );

    it( 'updateMarkers — PUT /markers with data', async () => {
        const data = {
            OK: { iconShape: 'circle', icon: 'star', customMessage: '' },
        };
        await api.updateMarkers( data );
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/markers`,
            method: 'PUT',
            data,
        } );
    } );
} );

describe( 'tokens', () => {
    it( 'getTokens — GET /tokens', async () => {
        await api.getTokens();
        expect( apiFetch ).toHaveBeenCalledWith( { url: `${ BASE }/tokens` } );
    } );

    it( 'updateTokens — PUT /tokens with data', async () => {
        const data = { mapbox: 'my-token' };
        await api.updateTokens( data );
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/tokens`,
            method: 'PUT',
            data,
        } );
    } );
} );

describe( 'defaults', () => {
    it( 'getDefaults — GET /defaults', async () => {
        await api.getDefaults();
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/defaults`,
        } );
    } );

    it( 'updateDefaults — PUT /defaults with data', async () => {
        const data = { height: 400, maps: 'openstreetmap' };
        await api.updateDefaults( data );
        expect( apiFetch ).toHaveBeenCalledWith( {
            url: `${ BASE }/defaults`,
            method: 'PUT',
            data,
        } );
    } );
} );

describe( 'URL construction', () => {
    it( 'strips trailing slash from restUrl', async () => {
        // window.spotmapAdminData.restUrl ends with '/' — base must not double-slash
        await api.getFeeds();
        const calledUrl = apiFetch.mock.calls[ 0 ][ 0 ].url;
        expect( calledUrl ).not.toContain( '//' + 'feeds' );
        expect( calledUrl ).toBe( `${ BASE }/feeds` );
    } );
} );
