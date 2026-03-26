import apiFetch from '@wordpress/api-fetch';

const base = window.spotmapAdminData.restUrl.replace( /\/$/, '' );

const url = ( path ) => `${ base }/${ path }`;

export const REDACTED = window.spotmapAdminData.REDACTED;

export const getFeeds = () => apiFetch( { url: url( 'feeds' ) } );

export const createFeed = ( data ) =>
	apiFetch( { url: url( 'feeds' ), method: 'POST', data } );

export const updateFeed = ( id, data ) =>
	apiFetch( { url: url( `feeds/${ id }` ), method: 'PUT', data } );

export const deleteFeed = ( id ) =>
	apiFetch( { url: url( `feeds/${ id }` ), method: 'DELETE' } );

export const getProviders = () => apiFetch( { url: url( 'providers' ) } );

export const getMarkers = () => apiFetch( { url: url( 'markers' ) } );

export const updateMarkers = ( data ) =>
	apiFetch( { url: url( 'markers' ), method: 'PUT', data } );

export const getTokens = () => apiFetch( { url: url( 'tokens' ) } );

export const updateTokens = ( data ) =>
	apiFetch( { url: url( 'tokens' ), method: 'PUT', data } );

export const getDefaults = () => apiFetch( { url: url( 'defaults' ) } );

export const updateDefaults = ( data ) =>
	apiFetch( { url: url( 'defaults' ), method: 'PUT', data } );

export const getPoints = ( { feed, from, to } = {} ) => {
	const params = new URLSearchParams();
	if ( feed ) params.set( 'feed', feed );
	if ( from ) params.set( 'from', from );
	if ( to ) params.set( 'to', to );
	const qs = params.toString();
	return apiFetch( { url: url( 'points' ) + ( qs ? '?' + qs : '' ) } );
};

export const updatePoint = ( id, { latitude, longitude } ) =>
	apiFetch( {
		url: url( `points/${ id }` ),
		method: 'PUT',
		data: { latitude, longitude },
	} );
