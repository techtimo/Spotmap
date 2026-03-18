import { useEffect, useRef, useState } from '@wordpress/element';
import {
	BlockControls,
	InspectorControls,
	MediaUpload,
	useBlockProps,
} from '@wordpress/block-editor';
import {
	PanelBody,
	TextControl,
	ToggleControl,
	SelectControl,
	ColorPalette,
	Button,
	RangeControl,
	DateTimePicker,
	ToolbarGroup,
	ToolbarButton,
	Dropdown,
	CheckboxControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const COLORS = [
	{ name: 'black', color: 'black' },
	{ name: 'blue', color: 'blue' },
	{ name: 'gold', color: 'gold' },
	{ name: 'green', color: 'green' },
	{ name: 'grey', color: 'grey' },
	{ name: 'red', color: 'red' },
	{ name: 'violet', color: 'violet' },
	{ name: 'yellow', color: 'yellow' },
];

const DATE_PRESETS_FROM = [
	{ label: "don't filter", value: '' },
	{ label: 'last week', value: 'last-1-week' },
	{ label: 'last 10 days', value: 'last-10-days' },
	{ label: 'last 2 weeks', value: 'last-2-weeks' },
	{ label: 'last month', value: 'last-1-month' },
	{ label: 'last year', value: 'last-1-year' },
	{ label: 'a specific date', value: 'specific' },
];

const DATE_PRESETS_TO = [
	{ label: "don't filter", value: '' },
	{ label: 'last 30 minutes', value: 'last-30-minutes' },
	{ label: 'last hour', value: 'last-1-hour' },
	{ label: 'last 2 hours', value: 'last-2-hour' },
	{ label: 'last day', value: 'last-1-day' },
	{ label: 'a specific date', value: 'specific' },
];

// Inline SVG for the Maps toolbar button (no @wordpress/icons dependency needed)
const MAP_ICON = (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5">
		<path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" />
		<path d="M9 3v15M15 6v15" />
	</svg>
);

const DEFAULT_FEED_STYLE = {
	color: 'blue',
	splitLines: 0,
	lineWidth: 2,
	lineOpacity: 1.0,
	visible: true,
};

export default function Edit( { attributes, setAttributes } ) {
	const mapRef = useRef( null );
	const spotmapRef = useRef( null );
	const [ mapId ] = useState(
		() => 'spotmap-editor-' + Math.random().toString( 36 ).slice( 2, 10 )
	);

	// Inject Leaflet CSS into the editor document (handles iframe rendering)
	useEffect( () => {
		const el = mapRef.current;
		if ( ! el ) {
			return;
		}
		const doc = el.ownerDocument;
		const baseUrl = window.spotmapjsobj?.url || '';
		const cssFiles = [
			'leaflet/leaflet.css',
			'leafletfullscreen/leaflet.fullscreen.css',
			'leaflet-easy-button/easy-button.css',
			'leaflet-beautify-marker/leaflet-beautify-marker-icon.css',
			'css/custom.css',
			'../includes/css/font-awesome-all.min.css',
		];
		const links = cssFiles
			.filter(
				( file ) =>
					! doc.querySelector(
						`link[href="${ baseUrl + file }"]`
					)
			)
			.map( ( file ) => {
				const link = doc.createElement( 'link' );
				link.rel = 'stylesheet';
				link.href = baseUrl + file;
				doc.head.appendChild( link );
				return link;
			} );
		return () => links.forEach( ( l ) => l.remove() );
	}, [] );

	// On first insert, populate feeds and apply admin-configured defaults.
	useEffect( () => {
		if (
			attributes.feeds.length === 0 &&
			window.spotmapjsobj?.feeds
		) {
			const feedNames = Array.isArray( window.spotmapjsobj.feeds )
				? window.spotmapjsobj.feeds
				: Object.keys( window.spotmapjsobj.feeds );

			const defaultStyles = {};
			feedNames.forEach( ( name ) => {
				defaultStyles[ name ] = { ...DEFAULT_FEED_STYLE };
			} );

			// Read admin-configured defaults (set in Settings → Spotmap → Defaults tab)
			const dv = window.spotmapjsobj?.defaultValues ?? {};
			const defaultMaps = dv.maps
				? dv.maps.split( ',' ).map( ( m ) => m.trim() ).filter( Boolean )
				: attributes.maps;
			const defaultHeight = dv.height ? parseInt( dv.height, 10 ) : attributes.height;
			const defaultMapcenter = dv.mapcenter || attributes.mapcenter;

			setAttributes( {
				feeds: feedNames,
				styles: defaultStyles,
				maps: defaultMaps,
				height: defaultHeight,
				mapcenter: defaultMapcenter,
			} );
		}
	}, [] );

	// Initialize / update the Leaflet map via the existing Spotmap class
	useEffect( () => {
		const container = mapRef.current;
		if ( ! container || typeof window.Spotmap === 'undefined' ) {
			return;
		}

		const options = {
			...attributes,
			mapId,
			mapElement: container,
			height: attributes.height,
			enablePanning: false,
		};

		// Clean up previous map instance properly
		if ( spotmapRef.current ) {
			spotmapRef.current._destroyed = true;
			if ( spotmapRef.current.map?.remove ) {
				spotmapRef.current.map.remove();
			}
			spotmapRef.current = null;
		}

		let timer;
		try {
			const sm = new window.Spotmap( options );
			spotmapRef.current = sm;
			sm.initMap();
			// Leaflet needs a size recalc after the block wrapper settles
			timer = setTimeout( () => {
				if ( ! sm._destroyed ) {
					sm.map?.invalidateSize?.();
				}
			}, 200 );
		} catch ( e ) {
			console.error( 'Spotmap init error:', e );
		}

		return () => {
			clearTimeout( timer );
			if ( spotmapRef.current ) {
				spotmapRef.current._destroyed = true;
				if ( spotmapRef.current.map?.remove ) {
					spotmapRef.current.map.remove();
				}
				spotmapRef.current = null;
			}
		};
	}, [
		mapId,
		attributes.maps,
		attributes.feeds,
		attributes.styles,
		attributes.height,
		attributes.mapcenter,
		attributes.filterPoints,
		attributes.dateRange,
		attributes.gpx,
		attributes.mapOverlays,
		attributes.lastPoint,
		attributes.debug,
	] );

	const availableMaps = window.spotmapjsobj?.maps
		? Object.keys( window.spotmapjsobj.maps )
		: [];
	const availableOverlays = window.spotmapjsobj?.overlays
		? Object.keys( window.spotmapjsobj.overlays )
		: [];
	const availableFeeds = window.spotmapjsobj?.feeds
		? Array.isArray( window.spotmapjsobj.feeds )
			? window.spotmapjsobj.feeds
			: Object.keys( window.spotmapjsobj.feeds )
		: [];

	const updateStyle = ( feed, key, value ) => {
		const newStyles = { ...attributes.styles };
		newStyles[ feed ] = { ...( newStyles[ feed ] || {} ), [ key ]: value };
		setAttributes( { styles: newStyles } );
	};

	const toggleFeed = ( feed, checked ) => {
		const next = checked
			? [ ...attributes.feeds, feed ]
			: attributes.feeds.filter( ( f ) => f !== feed );
		const newStyles = { ...attributes.styles };
		if ( checked && ! newStyles[ feed ] ) {
			newStyles[ feed ] = { ...DEFAULT_FEED_STYLE };
		}
		setAttributes( { feeds: next, styles: newStyles } );
	};

	const toggleMap = ( mapKey, checked ) => {
		const next = checked
			? [ ...attributes.maps, mapKey ]
			: attributes.maps.filter( ( m ) => m !== mapKey );
		setAttributes( { maps: next } );
	};

	const toggleOverlay = ( overlayKey, checked ) => {
		const current = attributes.mapOverlays || [];
		const next = checked
			? [ ...current, overlayKey ]
			: current.filter( ( o ) => o !== overlayKey );
		setAttributes( { mapOverlays: next } );
	};

	const dateFromValue = attributes.dateRange?.from || '';
	const dateToValue = attributes.dateRange?.to || '';
	const isCustomDateFrom =
		dateFromValue === 'specific' ||
		( dateFromValue &&
			! DATE_PRESETS_FROM.find( ( o ) => o.value === dateFromValue ) );
	const isCustomDateTo =
		dateToValue === 'specific' ||
		( dateToValue &&
			! DATE_PRESETS_TO.find( ( o ) => o.value === dateToValue ) );

	const dropdownContentStyle = { padding: '8px', minWidth: '200px' };
	const checklistStyle = { display: 'flex', flexDirection: 'column', gap: '6px' };

	return (
		<>
			{ /* Block toolbar — Feeds / Maps+Overlays dropdowns */ }
			<BlockControls>
				<ToolbarGroup>
					<Dropdown
						renderToggle={ ( { isOpen, onToggle } ) => (
							<ToolbarButton
								label={ __( 'Feeds' ) }
								onClick={ onToggle }
								aria-expanded={ isOpen }
								icon="rss"
							>
								{ __( 'Feeds' ) }
							</ToolbarButton>
						) }
						renderContent={ () => (
							<div style={ dropdownContentStyle }>
								{ availableFeeds.length === 0 && (
									<p>{ __( 'No feeds configured.' ) }</p>
								) }
								<div style={ checklistStyle }>
									{ availableFeeds.map( ( feed ) => (
										<CheckboxControl
											key={ feed }
											__nextHasNoMarginBottom
											label={ feed }
											checked={ attributes.feeds.includes( feed ) }
											onChange={ ( checked ) =>
												toggleFeed( feed, checked )
											}
										/>
									) ) }
								</div>
							</div>
						) }
					/>
				</ToolbarGroup>
				<ToolbarGroup>
					<Dropdown
						renderToggle={ ( { isOpen, onToggle } ) => (
							<ToolbarButton
								label={ __( 'Maps' ) }
								onClick={ onToggle }
								aria-expanded={ isOpen }
								icon={ MAP_ICON }
							>
								{ __( 'Maps' ) }
							</ToolbarButton>
						) }
						renderContent={ () => (
							<div style={ dropdownContentStyle }>
								{ availableMaps.length === 0 && (
									<p>{ __( 'No maps available.' ) }</p>
								) }
								<div style={ checklistStyle }>
									{ availableMaps.map( ( mapKey ) => (
										<CheckboxControl
											key={ mapKey }
											__nextHasNoMarginBottom
											label={
												window.spotmapjsobj?.maps[ mapKey ]
													?.label ?? mapKey
											}
											checked={ attributes.maps.includes( mapKey ) }
											onChange={ ( checked ) =>
												toggleMap( mapKey, checked )
											}
										/>
									) ) }
								</div>
								{ availableOverlays.length > 0 && (
									<>
										<hr style={ { margin: '8px 0', border: 'none', borderTop: '1px solid #ddd' } } />
										<p style={ { margin: '0 0 6px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', color: '#757575' } }>
											{ __( 'Overlays' ) }
										</p>
										<div style={ checklistStyle }>
											{ availableOverlays.map( ( overlayKey ) => (
												<CheckboxControl
													key={ overlayKey }
													__nextHasNoMarginBottom
													label={
														window.spotmapjsobj?.overlays[
															overlayKey
														]?.label ?? overlayKey
													}
													checked={ (
														attributes.mapOverlays || []
													).includes( overlayKey ) }
													onChange={ ( checked ) =>
														toggleOverlay( overlayKey, checked )
													}
												/>
											) ) }
										</div>
									</>
								) }
							</div>
						) }
					/>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls>
				{ /* General Settings */ }
				<PanelBody title={ __( 'General Settings' ) } initialOpen>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Zoom to' ) }
						value={ attributes.mapcenter }
						options={ [
							{ label: 'All points', value: 'all' },
							{ label: 'Last trip', value: 'last-trip' },
							{ label: 'Latest point', value: 'last' },
							{ label: 'GPX tracks', value: 'gpx' },
						] }
						onChange={ ( value ) =>
							setAttributes( { mapcenter: value } )
						}
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Height (px)' ) }
						value={ attributes.height }
						onChange={ ( value ) =>
							setAttributes( { height: value } )
						}
						min={ 200 }
						max={ 1200 }
						step={ 50 }
					/>
				</PanelBody>

				{ /* Date filter */ }
				<PanelBody
					title={ __( 'Time filter' ) }
					initialOpen={ false }
				>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Show points from' ) }
						value={
							DATE_PRESETS_FROM.find(
								( o ) => o.value === dateFromValue
							)
								? dateFromValue
								: dateFromValue
									? dateFromValue
									: ''
						}
						options={
							dateFromValue &&
							! DATE_PRESETS_FROM.find(
								( o ) => o.value === dateFromValue
							) &&
							dateFromValue !== 'specific'
								? [
										...DATE_PRESETS_FROM,
										{
											label: dateFromValue,
											value: dateFromValue,
										},
									]
								: DATE_PRESETS_FROM
						}
						onChange={ ( value ) =>
							setAttributes( {
								dateRange: {
									...attributes.dateRange,
									from: value,
								},
							} )
						}
					/>
					{ isCustomDateFrom && (
						<DateTimePicker
							currentDate={ new Date() }
							onChange={ ( date ) =>
								setAttributes( {
									dateRange: {
										...attributes.dateRange,
										from: date,
									},
								} )
							}
						/>
					) }
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Show points to' ) }
						value={
							DATE_PRESETS_TO.find(
								( o ) => o.value === dateToValue
							)
								? dateToValue
								: dateToValue
									? dateToValue
									: ''
						}
						options={
							dateToValue &&
							! DATE_PRESETS_TO.find(
								( o ) => o.value === dateToValue
							) &&
							dateToValue !== 'specific'
								? [
										...DATE_PRESETS_TO,
										{
											label: dateToValue,
											value: dateToValue,
										},
									]
								: DATE_PRESETS_TO
						}
						onChange={ ( value ) =>
							setAttributes( {
								dateRange: {
									...attributes.dateRange,
									to: value,
								},
							} )
						}
					/>
					{ isCustomDateTo && (
						<DateTimePicker
							currentDate={ new Date() }
							onChange={ ( date ) =>
								setAttributes( {
									dateRange: {
										...attributes.dateRange,
										to: date,
									},
								} )
							}
						/>
					) }
				</PanelBody>

				{ /* Per-feed panels */ }
				{ attributes.feeds.map( ( feed ) => (
					<PanelBody
						key={ feed }
						title={ feed + ' Feed' }
						initialOpen={ false }
					>
						<ColorPalette
							colors={ COLORS }
							value={
								attributes.styles?.[ feed ]?.color || 'blue'
							}
							onChange={ ( value ) =>
								updateStyle( feed, 'color', value )
							}
							disableCustomColors
							clearable={ false }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Connect points with line' ) }
							checked={
								!! attributes.styles?.[ feed ]
									?.splitLinesEnabled
							}
							onChange={ ( value ) => {
								updateStyle(
									feed,
									'splitLinesEnabled',
									value
								);
								if (
									value &&
									! attributes.styles?.[ feed ]?.splitLines
								) {
									updateStyle( feed, 'splitLines', 12 );
								}
							} }
						/>
						{ attributes.styles?.[ feed ]?.splitLinesEnabled && (
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Split lines (hours)' ) }
								value={
									attributes.styles?.[ feed ]?.splitLines ||
									''
								}
								onChange={ ( value ) =>
									updateStyle( feed, 'splitLines', value )
								}
								help={ __(
									'Hours between points before starting a new line segment'
								) }
							/>
						) }
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Line width (px)' ) }
							value={
								attributes.styles?.[ feed ]?.lineWidth ?? 2
							}
							onChange={ ( value ) =>
								updateStyle( feed, 'lineWidth', value )
							}
							min={ 1 }
							max={ 6 }
							step={ 1 }
						/>
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Line opacity' ) }
							value={
								attributes.styles?.[ feed ]?.lineOpacity ?? 1.0
							}
							onChange={ ( value ) =>
								updateStyle( feed, 'lineOpacity', value )
							}
							min={ 0.2 }
							max={ 1.0 }
							step={ 0.1 }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Visible' ) }
							checked={
								attributes.styles?.[ feed ]?.visible !== false
							}
							onChange={ ( value ) =>
								updateStyle( feed, 'visible', value )
							}
						/>
					</PanelBody>
				) ) }

				{ /* GPX */ }
				<PanelBody title={ __( 'GPX' ) } initialOpen={ false }>
					<MediaUpload
						allowedTypes={ [ 'text/xml' ] }
						multiple
						value={ attributes.gpx.map( ( entry ) => entry.id ) }
						title={ __(
							'Choose GPX tracks (hold Ctrl to select multiple)'
						) }
						onSelect={ ( selection ) => {
							const gpxTracks = selection.map( ( track ) => ( {
								id: track.id,
								url: track.url,
								title: track.title,
								color:
									attributes.gpx[ 0 ]?.color || 'gold',
							} ) );
							setAttributes( { gpx: gpxTracks } );
						} }
						render={ ( { open } ) => (
							<Button variant="primary" onClick={ open }>
								{ __( 'Select from Media Library' ) }
							</Button>
						) }
					/>
					{ attributes.gpx.length > 0 && (
						<>
							<p>
								{ attributes.gpx
									.map( ( t ) => t.title )
									.join( ', ' ) }
							</p>
							<ColorPalette
								colors={ COLORS }
								value={
									attributes.gpx[ 0 ]?.color || 'gold'
								}
								onChange={ ( value ) => {
									const updated = attributes.gpx.map(
										( t ) => ( { ...t, color: value } )
									);
									setAttributes( { gpx: updated } );
								} }
								disableCustomColors={ false }
								clearable={ false }
							/>
						</>
					) }
				</PanelBody>

				{ /* Advanced */ }
				<PanelBody
					title={ __( 'Advanced' ) }
					initialOpen={ false }
				>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show last point' ) }
						checked={ attributes.lastPoint }
						onChange={ ( value ) =>
							setAttributes( { lastPoint: value } )
						}
						help={ __(
							'Highlight the latest point with a large marker'
						) }
					/>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Hide nearby points (meters)' ) }
						value={ attributes.filterPoints }
						onChange={ ( value ) =>
							setAttributes( {
								filterPoints: parseInt( value, 10 ) || 0,
							} )
						}
						help={ __(
							'Hide points within this radius to reduce clutter'
						) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Auto-reload' ) }
						checked={ attributes.autoReload }
						onChange={ ( value ) =>
							setAttributes( { autoReload: value } )
						}
						help={ __(
							'Refresh map data every 30 seconds without page reload'
						) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Debug' ) }
						checked={ attributes.debug }
						onChange={ ( value ) =>
							setAttributes( { debug: value } )
						}
					/>
				</PanelBody>
			</InspectorControls>

			<div
				{ ...useBlockProps( {
					style: {
						height: attributes.height + 'px',
						zIndex: 0,
						overflow: 'hidden',
						fontSize: 'initial',
						lineHeight: 'initial',
					},
				} ) }
			>
				<div
					ref={ mapRef }
					id={ mapId }
					style={ { height: '100%', width: '100%' } }
				/>
			</div>
		</>
	);
}
