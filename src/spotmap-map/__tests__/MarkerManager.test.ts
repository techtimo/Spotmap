import { MarkerManager } from '../MarkerManager';
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

describe( 'MarkerManager.getPopupHtml', () => {
	it( 'shows type and date/time', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( { type: 'OK', time: '3:00 pm', date: 'Jun 15, 2024' } )
		);
		expect( html ).toContain( '<b>OK</b>' );
		expect( html ).toContain( '3:00 pm' );
		expect( html ).toContain( 'Jun 15, 2024' );
	} );

	it( 'shows altitude when above zero', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( { altitude: 2500 } )
		);
		expect( html ).toContain( 'Altitude: 2500m' );
	} );

	it( 'omits altitude line when altitude is zero', () => {
		const html = MarkerManager.getPopupHtml( makePoint( { altitude: 0 } ) );
		expect( html ).not.toContain( 'Altitude:' );
	} );

	it( 'shows text message for non-MEDIA type', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( { type: 'OK', message: 'Hello from the trail!' } )
		);
		expect( html ).toContain( 'Hello from the trail!' );
		expect( html ).not.toContain( '<img' );
	} );

	it( 'shows image tag for MEDIA type', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( {
				type: 'MEDIA',
				message: 'https://example.com/photo.jpg',
			} )
		);
		expect( html ).toContain( '<img' );
		expect( html ).toContain( 'https://example.com/photo.jpg' );
	} );

	it( 'shows battery warning when status is LOW', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( { battery_status: 'LOW' } )
		);
		expect( html ).toContain( 'Battery status is low!' );
	} );

	it( 'omits battery warning when status is GOOD', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( { battery_status: 'GOOD' } )
		);
		expect( html ).not.toContain( 'Battery' );
	} );

	it( 'shows hidden points annotation', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( { hiddenPoints: { count: 12, radius: 50 } } )
		);
		expect( html ).toContain( '12 hidden Points' );
		expect( html ).toContain( '50 meters' );
	} );

	it( 'shows local time when it differs from UTC time', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( {
				local_timezone: 'Europe/Rome',
				time: '10:00 am',
				date: 'Jan 1, 2024',
				localtime: '11:00 am',
				localdate: 'Jan 1, 2024',
			} )
		);
		expect( html ).toContain( 'Local Time: 11:00 am' );
	} );

	it( 'omits local time when it matches UTC time', () => {
		const html = MarkerManager.getPopupHtml(
			makePoint( {
				local_timezone: 'UTC',
				time: '10:00 am',
				date: 'Jan 1, 2024',
				localtime: '10:00 am',
				localdate: 'Jan 1, 2024',
			} )
		);
		expect( html ).not.toContain( 'Local Time' );
	} );
} );
