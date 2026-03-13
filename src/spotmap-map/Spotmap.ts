import type {
	SpotmapOptions,
	SpotmapLayers,
	AjaxRequestBody,
	AjaxResponse,
	TableOptions,
	MapCenter,
} from './types';
import {
	DEFAULT_CENTER,
	DEFAULT_ZOOM,
	AUTO_RELOAD_INTERVAL_MS,
	SINGLE_POINT_ZOOM,
} from './constants';
import { debug as debugLog, getColorDot } from './utils';
import { DataFetcher } from './DataFetcher';
import { LayerManager } from './LayerManager';
import { MarkerManager } from './MarkerManager';
import { LineManager } from './LineManager';
import { BoundsManager } from './BoundsManager';
import { ButtonManager } from './ButtonManager';
import { TableRenderer } from './TableRenderer';

/**
 * Main Spotmap orchestrator.
 *
 * Coordinates map initialization, data fetching, and all sub-managers.
 * Used both in the Gutenberg editor preview and the public frontend.
 */
export class Spotmap {
	readonly options: SpotmapOptions;
	map!: L.Map;
	layers: SpotmapLayers = { feeds: {}, gpx: {} };

	private dataFetcher!: DataFetcher;
	private layerManager!: LayerManager;
	private markerManager!: MarkerManager;
	private lineManager!: LineManager;
	private boundsManager!: BoundsManager;
	private buttonManager!: ButtonManager;
	private tableRenderer: TableRenderer | null = null;

	private _destroyed = false;
	private autoReloadIntervalId: ReturnType< typeof setInterval > | null =
		null;

	constructor( options: SpotmapOptions ) {
		if ( ! options.maps ) {
			console.error( 'Missing important options!!' ); // eslint-disable-line no-console
		}
		this.options = options;
		this.debug( 'Spotmap obj created.' );
		this.debug( this.options );
	}

	/**
	 * Initialize the Leaflet map and load data.
	 */
	async initMap(): Promise< void > {
		const el =
			this.options.mapElement ??
			document.getElementById( this.options.mapId ?? '' );

		if ( ! el ) {
			throw new Error( 'Map container not found.' );
		}

		el.style.height = `${ this.options.height }px`;

		// If the element already has a Leaflet map and options haven't changed,
		// skip re-initialization.
		const oldOptions = ( el as HTMLElement & { _spotmapOptions?: SpotmapOptions } )._spotmapOptions;
		( el as HTMLElement & { _spotmapOptions?: SpotmapOptions } )._spotmapOptions = this.options;

		if (
			( el as HTMLElement & { _leaflet_id?: number } )._leaflet_id
		) {
			if (
				JSON.stringify( this.options ) ===
				JSON.stringify( oldOptions )
			) {
				return;
			}
			// Reset the Leaflet instance on the element
			( el as HTMLElement & { _leaflet_id?: number | null } )._leaflet_id = null;
			// Clear child panes
			el.querySelectorAll( '.leaflet-control-container' ).forEach(
				( c ) => {
					c.innerHTML = '';
				}
			);
			el.querySelectorAll( '.leaflet-pane' ).forEach( ( p ) => {
				p.innerHTML = '';
			} );
		}

		// Create the Leaflet map
		this.map = L.map( el, {
			scrollWheelZoom: this.options.scrollWheelZoom ?? false,
			attributionControl: false,
			dragging: this.options.enablePanning ?? true,
			zoomControl: this.options.zoomControl ?? true,
		} );

		// Optional controls
		if ( this.options.fullscreenButton !== false ) {
			new L.Control.FullScreen().addTo( this.map );
		}
		if ( this.options.scaleControl !== false ) {
			L.control.scale().addTo( this.map );
		}

		// Enable scroll wheel zoom on focus
		this.map.once( 'focus', () => {
			this.map.scrollWheelZoom.enable();
		} );

		// Initialize sub-managers
		this.dataFetcher = new DataFetcher( spotmapjsobj.ajaxUrl );
		this.layerManager = new LayerManager(
			this.map,
			this.options,
			this.layers
		);
		this.markerManager = new MarkerManager(
			this.map,
			this.layers,
			this.layerManager
		);
		this.lineManager = new LineManager(
			this.layers,
			this.layerManager
		);
		this.boundsManager = new BoundsManager(
			this.map,
			this.layers
		);
		this.buttonManager = new ButtonManager(
			this.map,
			this.options,
			this.boundsManager
		);


		// Add tile layers and controls
		this.layerManager.addBaseLayers();
		this.buttonManager.addButtons();
		this.layerManager.layerControl.addTo( this.map );

		// Fetch and render data
		const body: AjaxRequestBody = {
			action: 'get_positions',
			select: '*',
			feeds: this.options.feeds ?? '',
			'date-range': this.options.dateRange,
			date: this.options.date,
			orderBy: 'feed_name, time',
			groupBy: '',
		};

		try {
			const response = await this.dataFetcher.fetchPoints(
				body,
				this.options.filterPoints
			);

			if ( this._destroyed || ! this.map ) {
				return;
			}

			if ( ! response.empty ) {
				for ( const entry of response as import( './types' ).SpotPoint[] ) {
					this.ensureFeedLayer( entry.feed_name );
					this.markerManager.addPoint( entry );
					this.lineManager.addPointToLine( entry );
				}
			}

			this.loadGpxTracks( response );
			this.layerManager.addFeedsToMap();

			if (
				response.empty &&
				( ! this.options.gpx || this.options.gpx.length === 0 )
			) {
				this.showEmptyState();
			} else {
				this.boundsManager.fitBounds(
					this.options.mapcenter
				);
			}

			this.layerManager.addOverlays();

			if (
				this.options.autoReload &&
				! response.empty
			) {
				this.startAutoReload( body );
			}
		} catch ( err ) {
			this.debug( 'Error loading map data:' );
			this.debug( err );
		}
	}

	/**
	 * Initialize the [spotmessages] table view.
	 */
	async initTable( elementId: string ): Promise< void > {
		const tableOptions: TableOptions = {
			feeds: this.options.feeds,
			dateRange: this.options.dateRange,
			date: this.options.date,
			autoReload: this.options.autoReload,
			filterPoints: this.options.filterPoints,
			debug: this.options.debug,
			...( ( this.options as unknown as TableOptions ).type && {
				type: ( this.options as unknown as TableOptions ).type,
			} ),
			...( ( this.options as unknown as TableOptions ).orderBy && {
				orderBy: ( this.options as unknown as TableOptions )
					.orderBy,
			} ),
			...( ( this.options as unknown as TableOptions ).limit && {
				limit: ( this.options as unknown as TableOptions ).limit,
			} ),
			...( ( this.options as unknown as TableOptions ).groupBy && {
				groupBy: ( this.options as unknown as TableOptions )
					.groupBy,
			} ),
		};

		this.dataFetcher = new DataFetcher( spotmapjsobj.ajaxUrl );
		this.tableRenderer = new TableRenderer(
			tableOptions,
			this.dataFetcher
		);
		await this.tableRenderer.initTable( elementId );
	}

	/**
	 * Clean up all resources: intervals, event listeners, map instance.
	 */
	destroy(): void {
		this._destroyed = true;

		if ( this.autoReloadIntervalId !== null ) {
			clearInterval( this.autoReloadIntervalId );
			this.autoReloadIntervalId = null;
		}

		this.tableRenderer?.destroy();
		this.markerManager?.destroy();
		this.dataFetcher?.abort();

		if ( this.map ) {
			this.map.remove();
		}
	}

	// ------- Private helpers -------

	private ensureFeedLayer( feedName: string ): void {
		if ( ! this.layerManager.doesFeedExist( feedName ) ) {
			const line = this.lineManager.createLine( feedName );
			this.layerManager.initFeedLayer( feedName, line );
		}
	}

	private loadGpxTracks( response: AjaxResponse ): void {
		if ( ! this.options.gpx ) {
			return;
		}

		for ( const entry of this.options.gpx ) {
			const color = this.layerManager.getGpxColor(
				entry.color
			);
			const gpxOptions = {
				async: true,
				marker_options: {
					wptIcons: {
						'': this.markerManager.getMarkerIcon( {
							color,
						} ),
					},
					wptIconsType: {
						'': this.markerManager.getMarkerIcon( {
							color,
						} ),
					},
					startIconUrl: '',
					endIconUrl: '',
					shadowUrl:
						spotmapjsobj.url +
						'leaflet-gpx/pin-shadow.png',
				},
				polyline_options: { color },
			};

			const track = new L.GPX( entry.url, gpxOptions )
				.on( 'loaded', () => {
					if (
						this.options.mapcenter === 'gpx' ||
						response.empty
					) {
						this.boundsManager.fitBounds( 'gpx' );
					}
				} )
				.on( 'addline', ( e: L.LeafletEvent ) => {
					( e as L.LeafletEvent & { line: L.Polyline } ).line.bindPopup( entry.title );
				} );

			const html = ` ${ getColorDot( color ) }`;
			this.layers.gpx[ entry.title ] = {
				featureGroup: L.featureGroup( [ track ] ),
			};
			this.layers.gpx[ entry.title ].featureGroup.addTo(
				this.map
			);
			this.layerManager.layerControl.addOverlay(
				this.layers.gpx[ entry.title ].featureGroup,
				entry.title + html
			);
		}
	}

	private showEmptyState(): void {
		this.map.setView( DEFAULT_CENTER, DEFAULT_ZOOM );
		L.popup()
			.setLatLng( [ DEFAULT_CENTER[ 0 ] + 0.008, DEFAULT_CENTER[ 1 ] ] )
			.setContent( 'There is nothing to show here yet.' )
			.openOn( this.map );
	}

	private startAutoReload( body: AjaxRequestBody ): void {
		const reloadBody: AjaxRequestBody = {
			...body,
			groupBy: 'feed_name',
			orderBy: 'time DESC',
		};

		this.autoReloadIntervalId = setInterval( async () => {
			try {
				const response = await this.dataFetcher.fetchPoints(
					reloadBody,
					this.options.filterPoints
				);

				if ( response.error || response.empty ) {
					return;
				}

				for ( const entry of response as import( './types' ).SpotPoint[] ) {
					const feedName = entry.feed_name;
					const feed = this.layers.feeds[ feedName ];
					if ( ! feed ) {
						continue;
					}

					const lastPoint = feed.points.at( -1 );
					if (
						lastPoint &&
						lastPoint.unixtime < entry.unixtime
					) {
						this.debug(
							`Found a new point for Feed: ${ feedName }`
						);
						this.markerManager.addPoint( entry );
						this.lineManager.addPointToLine( entry );

						if (
							this.options.mapcenter === 'last'
						) {
							this.map.setView(
								[
									entry.latitude,
									entry.longitude,
								],
								SINGLE_POINT_ZOOM
							);
						}
					}
				}
			} catch ( err ) {
				this.debug( 'Auto-reload error:' );
				this.debug( err );
			}
		}, AUTO_RELOAD_INTERVAL_MS );
	}

	private debug( ...args: unknown[] ): void {
		debugLog( !! this.options?.debug, ...args );
	}
}
