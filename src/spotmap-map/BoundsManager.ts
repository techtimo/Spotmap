import type { MapCenter, SpotmapLayers } from './types';

/**
 * Calculates and applies map bounds for different view modes.
 */
export class BoundsManager {
	private readonly map: L.Map;
	private readonly layers: SpotmapLayers;

	constructor( map: L.Map, layers: SpotmapLayers ) {
		this.map = map;
		this.layers = layers;
	}

	/**
	 * Fit the map to the bounds for the given view mode.
	 */
	fitBounds( option: MapCenter ): void {
		const bounds = this.getBounds( option );
		if ( bounds.isValid() ) {
			this.map.fitBounds( bounds );
		}
	}

	/**
	 * Calculate bounds for the given view mode.
	 *
	 * @param option - 'all' | 'last' | 'last-trip' | 'gpx' | 'feeds'
	 */
	getBounds( option: MapCenter ): L.LatLngBounds {
		if ( option === 'last' || option === 'last-trip' ) {
			return this.getLastBounds( option );
		}

		const feedBounds = this.getFeedBounds();

		if ( option === 'feeds' ) {
			return feedBounds;
		}

		const gpxBounds = this.getGpxBounds();

		if ( option === 'gpx' ) {
			return gpxBounds;
		}

		// option === 'all'
		const allBounds = L.latLngBounds( [] );
		if ( feedBounds.isValid() ) {
			allBounds.extend( feedBounds );
		}
		if ( gpxBounds.isValid() ) {
			allBounds.extend( gpxBounds );
		}
		return allBounds;
	}

	private getLastBounds( option: 'last' | 'last-trip' ): L.LatLngBounds {
		let latestUnixtime = 0;
		let latestFeedName = '';

		for ( const [ feedName, feed ] of Object.entries(
			this.layers.feeds
		) ) {
			const lastPoint = feed.points.at( -1 );
			if ( lastPoint && lastPoint.unixtime > latestUnixtime ) {
				latestUnixtime = lastPoint.unixtime;
				latestFeedName = feedName;
			}
		}

		const latestPoint =
			this.layers.feeds[ latestFeedName ]?.points.at( -1 );
		if ( ! latestPoint ) {
			return L.latLngBounds( [] );
		}

		if ( option === 'last' ) {
			const bounds = L.latLngBounds( [] );
			bounds.extend( [ latestPoint.latitude, latestPoint.longitude ] );
			return bounds;
		}

		// 'last-trip': return the bounds of the last polyline for that feed
		const lastLine = this.layers.feeds[ latestFeedName ]?.lines.at( -1 );
		return lastLine ? lastLine.getBounds() : L.latLngBounds( [] );
	}

	private getFeedBounds(): L.LatLngBounds {
		const bounds = L.latLngBounds( [] );
		for ( const feed of Object.values( this.layers.feeds ) ) {
			const layerBounds = feed.featureGroup.getBounds();
			if ( layerBounds.isValid() ) {
				bounds.extend( layerBounds );
			}
		}
		return bounds;
	}

	private getGpxBounds(): L.LatLngBounds {
		const bounds = L.latLngBounds( [] );
		for ( const gpx of Object.values( this.layers.gpx ) ) {
			const layerBounds = gpx.featureGroup.getBounds();
			if ( layerBounds.isValid() ) {
				bounds.extend( layerBounds );
			}
		}
		return bounds;
	}
}
