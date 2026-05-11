/* global moment, spotmapDashboard, location */
( function () {
    document.addEventListener( 'DOMContentLoaded', function () {
        if ( typeof moment !== 'undefined' ) {
            document
                .querySelectorAll( '[data-spotmap-ts]' )
                .forEach( function ( el ) {
                    const ts = parseInt( el.dataset.spotmapTs, 10 );
                    if ( ! ts ) {
                        return;
                    }
                    const m = moment.unix( ts );
                    if ( moment().diff( m, 'hours' ) < 24 ) {
                        el.textContent = m.fromNow();
                    }
                } );
        }

        document
            .querySelectorAll( '.spotmap-enable-btn' )
            .forEach( function ( btn ) {
                btn.addEventListener( 'click', function () {
                    const type = btn.dataset.spotmapEnable;
                    const name = btn.dataset.spotmapName;
                    btn.disabled = true;
                    btn.textContent = 'Enabling…';

                    fetch( spotmapDashboard.restUrl + 'feeds', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': spotmapDashboard.nonce,
                        },
                        body: JSON.stringify( { type, name } ),
                    } )
                        .then( function ( res ) {
                            if ( ! res.ok ) {
                                return res.json().then( function ( d ) {
                                    throw new Error(
                                        d.message || 'Request failed'
                                    );
                                } );
                            }
                            location.reload();
                        } )
                        .catch( function ( err ) {
                            btn.disabled = false;
                            btn.textContent = 'enable';
                            const errEl = document.createElement( 'span' );
                            errEl.style.color = '#d63638';
                            errEl.style.marginLeft = '4px';
                            errEl.textContent = err.message;
                            btn.parentNode.appendChild( errEl );
                        } );
                } );
            } );
    } );
} )();
