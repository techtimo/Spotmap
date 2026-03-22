import type {
	SpotmapOptions,
	SpotmapLayers,
	FeedLayer,
	FeedStyle,
} from './types';
import { DEFAULT_COLOR, DEFAULT_GPX_COLOR } from './constants';
import { getColorDot } from './utils';

/**
 * Manages tile layers, overlays, feed layer groups, and the layer control.
 */
export class LayerManager {
	private readonly map: L.Map;
	private readonly options: SpotmapOptions;
	private readonly layers: SpotmapLayers;
	readonly layerControl: L.Control.Layers;

	constructor( map: L.Map, options: SpotmapOptions, layers: SpotmapLayers ) {
		this.map = map;
		this.options = options;
		this.layers = layers;
		this.layerControl = L.control.layers(
			{},
			{},
			{ hideSingleBase: true }
		);
	}

	/**
	 * Add base tile layers from the maps option.
	 */
	addBaseLayers(): void {
		if ( ! this.options.maps ) {
			return;
		}

		let firstAdded = false;

		for ( const mapName of this.options.maps ) {
			const config = spotmapjsobj.maps[ mapName ];
			if ( ! config ) {
				continue;
			}

			const layer = this.createTileLayer( config );
			this.layerControl.addBaseLayer( layer, config.label );

			if ( ! firstAdded ) {
				layer.addTo( this.map );
				firstAdded = true;
			}
		}
	}

	/**
	 * Add overlay tile layers from the mapOverlays option.
	 */
	addOverlays(): void {
		if ( ! this.options.mapOverlays ) {
			return;
		}

		for ( const overlayName of this.options.mapOverlays ) {
			const config = spotmapjsobj.overlays[ overlayName ];
			if ( ! config ) {
				continue;
			}

			const layer = this.createTileLayer( config );
			layer.addTo( this.map );
			this.layerControl.addOverlay( layer, config.label );
		}
	}

	private createTileLayer(
		config: import('./types').TileLayerConfig
	): L.TileLayer | L.TileLayer.WMS {
		return config.wms
			? L.tileLayer.wms( config.url, config.options as L.WMSOptions )
			: L.tileLayer( config.url, config.options as L.TileLayerOptions );
	}

	/**
	 * Check if a feed layer already exists.
	 */
	doesFeedExist( feedName: string ): boolean {
		return feedName in this.layers.feeds;
	}

	/**
	 * Initialize a new empty feed layer group.
	 * Returns false if the feed already exists.
	 */
	initFeedLayer( feedName: string, initialLine: L.Polyline ): boolean {
		if ( this.doesFeedExist( feedName ) ) {
			return false;
		}

		const featureGroup = L.featureGroup();
		featureGroup.addLayer( initialLine );

		this.layers.feeds[ feedName ] = {
			lines: [ initialLine ],
			markers: [],
			points: [],
			featureGroup,
		};

		return true;
	}

	/**
	 * Add all feed layers to the map and layer control.
	 */
	addFeedsToMap(): void {
		const feedNames = Object.keys( this.layers.feeds );

		for ( const feedName of feedNames ) {
			const feed = this.layers.feeds[ feedName ];

			// Respect per-feed visibility — still register in layer control
			// so the public user can toggle the feed back on.
			if ( this.isFeedVisible( feedName ) ) {
				feed.featureGroup.addTo( this.map );
			}

			const color = this.getFeedColor( feedName );
			const label = `${ feedName } ${ getColorDot( color ) }`;
			this.layerControl.addOverlay( feed.featureGroup, label );
		}
	}

	/**
	 * Get the color for a feed from the styles config.
	 */
	getFeedColor( feedName: string ): string {
		return this.options.styles[ feedName ]?.color ?? DEFAULT_COLOR;
	}

	/**
	 * Get the color for a GPX track.
	 */
	getGpxColor( gpxColor?: string ): string {
		return gpxColor ?? DEFAULT_GPX_COLOR;
	}

	/**
	 * Get the splitLines value (in hours) for a feed, or false if disabled.
	 */
	getFeedSplitLines( feedName: string ): number | false {
		const style: FeedStyle | undefined = this.options.styles[ feedName ];
		if ( ! style ) {
			return false;
		}
		if ( style.splitLinesEnabled === false ) {
			return false;
		}
		// Treat 0 as disabled (falsy), matching the old behaviour where
		// `if (!splitLines) return false` would short-circuit on 0.
		return style.splitLines || false;
	}

	/**
	 * Get the line width (px) for a feed's polylines.
	 */
	getFeedLineWidth( feedName: string ): number {
		return this.options.styles[ feedName ]?.lineWidth ?? 2;
	}

	/**
	 * Get the line opacity for a feed's polylines.
	 */
	getFeedLineOpacity( feedName: string ): number {
		return this.options.styles[ feedName ]?.lineOpacity ?? 1.0;
	}

	/**
	 * Whether a feed should be initially visible on the map.
	 * Unset (undefined) defaults to visible.
	 */
	isFeedVisible( feedName: string ): boolean {
		return this.options.styles[ feedName ]?.visible !== false;
	}

	/**
	 * Get the feed layer data for a given feed name.
	 */
	getFeedLayer( feedName: string ): FeedLayer | undefined {
		return this.layers.feeds[ feedName ];
	}
}
