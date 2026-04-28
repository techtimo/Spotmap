import type { SpotmapOptions, NavigationButtonsConfig } from './types';
import type { BoundsManager } from './BoundsManager';
import 'leaflet-easybutton';

/**
 * Manages the easyButton navigation controls on the map.
 */
export class ButtonManager {
    private readonly map: L.Map;
    private readonly options: SpotmapOptions;
    private readonly boundsManager: BoundsManager;
    private easyBar: L.Control | null = null;

    constructor(
        map: L.Map,
        options: SpotmapOptions,
        boundsManager: BoundsManager
    ) {
        this.map = map;
        this.options = options;
        this.boundsManager = boundsManager;
    }

    /**
     * Add navigation and locate buttons to the map.
     * Respects the `navigationButtons` and `locateButton` options.
     */
    addButtons(): void {
        const buttons = this.buildButtons(
            this.options.locateButton,
            this.options.navigationButtons
        );
        if ( buttons.length > 0 ) {
            this.easyBar = L.easyBar( buttons ).addTo( this.map );
        }
    }

    /**
     * Replace the button bar in-place without rebuilding the map.
     */
    updateButtons(
        locateButton: boolean | undefined,
        navigationButtons: NavigationButtonsConfig | undefined
    ): void {
        if ( this.easyBar ) {
            this.map.removeControl( this.easyBar );
            this.easyBar = null;
        }
        const buttons = this.buildButtons( locateButton, navigationButtons );
        if ( buttons.length > 0 ) {
            this.easyBar = L.easyBar( buttons ).addTo( this.map );
        }
    }

    private buildButtons(
        locateButton: boolean | undefined,
        navigationButtons: NavigationButtonsConfig | undefined
    ): L.Control.EasyButton[] {
        const buttons: L.Control.EasyButton[] = [];

        if ( navigationButtons?.enabled ) {
            const button = this.createNavigationButton( navigationButtons );
            if ( button ) {
                buttons.push( button );
            }
        }

        if ( locateButton !== false ) {
            buttons.push( this.createLocateButton() );
        }

        return buttons;
    }

    private createNavigationButton(
        navOpts: NavigationButtonsConfig
    ): L.Control.EasyButton | null {
        const hasGpx = !! ( this.options.gpx && this.options.gpx.length > 0 );

        const STATE_DEFS: Array< {
            key: keyof NavigationButtonsConfig;
            stateName: string;
            icon: string;
            title: string;
            target: 'all' | 'last' | 'gpx';
            needsGpx?: boolean;
        } > = [
            {
                key: 'allPoints',
                stateName: 'all',
                icon: 'fa-globe',
                title: 'Show all points',
                target: 'all',
            },
            {
                key: 'latestPoint',
                stateName: 'last',
                icon: 'fa-map-pin',
                title: 'Jump to last known location',
                target: 'last',
            },
            {
                key: 'gpxTracks',
                stateName: 'gpx',
                icon: '<span class="target">Tr.</span>',
                title: 'Show GPX track(s)',
                target: 'gpx',
                needsGpx: true,
            },
        ];

        const active = STATE_DEFS.filter(
            ( s ) => navOpts[ s.key ] !== false && ( ! s.needsGpx || hasGpx )
        );

        if ( active.length === 0 ) {
            return null;
        }

        const states: L.EasyButtonState[] = active.map( ( s, i ) => {
            const nextName = active[ ( i + 1 ) % active.length ].stateName;
            return {
                stateName: s.stateName,
                icon: s.icon,
                title: s.title,
                onClick: ( control: L.Control.EasyButton ) => {
                    this.boundsManager.fitBounds( s.target );
                    control.state( nextName );
                },
            } as L.EasyButtonState;
        } );

        return L.easyButton( { states } );
    }

    private createLocateButton(): L.Control.EasyButton {
        return L.easyButton( {
            states: [
                {
                    stateName: 'locate',
                    icon: 'fa-location-arrow',
                    title: 'Jump to your location',
                    onClick: () => {
                        this.map.locate( {
                            setView: true,
                            maxZoom: 15,
                        } );
                    },
                },
            ],
        } );
    }
}
