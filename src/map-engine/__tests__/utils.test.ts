import { debug, getColorDot } from '../utils';

describe( 'debug', () => {
    let spy: jest.SpyInstance;

    beforeEach( () => {
        spy = jest.spyOn( console, 'log' ).mockImplementation( () => {} );
    } );

    afterEach( () => {
        spy.mockRestore();
    } );

    it( 'logs to console when enabled', () => {
        debug( true, 'hello', 42 );
        expect( spy ).toHaveBeenCalledWith( 'hello', 42 );
    } );

    it( 'does not log when disabled', () => {
        debug( false, 'hello' );
        expect( spy ).not.toHaveBeenCalled();
    } );
} );

describe( 'getColorDot', () => {
    it( 'returns a span with the given color', () => {
        const html = getColorDot( 'red' );
        expect( html ).toContain( 'background-color:red' );
        expect( html ).toContain( '<span' );
        expect( html ).toContain( 'border-radius:50%' );
    } );
} );
