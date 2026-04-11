/**
 * Conditional debug logger.
 *
 * @param enabled - Whether debug mode is active.
 * @param args    - Values to log.
 */
export function debug( enabled: boolean, ...args: unknown[] ): void {
    if ( enabled ) {
        console.log( ...args ); // eslint-disable-line no-console
    }
}

/**
 * Returns an inline HTML color dot for use in the layer control legend.
 */
export function getColorDot( color: string ): string {
    return `<span class="dot" style="position:relative;height:10px;width:10px;background-color:${ color };border-radius:50%;display:inline-block;"></span>`;
}
