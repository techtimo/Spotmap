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

// Expose as a global for PHP inline scripts and the block editor
window.Spotmap = Spotmap;
