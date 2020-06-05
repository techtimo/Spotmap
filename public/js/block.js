// block.js
( function( blocks, element, i18n) {
    var el = element.createElement;
    const { __ } = i18n;
    function renderMap( props ) {
        return el('div',{},
            el('div', {id: 'spotmap-container', 'data-mapcenter': 'all',style: {'height': 400+'px', 'max-width': 100+'%'}}),
            el('script', {type: 'text/javascript'},'jQuery( document ).ready(function() {initMap();});')
        )
    }
    blocks.registerBlockType( 'spotmap/spotmap', {
        title: __('Spotmap'),
        icon: 'location-alt',
        category: 'embed',
        edit: function( props ) {
            jQuery( document ).ready(function() {initMap();});
            return renderMap( props )
        },
 
        save: function( props ) {
            jQuery( document ).ready(function() {initMap();});
            return renderMap( props );
        },
        keywords: ['findmespot', 'spot', 'gps', __('map')],
    } );
} )(
    window.wp.blocks,
    window.wp.element,
    window.wp.i18n
);
