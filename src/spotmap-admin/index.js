import { createRoot } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import App from './App';

apiFetch.use( apiFetch.createNonceMiddleware( window.spotmapAdminData.nonce ) );

const root = document.getElementById( 'spotmap-admin-root' );
if ( root ) {
    createRoot( root ).render( <App /> );
}
