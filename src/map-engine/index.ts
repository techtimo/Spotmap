// Leaflet core
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet plugins
import 'leaflet.fullscreen';
import 'leaflet.fullscreen/dist/Control.FullScreen.css';
import 'leaflet-gpx';
import 'leaflet-easybutton';
import 'leaflet-easybutton/src/easy-button.css';
import 'leaflet-textpath';
import 'beautifymarker';
import 'beautifymarker/leaflet-beautify-marker-icon.css';
import 'leaflet-tilelayer-swiss';

// Font Awesome & custom styles
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../css/custom.css';

import { Spotmap } from './Spotmap';

// Export for module consumers
export { Spotmap };
export type {
    SpotmapOptions,
    SpotPoint,
    SpotmapGlobal,
    FeedStyle,
    GpxTrackConfig,
    MapCenter,
    DateRange,
    TableOptions,
    PointType,
} from './types';

// Expose as globals for PHP inline scripts and the block editor.
// window.L restores the global that the old <script src="leaflet.js"> tag
// provided, so future Leaflet plugins loaded as separate script tags still work.
window.L = L;
window.Spotmap = Spotmap;
