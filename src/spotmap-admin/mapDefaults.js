export function getDefaultMaps() {
    const dv = window.spotmapjsobj?.defaultValues?.maps;
    if ( dv ) {
        return dv
            .split( ',' )
            .map( ( m ) => m.trim() )
            .filter( Boolean );
    }
    return Object.keys( window.spotmapjsobj?.maps ?? {} ).slice( 0, 1 );
}
