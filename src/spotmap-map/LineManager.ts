import type { SpotmapLayers, SpotPoint } from './types';
import {
	LINE_ARROW_CHAR,
	LINE_ARROW_FONT_SIZE,
	LINE_ARROW_OFFSET,
	MEDIA_FEED_NAME,
} from './constants';
import type { LayerManager } from './LayerManager';

/**
 * Manages polyline creation and the splitLines logic.
 */
export class LineManager {
	private readonly layers: SpotmapLayers;
	private readonly layerManager: LayerManager;

	constructor( layers: SpotmapLayers, layerManager: LayerManager ) {
		this.layers = layers;
		this.layerManager = layerManager;
	}

	/**
	 * Add a point to the appropriate polyline for its feed.
	 * Handles line splitting when the time gap exceeds the splitLines threshold.
	 *
	 * @returns true if the point was added to a line, false if not (splitLines disabled or media feed).
	 */
	addPointToLine( point: SpotPoint ): boolean {
		const feedName = point.feed_name;

		if ( feedName === MEDIA_FEED_NAME ) {
			return false;
		}

		const coordinates: L.LatLngTuple = [
			point.latitude,
			point.longitude,
		];

		const splitLines = this.layerManager.getFeedSplitLines( feedName );
		if ( splitLines === false ) {
			return false;
		}

		const feed = this.layers.feeds[ feedName ];
		const pointCount = feed.points.length;

		let lastPoint: SpotPoint | undefined;
		if ( pointCount >= 2 ) {
			lastPoint = feed.points[ pointCount - 2 ];
		}

		const splitThresholdSeconds = splitLines * 60 * 60;

		// If the time gap exceeds the threshold, start a new line
		if (
			lastPoint &&
			point.unixtime - lastPoint.unixtime >= splitThresholdSeconds
		) {
			const line = this.createLine( feedName );
			line.addLatLng( coordinates );
			feed.lines.push( line );
			feed.featureGroup.addLayer( line );
		} else {
			// Add to the current (last) line
			const currentLine = feed.lines[ feed.lines.length - 1 ];
			currentLine.addLatLng( coordinates );
		}

		return true;
	}

	/**
	 * Create an empty polyline styled for the given feed.
	 * Includes directional arrow text along the path.
	 */
	createLine( feedName: string ): L.Polyline {
		const color = this.layerManager.getFeedColor( feedName );
		const weight = this.layerManager.getFeedLineWidth( feedName );
		const opacity = this.layerManager.getFeedLineOpacity( feedName );
		const line = L.polyline( [], { color, weight, opacity } );

		// Add directional arrows using the TextPath plugin
		( line as unknown as { setText: ( text: string, options: Record< string, unknown > ) => void } ).setText(
			LINE_ARROW_CHAR,
			{
				repeat: true,
				offset: LINE_ARROW_OFFSET,
				attributes: {
					fill: 'black',
					'font-size': LINE_ARROW_FONT_SIZE,
				},
			}
		);

		return line;
	}
}
