import type { SpotmapOptions } from './types';
import type { BoundsManager } from './BoundsManager';

/**
 * Manages the easyButton navigation controls on the map.
 */
export class ButtonManager {
	private readonly map: L.Map;
	private readonly options: SpotmapOptions;
	private readonly boundsManager: BoundsManager;

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
		const buttons: L.Control[] = [];

		if ( this.options.navigationButtons !== false ) {
			buttons.push( this.createNavigationButton() );
		}

		if ( this.options.locateButton !== false ) {
			buttons.push( this.createLocateButton() );
		}

		if ( buttons.length > 0 ) {
			L.easyBar( buttons ).addTo( this.map );
		}
	}

	private createNavigationButton(): L.Control {
		const hasGpx =
			this.options.gpx && this.options.gpx.length > 0;

		return L.easyButton( {
			states: [
				{
					stateName: 'all',
					icon: 'fa-globe',
					title: 'Show all points',
					onClick: ( control ) => {
						this.boundsManager.fitBounds( 'all' );
						control.state( 'last' );
					},
				},
				{
					stateName: 'last',
					icon: 'fa-map-pin',
					title: 'Jump to last known location',
					onClick: ( control ) => {
						this.boundsManager.fitBounds( 'last' );
						control.state( hasGpx ? 'gpx' : 'all' );
					},
				},
				{
					stateName: 'gpx',
					icon: '<span class="target">Tr.</span>',
					title: 'Show GPX track(s)',
					onClick: ( control ) => {
						this.boundsManager.fitBounds( 'gpx' );
						control.state( 'all' );
					},
				},
			],
		} );
	}

	private createLocateButton(): L.Control {
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
