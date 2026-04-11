import apiFetch from '@wordpress/api-fetch';

const base = window.spotmapAdminData.restUrl.replace( /\/$/, '' );

const url = ( path ) => `${ base }/${ path }`;

export const REDACTED = window.spotmapAdminData.REDACTED;

export const getFeeds = () => apiFetch( { url: url( 'feeds' ) } );

export const createFeed = ( data ) =>
    apiFetch( { url: url( 'feeds' ), method: 'POST', data } );

export const updateFeed = ( id, data ) =>
    apiFetch( { url: url( `feeds/${ id }` ), method: 'PUT', data } );

export const deleteFeed = ( id, deletePoints = false ) =>
    apiFetch( {
        url: url( `feeds/${ id }` ),
        method: 'DELETE',
        data: { delete_points: deletePoints },
    } );

export const getDbFeeds = () => apiFetch( { url: url( 'db-feeds' ) } );

export const renameDbFeed = ( feedName, newName ) =>
    apiFetch( {
        url: url( 'db-feeds' ),
        method: 'PATCH',
        data: { feed_name: feedName, new_name: newName },
    } );

export const deleteDbFeedPoints = ( feedName ) =>
    apiFetch( {
        url: url( 'db-feeds' ),
        method: 'DELETE',
        data: { feed_name: feedName },
    } );

export const getDbFeedStats = ( feedName ) => {
    const params = new URLSearchParams( { feed_name: feedName } );
    const endpoint = url( 'db-feeds/stats' );
    return apiFetch( {
        url: endpoint + ( endpoint.includes( '?' ) ? '&' : '?' ) + params,
    } );
};

export const importPhotos = ( id ) =>
    apiFetch( { url: url( `feeds/${ id }/import-photos` ), method: 'POST' } );

export const pauseFeed = ( id ) =>
    apiFetch( { url: url( `feeds/${ id }/pause` ), method: 'POST' } );

export const unpauseFeed = ( id ) =>
    apiFetch( { url: url( `feeds/${ id }/unpause` ), method: 'POST' } );

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
    if ( feed ) {
        params.set( 'feed', feed );
    }
    if ( from ) {
        params.set( 'from', from );
    }
    if ( to ) {
        params.set( 'to', to );
    }
    const qs = params.toString();
    if ( ! qs ) {
        return apiFetch( { url: url( 'points' ) } );
    }
    const endpoint = url( 'points' );
    return apiFetch( {
        url: endpoint + ( endpoint.includes( '?' ) ? '&' : '?' ) + qs,
    } );
};

export const updatePoint = ( id, { latitude, longitude } ) =>
    apiFetch( {
        url: url( `points/${ id }` ),
        method: 'PUT',
        data: { latitude, longitude },
    } );

export const getFeedStats = ( id ) =>
    apiFetch( { url: url( `feeds/${ id }/stats` ) } );

export const getVictronInstallations = ( token ) => {
    const params = new URLSearchParams( { token } );
    const endpoint = url( 'victron/installations' );
    return apiFetch( {
        url: endpoint + ( endpoint.includes( '?' ) ? '&' : '?' ) + params,
    } );
};
