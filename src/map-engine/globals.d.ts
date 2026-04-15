import type * as Leaflet from 'leaflet';
import type { SpotmapGlobal } from './types';
import type { Spotmap } from './Spotmap';

declare global {
    interface Window {
        Spotmap: typeof Spotmap;
        spotmapjsobj: SpotmapGlobal;
        L: typeof Leaflet;
    }

    const spotmapjsobj: SpotmapGlobal;

    // Leaflet plugins (loaded as separate scripts by WordPress)
    namespace L {
        namespace BeautifyIcon {
            function icon( options: BeautifyIconOptions ): L.Icon;
        }

        interface BeautifyIconOptions {
            icon?: string;
            iconShape?: string;
            textColor?: string;
            borderColor?: string;
            iconAnchor?: [ number, number ];
            iconSize?: [ number, number ];
            borderWith?: number; // note: typo in upstream lib ("borderWith" not "borderWidth")
            className?: string;
            customClasses?: string;
        }

        class GPX extends L.FeatureGroup {
            constructor( url: string, options?: GPXOptions );
        }

        interface GPXOptions {
            async?: boolean;
            marker_options?: {
                wptIcons?: Record< string, L.Icon >;
                wptIconsType?: Record< string, L.Icon >;
                startIconUrl?: string;
                endIconUrl?: string;
                shadowUrl?: string;
            };
            polyline_options?: L.PolylineOptions;
        }

        function easyButton( options: EasyButtonOptions ): L.Control;

        interface EasyButtonState {
            stateName: string;
            icon: string;
            title: string;
            onClick: ( control: EasyButtonControl ) => void;
        }

        interface EasyButtonOptions {
            states: EasyButtonState[];
        }

        interface EasyButtonControl {
            state: ( name: string ) => void;
        }

        function easyBar( buttons: L.Control[] ): L.Control;

        namespace Control {
            class FullScreen extends L.Control {
                constructor( options?: Record< string, unknown > );
            }
        }
    }
}

export {};
