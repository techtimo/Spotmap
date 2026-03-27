import type { PointType } from './types';

/** Point types that represent tracking positions (rendered as small dots) */
export const TRACK_TYPES: PointType[] = [
    'UNLIMITED-TRACK',
    'EXTREME-TRACK',
    'TRACK',
];

/** Default marker colors */
export const DEFAULT_COLOR = 'blue';
export const DEFAULT_GPX_COLOR = 'gold';

/** Fallback map center when no data is available */
export const DEFAULT_CENTER: L.LatLngTuple = [ 51.505, -0.09 ];
export const DEFAULT_ZOOM = 13;

/** Auto-reload intervals in milliseconds */
export const AUTO_RELOAD_INTERVAL_MS = 30_000;
export const TABLE_RELOAD_INTERVAL_MS = 30_000;
export const MAX_RELOAD_BACKOFF_MS = 5 * 60_000;

/** BeautifyIcon dimensions for circle-dot shaped markers */
export const CIRCLE_DOT_ICON_SIZE: [ number, number ] = [ 8, 8 ];
export const CIRCLE_DOT_ICON_ANCHOR: [ number, number ] = [ 4, 4 ];
export const CIRCLE_DOT_BORDER_WIDTH = 8;

/** Zoom level when centering on a single point */
export const SINGLE_POINT_ZOOM = 14;

/** z-index offsets for marker layering */
export const Z_INDEX_TRACK = 0;
export const Z_INDEX_STATUS = 1000;
export const Z_INDEX_HELP = -2000;
export const Z_INDEX_EMERGENCY = -3000;

/** Feed name that contains media points (excluded from line drawing) */
export const MEDIA_FEED_NAME = 'media';

/** Arrow character used on polylines */
export const LINE_ARROW_CHAR = '  \u25BA  ';
export const LINE_ARROW_FONT_SIZE = 7;
export const LINE_ARROW_OFFSET = 2;
