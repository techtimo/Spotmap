import type { SpotmapLayers, SpotPoint } from './types';
import { debug as debugLog } from './utils';
import {
    LINE_ARROW_CHAR,
    LINE_ARROW_FONT_SIZE,
    LINE_ARROW_OFFSET,
    LINE_SMOOTH_FACTOR,
} from './constants';
import type { LayerManager } from './LayerManager';

/**
 * Manages polyline creation and the splitLines logic.
 */
export class LineManager {
    private readonly layers: SpotmapLayers;
    private readonly layerManager: LayerManager;
    private readonly dbg: ( ...args: unknown[] ) => void;
    private initialLoadComplete = false;

    constructor(
        layers: SpotmapLayers,
        layerManager: LayerManager,
        debugEnabled = false
    ) {
        this.layers = layers;
        this.layerManager = layerManager;
        this.dbg = ( ...args ) => debugLog( debugEnabled, ...args );
    }

    /**
     * Apply directional arrows to all existing lines and mark initial load as
     * complete so future lines (e.g. auto-reload splits) get arrows immediately.
     * Call this once after fitBounds() so setText() runs at the correct zoom.
     */
    applyArrows(): void {
        for ( const feed of Object.values( this.layers.feeds ) ) {
            for ( const line of feed.lines ) {
                this.applyTextPath( line );
            }
        }
        this.initialLoadComplete = true;
    }

    /**
     * Clear all textpath text from every line. Call before map.remove() so the
     * textpath plugin's _textRedraw no-ops during the removal's _updatePaths.
     */
    clearArrows(): void {
        for ( const feed of Object.values( this.layers.feeds ) ) {
            for ( const line of feed.lines ) {
                this.clearLineTextPath( line );
            }
        }
    }

    private clearLineTextPath( line: L.Polyline ): void {
        ( line as unknown as { setText: ( t: null ) => void } ).setText( null );
    }

    private applyTextPath( line: L.Polyline ): void {
        (
            line as unknown as {
                setText: (
                    text: string,
                    options: Record< string, unknown >
                ) => void;
            }
         ).setText( LINE_ARROW_CHAR, {
            repeat: true,
            offset: LINE_ARROW_OFFSET,
            attributes: {
                fill: 'black',
                'font-size': LINE_ARROW_FONT_SIZE,
            },
        } );
    }

    /**
     * Add a point to the appropriate polyline for its feed.
     * Handles line splitting when the time gap exceeds the splitLines threshold.
     *
     * @returns true if the point was added to a line, false if not (splitLines disabled or media feed).
     */
    addPointToLine( point: SpotPoint ): boolean {
        const feedName = point.feed_name;

        if ( point.type === 'MEDIA' ) {
            return false;
        }

        const coordinates: L.LatLngTuple = [ point.latitude, point.longitude ];

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
            const gapHours = (
                ( point.unixtime - lastPoint.unixtime ) /
                3600
            ).toFixed( 1 );
            this.dbg(
                `LineManager: line split for feed "${ feedName }" — gap ${ gapHours }h > threshold ${ splitLines }h`
            );
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
     * Create a polyline styled for the given feed.
     * Pass coords to pre-populate to avoid per-point redraws during initial load.
     * Omit coords for an empty line (used by addPointToLine for splits).
     */
    createLine( feedName: string, coords: L.LatLngTuple[] = [] ): L.Polyline {
        const color = this.layerManager.getFeedColor( feedName );
        const weight = this.layerManager.getFeedLineWidth( feedName );
        const opacity = this.layerManager.getFeedLineOpacity( feedName );
        const line = L.polyline( coords, {
            color,
            weight,
            opacity,
            smoothFactor: LINE_SMOOTH_FACTOR,
        } );

        // During initial load, arrows are deferred until applyArrows() is called
        // after fitBounds(). Lines created after that (e.g. auto-reload splits)
        // get arrows immediately.
        if ( this.initialLoadComplete ) {
            this.applyTextPath( line );
        }

        return line;
    }
}
