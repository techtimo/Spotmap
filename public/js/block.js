// block.js
( function( blocks, element ) {
    var el = element.createElement;
 
    function renderMap( props ) {
        return el('div',{},
            el('div', {id: 'spotmap-container', 'data-mapcenter': 'all',style: {'height': 300+'px', 'max-width': 100+'%'}}),
            el('script', {type: 'text/javascript'},'jQuery( document ).ready(function() {initMap();});')
        )
    }
    blocks.registerBlockType( 'spotmap/spotmap', {
        title: 'Spotmap',
        icon: 'location-alt',
        category: 'embed',
        edit: function( props ) {
            jQuery( document ).ready(function() {initMap();});
            return renderMap( props )
        },
 
        save: function( props ) {
            jQuery( document ).ready(function() {initMap();});
            return renderMap( props );
        }
    } );
} )(
    window.wp.blocks,
    window.wp.element
);

