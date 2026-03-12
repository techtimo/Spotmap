import { useEffect, useRef, useState } from '@wordpress/element';
import {
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
	FormTokenField,
	Button,
	RangeControl,
	DateTimePicker,
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

	// On first insert, populate feeds from server defaults
	useEffect( () => {
		// On first insert, populate feeds from server defaults and wait
		// for the re-render with the populated attributes before init.
		if (
			attributes.feeds.length === 0 &&
			window.spotmapjsobj?.feeds
		) {
			const feedNames = Array.isArray( window.spotmapjsobj.feeds )
				? window.spotmapjsobj.feeds
				: Object.keys( window.spotmapjsobj.feeds );

			const defaultStyles = {};
			feedNames.forEach( ( name ) => {
				defaultStyles[ name ] = { color: 'blue', splitLines: 0 };
			} );

			setAttributes( {
				feeds: feedNames,
				styles: defaultStyles,
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

	return (
		<>
			<InspectorControls>
				{ /* General Settings */ }
				<PanelBody title={ __( 'General Settings' ) } initialOpen>
					<FormTokenField
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Feeds' ) }
						suggestions={ availableFeeds }
						value={ attributes.feeds }
						onChange={ ( value ) =>
							setAttributes( { feeds: value } )
						}
					/>
					<FormTokenField
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Maps' ) }
						suggestions={ availableMaps }
						value={ attributes.maps }
						onChange={ ( value ) =>
							setAttributes( { maps: value } )
						}
					/>
					{ availableOverlays.length > 0 && (
						<FormTokenField
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Overlays' ) }
							suggestions={ availableOverlays }
							value={ attributes.mapOverlays }
							onChange={ ( value ) =>
								setAttributes( { mapOverlays: value } )
							}
						/>
					) }
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

				{ /* Experimental */ }
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
