import type { AjaxRequestBody, SpotPoint, TableOptions } from './types';
import { TABLE_RELOAD_INTERVAL_MS, MAX_RELOAD_BACKOFF_MS } from './constants';
import { DataFetcher } from './DataFetcher';
import { debug as debugLog } from './utils';

/**
 * Renders the [spotmessages] shortcode table and handles auto-reload.
 */
export class TableRenderer {
    private readonly options: TableOptions;
    private readonly dataFetcher: DataFetcher;
    private timeoutId: ReturnType< typeof setTimeout > | null = null;
    private onVisibilityChange: ( () => void ) | null = null;

    constructor( options: TableOptions, dataFetcher: DataFetcher ) {
        this.options = options;
        this.dataFetcher = dataFetcher;
    }

    /**
     * Initialize the table: fetch data and render into the given element.
     */
    async initTable( elementId: string ): Promise< void > {
        const body = this.buildRequestBody();

        try {
            const response = await this.dataFetcher.fetchPoints(
                body,
                this.options.filterPoints
            );

            const table =
                this.options.tableElement ??
                document.getElementById( elementId );
            if ( ! table ) {
                return;
            }

            if ( response.error ) {
                this.renderTable( table, [], false );
                this.appendRow( table, [ '', 'No data found', '' ] );
                return;
            }

            if ( response.empty ) {
                this.renderTable( table, [], false );
                this.appendRow( table, [ '', 'No points to show yet', '' ] );
                return;
            }

            const points = Array.isArray( response ) ? response : [];
            const hasLocaltime = points.some( ( p ) => !! p.local_timezone );

            this.renderTable( table, points, hasLocaltime );

            if ( this.options.autoReload ) {
                this.startAutoReload( elementId, body, points );
            }
        } catch ( err ) {
            debugLog( !! this.options.debug, 'TableRenderer error:', err );
        }
    }

    /**
     * Render the table header and rows.
     */
    private renderTable(
        table: HTMLElement,
        points: SpotPoint[],
        hasLocaltime: boolean
    ): void {
        table.innerHTML = '';

        const showFeed = !! this.options.groupBy;
        const headers = showFeed
            ? [ 'Feed', 'Type', 'Message', 'Time' ]
            : [ 'Type', 'Message', 'Time' ];
        if ( hasLocaltime ) {
            headers.push( 'Local Time' );
        }

        // Header row
        const headerRow = document.createElement( 'tr' );
        for ( const header of headers ) {
            const th = document.createElement( 'th' );
            th.textContent = header;
            headerRow.appendChild( th );
        }
        table.appendChild( headerRow );

        // Data rows
        for ( const entry of points ) {
            this.appendPointRow( table, entry, hasLocaltime, showFeed );
        }
    }

    private appendPointRow(
        table: HTMLElement,
        entry: SpotPoint,
        hasLocaltime: boolean,
        showFeed: boolean = false
    ): void {
        const row = document.createElement( 'tr' );
        row.className = `spotmap ${ entry.type }`;

        if ( showFeed ) {
            const feedCell = document.createElement( 'td' );
            feedCell.textContent = entry.feed_name ?? '';
            row.appendChild( feedCell );
        }

        const typeCell = document.createElement( 'td' );
        typeCell.id = `spotmap_${ entry.id }`;
        typeCell.textContent = entry.type;

        const detail = {
            id: entry.id,
            lat: entry.latitude,
            lng: entry.longitude,
        };

        const panLink = document.createElement( 'a' );
        panLink.href = '#';
        panLink.className = 'spotmap-nav-link spotmap-nav-pan';
        panLink.textContent = 'pan';
        panLink.addEventListener( 'click', ( e ) => {
            e.preventDefault();
            e.stopPropagation();
            document.dispatchEvent(
                new CustomEvent( 'spotmap:click-point', { detail } )
            );
        } );

        const zoomLink = document.createElement( 'a' );
        zoomLink.href = '#';
        zoomLink.className = 'spotmap-nav-link spotmap-nav-zoom';
        zoomLink.textContent = 'zoom';
        zoomLink.addEventListener( 'click', ( e ) => {
            e.preventDefault();
            e.stopPropagation();
            document.dispatchEvent(
                new CustomEvent( 'spotmap:dblclick-point', { detail } )
            );
        } );

        typeCell.appendChild( document.createElement( 'br' ) );
        typeCell.appendChild( panLink );
        typeCell.appendChild( document.createTextNode( ' · ' ) );
        typeCell.appendChild( zoomLink );
        row.appendChild( typeCell );

        const messageCell = document.createElement( 'td' );
        messageCell.textContent = entry.message ?? '';
        row.appendChild( messageCell );

        const timeCell = document.createElement( 'td' );
        timeCell.innerHTML = `${ entry.time }<br>${ entry.date }`;
        row.appendChild( timeCell );

        if ( hasLocaltime ) {
            const localCell = document.createElement( 'td' );
            localCell.innerHTML = entry.local_timezone
                ? `${ entry.localtime ?? '' }<br>${ entry.localdate ?? '' }`
                : '';
            row.appendChild( localCell );
        }

        table.appendChild( row );
    }

    private appendRow( table: HTMLElement, cells: string[] ): void {
        const row = document.createElement( 'tr' );
        for ( const text of cells ) {
            const td = document.createElement( 'td' );
            td.textContent = text;
            row.appendChild( td );
        }
        table.appendChild( row );
    }

    /**
     * Set up periodic polling for new data.
     */
    private startAutoReload(
        elementId: string,
        body: AjaxRequestBody,
        initialPoints: SpotPoint[]
    ): void {
        let lastFirstUnixtime = initialPoints[ 0 ]?.unixtime ?? 0;

        const poll = ( delay: number ): void => {
            this.timeoutId = setTimeout( async () => {
                if ( document.hidden ) {
                    return;
                }

                try {
                    const response = await this.dataFetcher.fetchPoints(
                        body,
                        this.options.filterPoints
                    );

                    if ( ! response.error && ! response.empty ) {
                        const points = Array.isArray( response )
                            ? response
                            : [];
                        const newFirstUnixtime = points[ 0 ]?.unixtime ?? 0;

                        if ( newFirstUnixtime > lastFirstUnixtime ) {
                            lastFirstUnixtime = newFirstUnixtime;
                            const table =
                                this.options.tableElement ??
                                document.getElementById( elementId );
                            if ( table ) {
                                const scrollTop =
                                    table.parentElement?.scrollTop ?? 0;
                                const hasLocaltime = points.some(
                                    ( p ) => !! p.local_timezone
                                );
                                this.renderTable( table, points, hasLocaltime );
                                if ( table.parentElement ) {
                                    table.parentElement.scrollTop = scrollTop;
                                }
                            }
                        } else {
                            debugLog( !! this.options.debug, 'same response!' );
                        }
                    }

                    poll( TABLE_RELOAD_INTERVAL_MS );
                } catch ( err ) {
                    debugLog(
                        !! this.options.debug,
                        'TableRenderer reload error:',
                        err
                    );
                    poll( Math.min( delay * 2, MAX_RELOAD_BACKOFF_MS ) );
                }
            }, delay );
        };

        if ( this.onVisibilityChange ) {
            document.removeEventListener(
                'visibilitychange',
                this.onVisibilityChange
            );
        }
        this.onVisibilityChange = () => {
            if ( ! document.hidden ) {
                if ( this.timeoutId !== null ) {
                    clearTimeout( this.timeoutId );
                    this.timeoutId = null;
                }
                poll( 0 );
            }
        };
        document.addEventListener(
            'visibilitychange',
            this.onVisibilityChange
        );

        poll( TABLE_RELOAD_INTERVAL_MS );
    }

    private buildRequestBody(): AjaxRequestBody {
        return {
            action: 'spotmap_get_positions',
            feeds: this.options.feeds ?? '',
            'date-range': this.options.dateRange,
            date: this.options.date,
            orderBy: this.options.orderBy ?? 'time DESC',
            groupBy: this.options.groupBy ?? '',
            type: this.options.type,
            limit: this.options.limit,
        };
    }

    private static pointsHaveLocaltime( points: SpotPoint[] ): boolean {
        return points.some( ( p ) => !! p.local_timezone );
    }

    /**
     * Stop auto-reload polling.
     */
    destroy(): void {
        if ( this.timeoutId !== null ) {
            clearTimeout( this.timeoutId );
            this.timeoutId = null;
        }

        if ( this.onVisibilityChange ) {
            document.removeEventListener(
                'visibilitychange',
                this.onVisibilityChange
            );
            this.onVisibilityChange = null;
        }
    }
}
