import { describe, it, expect } from '@jest/globals';
import { buildView } from '../popup-templates';
import type { SpotPoint } from '../types';

function makePoint( overrides: Partial< SpotPoint > = {} ): SpotPoint {
    return {
        id: 1,
        feed_name: 'test',
        latitude: 47.0,
        longitude: 8.0,
        altitude: 0,
        type: 'OK',
        unixtime: 1700000000,
        time: '12:00 pm',
        date: 'Jan 1, 2024',
        ...overrides,
    };
}

describe( 'buildView', () => {
    describe( 'POST type', () => {
        it( 'builds linkedTitle and url when URL is present', () => {
            const view = buildView(
                makePoint( {
                    type: 'POST',
                    message: 'My Post Title',
                    url: 'https://example.com/post',
                    date: 'Jan 1, 2024',
                } )
            );
            expect( view.linkedTitle ).toBe( 'My Post Title' );
            expect( view.url ).toBe( 'https://example.com/post' );
            expect( view.plainTitle ).toBeUndefined();
            expect( view.pointType ).toBeUndefined();
        } );

        it( 'builds plainTitle when no URL', () => {
            const view = buildView(
                makePoint( {
                    type: 'POST',
                    message: 'My Post Title',
                    date: 'Jan 1, 2024',
                } )
            );
            expect( view.plainTitle ).toBe( 'My Post Title' );
            expect( view.linkedTitle ).toBeUndefined();
        } );

        it( 'falls back to "Post" as title when message is absent', () => {
            const view = buildView(
                makePoint( { type: 'POST', date: 'Jan 1, 2024' } )
            );
            expect( view.plainTitle ).toBe( 'Post' );
        } );

        it( 'includes imageUrl when image_url is present', () => {
            const view = buildView(
                makePoint( {
                    type: 'POST',
                    image_url: 'https://example.com/img.jpg',
                    date: 'Jan 1, 2024',
                } )
            );
            expect( view.imageUrl ).toBe( 'https://example.com/img.jpg' );
        } );

        it( 'includes excerpt when present', () => {
            const view = buildView(
                makePoint( {
                    type: 'POST',
                    excerpt: 'A short excerpt.',
                    date: 'Jan 1, 2024',
                } )
            );
            expect( view.excerpt ).toBe( 'A short excerpt.' );
        } );
    } );

    describe( 'non-POST type', () => {
        it( 'includes feedName when feedCount > 1', () => {
            const view = buildView(
                makePoint( { feed_name: 'Tracker A' } ),
                2
            );
            expect( view.feedName ).toBe( 'Tracker A' );
        } );

        it( 'omits feedName when feedCount is 1', () => {
            const view = buildView( makePoint( { feed_name: 'Tracker A' } ) );
            expect( view.feedName ).toBeUndefined();
        } );

        it( 'sets showLocalTime when timezone differs from UTC', () => {
            const view = buildView(
                makePoint( {
                    local_timezone: 'Europe/Rome',
                    time: '10:00 am',
                    date: 'Jan 1, 2024',
                    localtime: '11:00 am',
                    localdate: 'Jan 1, 2024',
                } )
            );
            expect( view.showLocalTime ).toBe( true );
        } );

        it( 'omits altitude when zero', () => {
            const view = buildView( makePoint( { altitude: 0 } ) );
            expect( view.altitude ).toBeUndefined();
        } );

        it( 'includes altitude when above zero', () => {
            const view = buildView( makePoint( { altitude: 2500 } ) );
            expect( view.altitude ).toBe( 2500 );
        } );

        it( 'wraps hiddenPoints radius in array when > 0', () => {
            const view = buildView(
                makePoint( { hiddenPoints: { count: 5, radius: 50 } } )
            );
            expect( view.hiddenPoints?.radius ).toEqual( [ 50 ] );
        } );

        it( 'passes empty radius array when radius is 0', () => {
            const view = buildView(
                makePoint( { hiddenPoints: { count: 3, radius: 0 } } )
            );
            expect( view.hiddenPoints?.radius ).toEqual( [] );
        } );
    } );
} );
