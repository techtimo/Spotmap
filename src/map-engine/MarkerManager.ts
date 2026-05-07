import Mustache from 'mustache';
import type { SpotPoint, SpotmapLayers } from './types';
import { debug as debugLog } from './utils';
import { POPUP_TEMPLATE, buildView } from './popup-templates';
import {
    CIRCLE_DOT_ICON_SIZE,
    CIRCLE_DOT_ICON_ANCHOR,
    CIRCLE_DOT_BORDER_WIDTH,
    CIRCLE_DOT_RADIUS,
    CIRCLE_DOT_WEIGHT,
    Z_INDEX_TRACK,
    Z_INDEX_STATUS,
    Z_INDEX_HELP,
    SINGLE_POINT_ZOOM,
} from './constants';
import type { LayerManager } from './LayerManager';

/**
 * Manages marker creation, icon styling, and popup content.
 */
export class MarkerManager {
    private readonly map: L.Map;
    private readonly layers: SpotmapLayers;
    private readonly layerManager: LayerManager;
    private readonly canvasRenderer: L.Renderer;
    private readonly markerById = new Map<
        number,
        L.Marker | L.CircleMarker
    >();
    private readonly iconCache = new Map< string, L.Icon >();
    private readonly abortController = new AbortController();
    private readonly dbg: ( ...args: unknown[] ) => void;
    private readonly feedCount: number;

    constructor(
        map: L.Map,
        layers: SpotmapLayers,
        layerManager: LayerManager,
        canvasRenderer: L.Renderer,
        debugEnabled = false,
        feedCount = 1
    ) {
        this.canvasRenderer = canvasRenderer;
        this.map = map;
        this.layers = layers;
        this.layerManager = layerManager;
        this.dbg = ( ...args ) => debugLog( debugEnabled, ...args );
        this.feedCount = feedCount;

        const { signal } = this.abortController;
        document.addEventListener(
            'spotmap:click-point',
            ( e: Event ) => {
                const { id, lat, lng } = ( e as CustomEvent ).detail;
                const marker = this.markerById.get( id );
                if ( marker ) {
                    marker.togglePopup();
                    this.map.panTo( [ lat, lng ] );
                }
            },
            { signal }
        );
        document.addEventListener(
            'spotmap:dblclick-point',
            ( e: Event ) => {
                const { id, lat, lng } = ( e as CustomEvent ).detail;
                const marker = this.markerById.get( id );
                if ( marker ) {
                    marker.togglePopup();
                    this.map.setView( [ lat, lng ], SINGLE_POINT_ZOOM );
                }
            },
            { signal }
        );
    }

    /**
     * Add a point to the map as a marker.
     * Points whose admin-configured iconShape is 'circle-dot' are rendered as
     * canvas L.circleMarker (white fill, feed-color stroke) — all others use
     * the BeautifyIcon DOM marker path.
     */
    addPoint( point: SpotPoint ): void {
        const feedName = point.feed_name;
        const coordinates: L.LatLngTuple = [ point.latitude, point.longitude ];

        const feed = this.layers.feeds[ feedName ];
        if ( ! feed ) {
            this.dbg(
                `MarkerManager: unknown feed "${ feedName }" for point id=${ point.id } — skipped`
            );
            return;
        }

        const iconShape = this.getIconShape( point );
        const popupHtml = MarkerManager.getPopupHtml( point, this.feedCount );
        const popupOptions: L.PopupOptions = {
            autoPan: false,
            maxWidth: 280,
        };
        let marker: L.Marker | L.CircleMarker;

        if ( iconShape === 'circle-dot' ) {
            const color = this.layerManager.getFeedColor( feedName );
            marker = L.circleMarker( coordinates, {
                renderer: this.canvasRenderer,
                radius: CIRCLE_DOT_RADIUS,
                weight: CIRCLE_DOT_WEIGHT,
                color,
                fillColor: 'white',
                fillOpacity: 1,
            } ).bindPopup( popupHtml, popupOptions );
        } else {
            const markerOptions = this.getMarkerOptions( point );
            marker = L.marker( coordinates, markerOptions ).bindPopup(
                popupHtml,
                popupOptions
            );
        }

        marker.on( 'popupopen', ( e ) => {
            const popup = e.popup;
            const container = popup.getElement();
            if ( ! container ) {
                return;
            }

            // Build prev/next nav targets for POST and MEDIA popups.
            // Injection happens inside finalizePopup() so it survives popup.update().
            let prev: L.Marker | L.CircleMarker | null = null;
            let next: L.Marker | L.CircleMarker | null = null;
            if ( point.type === 'POST' || point.type === 'MEDIA' ) {
                const typeMarkers: ( L.Marker | L.CircleMarker )[] = [];
                for ( let i = 0; i < feed.points.length; i++ ) {
                    if ( feed.points[ i ].type === point.type ) {
                        typeMarkers.push( feed.markers[ i ] );
                    }
                }
                const idx = typeMarkers.indexOf( marker );
                prev = idx > 0 ? typeMarkers[ idx - 1 ] : null;
                next =
                    idx < typeMarkers.length - 1
                        ? typeMarkers[ idx + 1 ]
                        : null;
            }

            // Called after popup.update() so any re-render doesn't wipe our nav.
            const injectNav = () => {
                if ( ! ( prev || next ) ) return;
                const content = container.querySelector(
                    '.leaflet-popup-content'
                );
                if (
                    ! content ||
                    content.querySelector( '.spotmap-popup-nav' )
                )
                    return;
                const nav = document.createElement( 'div' );
                nav.className = 'spotmap-popup-nav';
                nav.style.cssText =
                    'display:flex;justify-content:space-between;margin-top:8px;border-top:1px solid #eee;padding-top:6px;';
                const makeBtn = (
                    label: string,
                    target: L.Marker | L.CircleMarker | null
                ) => {
                    const btn = document.createElement( 'button' );
                    btn.textContent = label;
                    btn.style.cssText = `background:none;border:none;font-size:20px;line-height:1;padding:0 6px;color:${
                        target ? '#007cba' : '#ccc'
                    };cursor:${ target ? 'pointer' : 'default' };`;
                    btn.disabled = ! target;
                    if ( target ) {
                        btn.addEventListener( 'click', () =>
                            target.openPopup()
                        );
                    }
                    return btn;
                };
                nav.appendChild( makeBtn( '‹', next ) );
                nav.appendChild( makeBtn( '›', prev ) );
                content.appendChild( nav );
            };

            // Pan once after the popup and any images have fully rendered.
            // autoPan is disabled on the popup to prevent Leaflet's premature
            // pan (5px default padding) from firing before we measure.
            const doPan = () => {
                const closeBtn = container.querySelector(
                    '.leaflet-popup-close-button'
                ) as HTMLElement | null;
                const topEl = closeBtn ?? container;
                const mapEl = this.map.getContainer();
                const mapRect = mapEl.getBoundingClientRect();
                const popupRect = container.getBoundingClientRect();
                const topRect = topEl.getBoundingClientRect();

                let dy = 0;
                let dx = 0;
                const pad = 10;

                if ( topRect.top < mapRect.top + pad ) {
                    dy = topRect.top - mapRect.top - pad;
                } else if ( popupRect.bottom > mapRect.bottom - pad ) {
                    dy = popupRect.bottom - mapRect.bottom + pad;
                }
                if ( popupRect.left < mapRect.left + pad ) {
                    dx = popupRect.left - mapRect.left - pad;
                } else if ( popupRect.right > mapRect.right - pad ) {
                    dx = popupRect.right - mapRect.right + pad;
                }

                if ( dx !== 0 || dy !== 0 ) {
                    this.map.panBy( [ dx, dy ] );
                }
            };

            const imgs = Array.from(
                container.querySelectorAll( 'img' )
            ).filter( ( img ) => ! img.complete );
            if ( imgs.length === 0 ) {
                injectNav();
                requestAnimationFrame( doPan );
            } else {
                let loaded = 0;
                imgs.forEach( ( img ) => {
                    img.addEventListener(
                        'load',
                        () => {
                            loaded++;
                            if ( loaded === imgs.length ) {
                                // Reposition the tip without replacing content
                                // (popup.update() would wipe our injected nav).
                                (
                                    popup as unknown as {
                                        _updatePosition?: () => void;
                                    }
                                 )._updatePosition?.();
                                injectNav();
                                requestAnimationFrame( doPan );
                            }
                        },
                        { once: true }
                    );
                    img.addEventListener(
                        'error',
                        () => {
                            loaded++;
                            if ( loaded === imgs.length ) {
                                injectNav();
                                requestAnimationFrame( doPan );
                            }
                        },
                        { once: true }
                    );
                } );
            }
        } );

        feed.points.push( point );
        feed.markers.push( marker );
        feed.featureGroup.addLayer( marker );
        this.markerById.set( point.id, marker );
    }

    /**
     * Resolve the iconShape for a point from admin config.
     */
    private getIconShape( point: SpotPoint ): string {
        const pointType = point.type;
        if ( pointType && spotmapjsobj.marker[ pointType ] ) {
            return spotmapjsobj.marker[ pointType ].iconShape;
        }
        if ( pointType === 'TRACK' ) {
            return spotmapjsobj.marker.TRACK?.iconShape ?? 'circle-dot';
        }
        return 'marker';
    }

    /**
     * Build marker options with the correct icon and z-index.
     */
    private getMarkerOptions( point: SpotPoint ): L.MarkerOptions {
        let zIndexOffset = Z_INDEX_TRACK;

        if ( point.type !== 'TRACK' ) {
            zIndexOffset = Z_INDEX_STATUS;
        }
        if ( [ 'HELP', 'HELP-CANCEL' ].includes( point.type ) ) {
            zIndexOffset = Z_INDEX_HELP;
        }

        return {
            icon: this.getMarkerIcon( point ),
            zIndexOffset,
        };
    }

    /**
     * Create a BeautifyIcon for a point or a GPX waypoint.
     *
     * @param point        - Either a SpotPoint (has feed_name/type) or a simple {color} object for GPX.
     * @param extraOptions - Additional BeautifyIcon options merged on top (e.g. className).
     */
    getMarkerIcon(
        point: SpotPoint | { color: string; feed_name?: string; type?: string },
        extraOptions: Partial< L.BeautifyIconOptions > = {}
    ): L.Icon {
        const color =
            ( 'color' in point ? point.color : undefined ) ??
            ( point.feed_name
                ? this.layerManager.getFeedColor( point.feed_name )
                : 'blue' );

        const iconOptions: L.BeautifyIconOptions = {
            textColor: color,
            borderColor: color,
        };

        const pointType = point.type;

        if ( pointType && spotmapjsobj.marker[ pointType ] ) {
            // Use the configured marker shape for this point type
            const config = spotmapjsobj.marker[ pointType ];
            iconOptions.iconShape = config.iconShape;
            iconOptions.icon = config.icon;

            if ( iconOptions.iconShape === 'circle-dot' ) {
                iconOptions.iconAnchor = CIRCLE_DOT_ICON_ANCHOR;
                iconOptions.iconSize = CIRCLE_DOT_ICON_SIZE;
                iconOptions.borderWith = CIRCLE_DOT_BORDER_WIDTH;
            } else if ( iconOptions.iconShape === 'circle' ) {
                iconOptions.popupAnchor = [ 0, -8 ];
            }
        } else if ( pointType === 'TRACK' ) {
            const trackMarker = spotmapjsobj.marker.TRACK;
            iconOptions.iconShape = trackMarker?.iconShape;
            iconOptions.icon = trackMarker?.icon;
            iconOptions.iconAnchor = CIRCLE_DOT_ICON_ANCHOR;
            iconOptions.iconSize = CIRCLE_DOT_ICON_SIZE;
            iconOptions.borderWith = CIRCLE_DOT_BORDER_WIDTH;
        } else {
            this.dbg(
                `MarkerManager: no marker config for type "${
                    pointType ?? '(none)'
                }" — using generic marker`
            );
            iconOptions.iconShape = 'marker';
            iconOptions.icon = 'circle';
        }

        // If the caller overrides iconShape, remove circle-dot-specific sizing
        // so it doesn't bleed through and affect the overridden shape.
        if (
            extraOptions.iconShape &&
            extraOptions.iconShape !== iconOptions.iconShape
        ) {
            delete iconOptions.iconAnchor;
            delete iconOptions.iconSize;
            delete iconOptions.borderWith;
        }

        const merged = { ...iconOptions, ...extraOptions };
        const cacheKey = JSON.stringify( merged );
        const cached = this.iconCache.get( cacheKey );
        if ( cached ) {
            return cached;
        }
        const icon = L.BeautifyIcon.icon( merged );
        this.iconCache.set( cacheKey, icon );
        return icon;
    }

    getMarkerForPoint( id: number ): L.Marker | L.CircleMarker | undefined {
        return this.markerById.get( id );
    }

    /**
     * Remove all document event listeners registered by this instance.
     */
    destroy(): void {
        this.abortController.abort();
        this.markerById.clear();
    }

    static getPopupHtml( entry: SpotPoint, feedCount = 1 ): string {
        return Mustache.render( POPUP_TEMPLATE, buildView( entry, feedCount ) );
    }
}
