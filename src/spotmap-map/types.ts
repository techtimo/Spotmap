/** Options passed from PHP via wp_localize_script (spotmapjsobj global) */
export interface SpotmapGlobal {
	ajaxUrl: string;
	maps: Record< string, TileLayerConfig >;
	overlays: Record< string, TileLayerConfig >;
	url: string;
	feeds: string[];
	defaultValues: Record< string, unknown >;
	marker: Record< string, MarkerTypeConfig >;
}

export interface TileLayerConfig {
	url: string;
	label: string;
	wms?: boolean;
	options: Record< string, unknown >;
}

export interface MarkerTypeConfig {
	iconShape: string;
	icon: string;
}

/**
 * Main options object — passed to `new Spotmap(options)`.
 *
 * Constructed from block attributes (render-block.php / edit.jsx)
 * or from shortcode parameters (class-spotmap-public.php).
 */
export interface SpotmapOptions {
	// Data sources
	feeds: string[];
	gpx: GpxTrackConfig[];

	// Map tile layers
	maps: string[];
	mapOverlays?: string[] | null;

	// Per-feed styling
	styles: Record< string, FeedStyle >;

	// Layout
	height: number;
	mapId?: string;
	mapElement?: HTMLElement;

	// Navigation & view
	mapcenter: MapCenter;
	filterPoints: number;
	lastPoint: boolean;

	// Behavior
	autoReload: boolean;
	debug: boolean;
	dateRange: DateRange;
	date?: string | null;

	// Map controls — all optional with sensible defaults
	scrollWheelZoom?: boolean;
	enablePanning?: boolean;
	zoomControl?: boolean;
	fullscreenButton?: boolean;
	scaleControl?: boolean;
	locateButton?: boolean;
	navigationButtons?: boolean;
}

export type MapCenter = 'all' | 'last' | 'last-trip' | 'gpx' | 'feeds';

export interface DateRange {
	from: string;
	to: string;
}

export interface FeedStyle {
	color: string;
	splitLines?: number | false;
	splitLinesEnabled?: boolean;
	lineWidth?: number;    // 1–6px, default 2
	lineOpacity?: number;  // 0.2–1.0, default 1.0
	visible?: boolean;     // default true (unset = visible)
}

export interface GpxTrackConfig {
	url: string;
	title: string;
	color?: string;
	visible?: boolean;   // default true (unset = visible)
	download?: boolean;  // default false — show download icon in layer control & popup
	id?: number;
}

/** A single GPS point returned from the server AJAX response */
export interface SpotPoint {
	id: number;
	feed_name: string;
	latitude: number;
	longitude: number;
	altitude: number;
	type: PointType;
	unixtime: number;
	time: string;
	date: string;
	localtime?: string;
	localdate?: string;
	local_timezone?: string;
	message?: string;
	battery_status?: string;
	messengerName?: string;
	hiddenPoints?: { count: number; radius: number };
}

export type PointType =
	| 'OK'
	| 'CUSTOM'
	| 'TRACK'
	| 'EXTREME-TRACK'
	| 'UNLIMITED-TRACK'
	| 'HELP'
	| 'HELP-CANCEL'
	| 'MEDIA'
	| 'NEWMOVEMENT'
	| 'SOS';

/** Internal structure for a feed's map layers */
export interface FeedLayer {
	lines: L.Polyline[];
	markers: L.Marker[];
	points: SpotPoint[];
	featureGroup: L.FeatureGroup;
}

/** Internal structure for a GPX track's map layers */
export interface GpxLayer {
	featureGroup: L.FeatureGroup;
}

/** All map layers managed by Spotmap */
export interface SpotmapLayers {
	feeds: Record< string, FeedLayer >;
	gpx: Record< string, GpxLayer >;
}

/** Options for the [spotmessages] shortcode table view */
export interface TableOptions
	extends Pick<
		SpotmapOptions,
		'feeds' | 'dateRange' | 'date' | 'autoReload' | 'filterPoints' | 'debug'
	> {
	type?: string[];
	orderBy?: string;
	limit?: number;
	groupBy?: string;
}

/** Body sent to the WordPress AJAX endpoint */
export interface AjaxRequestBody {
	action: string;
	select?: string;
	feeds: string[] | string;
	'date-range'?: DateRange;
	date?: string | null;
	orderBy: string;
	groupBy: string;
	type?: string[];
	limit?: number;
}

/** Error response shape from the server */
export interface AjaxErrorResponse {
	error: boolean;
	empty: boolean;
	title?: string;
	message?: string;
}

/** The AJAX response can be an array of points or an error/empty marker */
export type AjaxResponse = SpotPoint[] & { empty?: boolean; error?: boolean };
