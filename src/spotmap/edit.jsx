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
	Modal,
	Popover,
	__experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { brush, calendar, settings, upload, trash } from '@wordpress/icons';
import { uploadMedia } from '@wordpress/media-utils';
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

// Inline SVG for the Maps toolbar button
const MAP_ICON = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
	>
		<path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" />
		<path d="M9 3v15M15 6v15" />
	</svg>
);

// Satellite icon (inline SVG)
const SATELLITE_ICON = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="20"
		height="20"
		fill="currentColor"
	>
		<g transform="rotate(45 12 12)">
			{ /* Left solar panel */ }
			<rect x="1.5" y="10.5" width="5" height="3" rx="0.4" />
			{ /* Right solar panel */ }
			<rect x="17.5" y="10.5" width="5" height="3" rx="0.4" />
			{ /* Body */ }
			<rect x="8" y="9" width="8" height="6" rx="1" />
		</g>
		{ /* Signal arcs, bottom-left */ }
		<path
			d="M5 19 Q2.5 16.5 5 14"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
		<path
			d="M3.5 20.5 Q-0.5 16.5 3.5 12.5"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
		<path
			d="M7 17.5 Q5.5 16 7 14.5"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
	</svg>
);

const DEFAULT_FEED_STYLE = {
	color: 'blue',
	splitLines: 0,
	lineWidth: 2,
	lineOpacity: 1.0,
	visible: true,
};

// Returns options for a date SelectControl, appending a custom value entry if needed.
const buildDateOptions = ( value, presets ) =>
	value &&
	! presets.find( ( o ) => o.value === value ) &&
	value !== 'specific'
		? [ ...presets, { label: value, value } ]
		: presets;

// Reusable section header for popovers.
const SectionHeader = ( { label } ) => (
	<p
		style={ {
			margin: '0 0 8px',
			fontWeight: 600,
			fontSize: '11px',
			textTransform: 'uppercase',
			color: '#757575',
		} }
	>
		{ label }
	</p>
);

// Reusable divider line.
const Divider = ( { spaced = false } ) => (
	<hr
		style={ {
			margin: spaced ? '8px 0' : 0,
			border: 'none',
			borderTop: '1px solid #ddd',
		} }
	/>
);

// Toggle with a flyout sub-popover that reveals on hover.
function NavigationButtonsControl( { value, onChange } ) {
	const [ open, setOpen ] = useState( false );
	const anchorRef = useRef( null );
	const closeTimer = useRef( null );
	const update = ( key, v ) => onChange( { ...value, [ key ]: v } );

	const scheduleClose = () => {
		closeTimer.current = setTimeout( () => setOpen( false ), 150 );
	};
	const cancelClose = () => {
		if ( closeTimer.current ) {
			clearTimeout( closeTimer.current );
		}
	};

	return (
		<div
			ref={ anchorRef }
			onMouseEnter={ () => {
				cancelClose();
				setOpen( true );
			} }
			onMouseLeave={ scheduleClose }
		>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Zoom-to navigation buttons' ) }
				checked={ value.enabled }
				onChange={ ( v ) => update( 'enabled', v ) }
			/>
			{ open && (
				<Popover
					anchor={ anchorRef.current }
					placement="left-end"
					focusOnMount={ false }
					onClose={ () => setOpen( false ) }
				>
					<div
						style={ {
							padding: '8px 12px',
							display: 'flex',
							flexDirection: 'column',
							gap: '4px',
							minWidth: '140px',
						} }
						onMouseEnter={ cancelClose }
						onMouseLeave={ scheduleClose }
					>
						<SectionHeader label={ __( 'Show buttons' ) } />
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'All points' ) }
							checked={ value.allPoints }
							onChange={ ( v ) => update( 'allPoints', v ) }
						/>
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'Latest point' ) }
							checked={ value.latestPoint }
							onChange={ ( v ) => update( 'latestPoint', v ) }
						/>
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'GPX tracks' ) }
							checked={ value.gpxTracks }
							onChange={ ( v ) => update( 'gpxTracks', v ) }
						/>
					</div>
				</Popover>
			) }
		</div>
	);
}

const GPX_PAGE_SIZE = 10;

// GPX manager modal — central hub for managing GPX tracks.
function GpxManagerModal( {
	gpx,
	onAdd,
	onUpload,
	onRemoveAll,
	onRemoveOne,
	setAttributes,
	onClose,
} ) {
	const uploadInputRef = useRef( null );
	const [ page, setPage ] = useState( 0 );
	const [ isDragging, setIsDragging ] = useState( false );
	const [ styleTarget, setStyleTarget ] = useState( null );
	const dragCounter = useRef( 0 );

	const updateGpxProp = ( key, value ) => {
		const updated =
			styleTarget === 'all'
				? gpx.map( ( t ) => ( { ...t, [ key ]: value } ) )
				: gpx.map( ( t, i ) =>
						i === styleTarget ? { ...t, [ key ]: value } : t
				  );
		setAttributes( { gpx: updated } );
	};

	const totalPages = Math.ceil( gpx.length / GPX_PAGE_SIZE );
	// Clamp page when tracks are removed and current page becomes empty.
	const safePage = Math.min( page, Math.max( 0, totalPages - 1 ) );
	const pageStart = safePage * GPX_PAGE_SIZE;
	const pageTracks = gpx.slice( pageStart, pageStart + GPX_PAGE_SIZE );

	const uploadFiles = ( files ) => {
		if ( ! files || ! files.length ) {
			return;
		}
		uploadMedia( {
			filesList: files,
			allowedTypes: [ 'text/xml' ],
			onFileChange: ( uploaded ) => {
				onUpload( uploaded.filter( ( f ) => ! f.errorCode ) );
			},
			onError: () => {},
		} );
	};

	const handleFileChange = ( e ) => {
		uploadFiles( e.target.files );
		// Reset input so same file can be re-uploaded
		e.target.value = '';
	};

	const handleDragEnter = ( e ) => {
		e.preventDefault();
		dragCounter.current++;
		setIsDragging( true );
	};

	const handleDragLeave = ( e ) => {
		e.preventDefault();
		dragCounter.current--;
		if ( dragCounter.current === 0 ) {
			setIsDragging( false );
		}
	};

	const handleDragOver = ( e ) => {
		e.preventDefault();
	};

	const handleDrop = ( e ) => {
		e.preventDefault();
		dragCounter.current = 0;
		setIsDragging( false );
		uploadFiles( e.dataTransfer.files );
	};

	// Resolve style target values for the inline style panel.
	const styleTrack = styleTarget === 'all' ? gpx[ 0 ] : gpx[ styleTarget ];

	return (
		<Modal
			title={
				styleTarget !== null ? __( 'GPX — Style' ) : __( 'GPX Tracks' )
			}
			onRequestClose={
				styleTarget !== null ? () => setStyleTarget( null ) : onClose
			}
			size="medium"
		>
			{ styleTarget !== null ? (
				<div
					style={ {
						display: 'flex',
						flexDirection: 'column',
						gap: '16px',
						padding: '8px 0',
					} }
				>
					<Button
						variant="tertiary"
						icon="arrow-left-alt2"
						onClick={ () => setStyleTarget( null ) }
						style={ { alignSelf: 'flex-start' } }
					>
						{ __( 'Back to tracks' ) }
					</Button>
					<p style={ { margin: 0 } }>
						{ styleTarget === 'all'
							? gpx.map( ( t ) => t.title ).join( ', ' )
							: styleTrack?.title }
					</p>
					<div>
						<p
							style={ {
								margin: '0 0 8px',
								fontWeight: 600,
								fontSize: '13px',
							} }
						>
							{ __( 'Color' ) }
						</p>
						<ColorPalette
							colors={ COLORS }
							value={ styleTrack?.color || 'gold' }
							onChange={ ( v ) => updateGpxProp( 'color', v ) }
							disableCustomColors={ false }
							clearable={ false }
						/>
					</div>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show on map' ) }
						checked={ styleTrack?.visible !== false }
						onChange={ ( v ) => updateGpxProp( 'visible', v ) }
						help={ __(
							'Uncheck to hide this track without removing it'
						) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show download button' ) }
						checked={ !! styleTrack?.download }
						onChange={ ( v ) => updateGpxProp( 'download', v ) }
						help={ __(
							'Show a download icon in the layer control and popup'
						) }
					/>
				</div>
			) : (
				<div
					onDragEnter={ handleDragEnter }
					onDragLeave={ handleDragLeave }
					onDragOver={ handleDragOver }
					onDrop={ handleDrop }
					style={ {
						position: 'relative',
						outline: isDragging
							? '2px dashed #007cba'
							: '2px dashed transparent',
						borderRadius: '4px',
						padding: '4px',
						transition: 'outline-color 0.1s',
					} }
				>
					{ isDragging && (
						<div
							style={ {
								position: 'absolute',
								inset: 0,
								zIndex: 10,
								background: 'rgba(0, 124, 186, 0.08)',
								borderRadius: '4px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								pointerEvents: 'none',
							} }
						>
							<span
								style={ {
									fontWeight: 600,
									color: '#007cba',
									fontSize: '14px',
								} }
							>
								{ __( 'Drop GPX files here' ) }
							</span>
						</div>
					) }

					{ /* Top action bar */ }
					<div
						style={ {
							display: 'flex',
							gap: '8px',
							marginBottom: '16px',
							alignItems: 'center',
						} }
					>
						<Button
							variant="primary"
							icon={ upload }
							onClick={ () => uploadInputRef.current?.click() }
						>
							{ __( 'Upload' ) }
						</Button>
						<MediaUpload
							allowedTypes={ [ 'text/xml' ] }
							multiple
							value={ gpx.map( ( t ) => t.id ) }
							onSelect={ ( selection ) => {
								setPage( 0 );
								onAdd( selection );
							} }
							render={ ( { open } ) => (
								<Button variant="secondary" onClick={ open }>
									{ __( 'Media Library' ) }
								</Button>
							) }
						/>
						<input
							ref={ uploadInputRef }
							type="file"
							accept=".gpx,.xml"
							multiple
							style={ { display: 'none' } }
							onChange={ handleFileChange }
						/>
						{ gpx.length > 0 && (
							<>
								<Button
									icon={ brush }
									label={ __( 'Style all tracks' ) }
									onClick={ () => setStyleTarget( 'all' ) }
								/>
								<Button
									icon={ trash }
									label={ __( 'Remove all tracks' ) }
									isDestructive
									onClick={ () => {
										onRemoveAll();
										onClose();
									} }
								/>
							</>
						) }
					</div>

					{ /* Track table */ }
					{ gpx.length > 0 && (
						<>
							<table
								style={ {
									width: '100%',
									borderCollapse: 'collapse',
								} }
							>
								<tbody>
									{ pageTracks.map( ( track, localIdx ) => {
										const globalIdx = pageStart + localIdx;
										return (
											<tr
												key={ track.id }
												style={ {
													borderBottom:
														'1px solid #ddd',
												} }
											>
												<td
													style={ {
														padding:
															'6px 8px 6px 0',
													} }
												>
													<div
														style={ {
															display: 'flex',
															alignItems:
																'center',
															gap: '4px',
														} }
													>
														<Button
															icon={ brush }
															label={ __(
																'Style this track'
															) }
															onClick={ () =>
																setStyleTarget(
																	globalIdx
																)
															}
														/>
														<span
															style={ {
																display:
																	'block',
																width: '16px',
																height: '16px',
																borderRadius:
																	'50%',
																background:
																	track.color ||
																	'gold',
																flexShrink: 0,
															} }
														/>
													</div>
												</td>
												<td
													style={ {
														padding: '6px 4px',
														width: '100%',
													} }
												>
													{ track.title }
												</td>
												<td
													style={ {
														padding:
															'6px 0 6px 8px',
														width: '32px',
														textAlign: 'right',
													} }
												>
													<Button
														icon={ trash }
														label={ __(
															'Remove track'
														) }
														isDestructive
														onClick={ () =>
															onRemoveOne(
																globalIdx
															)
														}
													/>
												</td>
											</tr>
										);
									} ) }
								</tbody>
							</table>
							{ totalPages > 1 && (
								<div
									style={ {
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										marginTop: '12px',
									} }
								>
									<Button
										variant="secondary"
										disabled={ safePage === 0 }
										onClick={ () =>
											setPage( safePage - 1 )
										}
									>
										{ __( '← Prev' ) }
									</Button>
									<span
										style={ {
											fontSize: '12px',
											color: '#757575',
										} }
									>
										{ pageStart + 1 }–
										{ Math.min(
											pageStart + GPX_PAGE_SIZE,
											gpx.length
										) }{ ' ' }
										{ __( 'of' ) } { gpx.length }
									</span>
									<Button
										variant="secondary"
										disabled={ safePage >= totalPages - 1 }
										onClick={ () =>
											setPage( safePage + 1 )
										}
									>
										{ __( 'Next →' ) }
									</Button>
								</div>
							) }
						</>
					) }

					{ gpx.length === 0 && (
						<p style={ { color: '#757575', margin: 0 } }>
							{ __(
								'No GPX tracks selected. Use Library or Upload to add tracks.'
							) }
						</p>
					) }
				</div>
			) }
		</Modal>
	);
}

// Feed styling modal opened via the brush icon in the Feeds dropdown.
function FeedStyleModal( { feed, style, onUpdate, onClose } ) {
	const s = { ...DEFAULT_FEED_STYLE, ...style };
	return (
		<Modal
			title={ feed + ' — ' + __( 'Style' ) }
			onRequestClose={ onClose }
			size="medium"
		>
			<div
				style={ {
					display: 'flex',
					flexDirection: 'column',
					gap: '16px',
					padding: '8px 0',
				} }
			>
				<div>
					<p
						style={ {
							margin: '0 0 8px',
							fontWeight: 600,
							fontSize: '13px',
						} }
					>
						{ __( 'Color' ) }
					</p>
					<ColorPalette
						colors={ COLORS }
						value={ s.color || 'blue' }
						onChange={ ( value ) => onUpdate( 'color', value ) }
						disableCustomColors={ false }
						clearable={ false }
					/>
				</div>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Connect points with line' ) }
					checked={ !! s.splitLinesEnabled }
					onChange={ ( value ) => {
						onUpdate( 'splitLinesEnabled', value );
						if ( value && ! s.splitLines ) {
							onUpdate( 'splitLines', 12 );
						}
					} }
				/>
				{ s.splitLinesEnabled && (
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Split lines (hours)' ) }
						value={ s.splitLines || '' }
						onChange={ ( value ) =>
							onUpdate( 'splitLines', value )
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
					value={ s.lineWidth ?? 2 }
					onChange={ ( value ) => onUpdate( 'lineWidth', value ) }
					min={ 1 }
					max={ 6 }
					step={ 1 }
				/>
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Line opacity' ) }
					value={ s.lineOpacity ?? 1.0 }
					onChange={ ( value ) => onUpdate( 'lineOpacity', value ) }
					min={ 0.2 }
					max={ 1.0 }
					step={ 0.1 }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Show last point' ) }
					checked={ !! s.lastPoint }
					onChange={ ( value ) => onUpdate( 'lastPoint', value ) }
					help={ __(
						'Highlight the latest point with a large circle marker'
					) }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Show on map' ) }
					checked={ s.visible !== false }
					onChange={ ( value ) => onUpdate( 'visible', value ) }
					help={ __(
						'Uncheck to hide this feed without removing it'
					) }
				/>
			</div>
		</Modal>
	);
}

export default function Edit( { attributes, setAttributes } ) {
	const mapRef = useRef( null );
	const spotmapRef = useRef( null );
	const [ mapId ] = useState(
		() => 'spotmap-editor-' + Math.random().toString( 36 ).slice( 2, 10 )
	);

	// Feed style modal: null = closed, string = feed name open
	const [ feedStyleModal, setFeedStyleModal ] = useState( null );
	// GPX manager modal
	const [ gpxManagerOpen, setGpxManagerOpen ] = useState( false );
	// Time filter popover
	const timeFilterAnchorRef = useRef( null );
	const [ timeFilterOpen, setTimeFilterOpen ] = useState( false );
	// Map settings popover
	const mapSettingsAnchorRef = useRef( null );
	const [ mapSettingsOpen, setMapSettingsOpen ] = useState( false );

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
					! doc.querySelector( `link[href="${ baseUrl + file }"]` )
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
		if ( attributes.feeds.length === 0 && window.spotmapjsobj?.feeds ) {
			const feedNames = Array.isArray( window.spotmapjsobj.feeds )
				? window.spotmapjsobj.feeds
				: Object.keys( window.spotmapjsobj.feeds );

			const defaultStyles = {};
			feedNames.forEach( ( name ) => {
				defaultStyles[ name ] = { ...DEFAULT_FEED_STYLE };
			} );

			const dv = window.spotmapjsobj?.defaultValues ?? {};
			const defaultMaps = dv.maps
				? dv.maps
						.split( ',' )
						.map( ( m ) => m.trim() )
						.filter( Boolean )
				: attributes.maps;
			const defaultHeight = dv.height
				? parseInt( dv.height, 10 )
				: attributes.height;
			const defaultMapcenter = dv.mapcenter || attributes.mapcenter;

			setAttributes( {
				feeds: feedNames,
				styles: defaultStyles,
				maps: defaultMaps,
				height: defaultHeight,
				mapcenter: defaultMapcenter,
			} );
		}
	}, [
		attributes.feeds.length,
		attributes.height,
		attributes.mapcenter,
		attributes.maps,
		setAttributes,
	] );

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
			enablePanning: false, // always disabled in editor preview
		};

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
		attributes.debug,
		attributes.scrollWheelZoom,
		attributes.locateButton,
		attributes.fullscreenButton,
		attributes.navigationButtons,
		attributes.enablePanning,
		attributes,
	] );

	const availableMaps = window.spotmapjsobj?.maps
		? Object.keys( window.spotmapjsobj.maps )
		: [];
	const availableOverlays = window.spotmapjsobj?.overlays
		? Object.keys( window.spotmapjsobj.overlays )
		: [];
	let availableFeeds = [];
	if ( window.spotmapjsobj?.feeds ) {
		availableFeeds = Array.isArray( window.spotmapjsobj.feeds )
			? window.spotmapjsobj.feeds
			: Object.keys( window.spotmapjsobj.feeds );
	}

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

	const mergeGpxTracks = ( newTracks, getTitle ) => {
		const existing = attributes.gpx;
		const existingIds = new Set( existing.map( ( t ) => t.id ) );
		const merged = [
			...existing,
			...newTracks
				.filter( ( t ) => t.id && ! existingIds.has( t.id ) )
				.map( ( t ) => ( {
					id: t.id,
					url: t.url,
					title: getTitle( t ),
					color: existing[ 0 ]?.color || 'gold',
				} ) ),
		];
		setAttributes( { gpx: merged } );
	};

	const dropdownContentStyle = { padding: '8px', minWidth: '200px' };
	const checklistStyle = {
		display: 'flex',
		flexDirection: 'column',
		gap: '6px',
	};

	return (
		<>
			{ gpxManagerOpen && (
				<GpxManagerModal
					gpx={ attributes.gpx }
					onAdd={ ( selection ) =>
						mergeGpxTracks( selection, ( t ) => t.title )
					}
					onUpload={ ( uploaded ) =>
						mergeGpxTracks(
							uploaded,
							( t ) =>
								t.title ||
								t.filename ||
								t.slug ||
								String( t.id )
						)
					}
					onRemoveAll={ () => setAttributes( { gpx: [] } ) }
					onRemoveOne={ ( i ) => {
						const next = attributes.gpx.filter(
							( _, idx ) => idx !== i
						);
						setAttributes( { gpx: next } );
					} }
					setAttributes={ setAttributes }
					onClose={ () => setGpxManagerOpen( false ) }
				/>
			) }
			{ feedStyleModal && (
				<FeedStyleModal
					feed={ feedStyleModal }
					style={ attributes.styles?.[ feedStyleModal ] }
					onUpdate={ ( key, value ) =>
						updateStyle( feedStyleModal, key, value )
					}
					onClose={ () => setFeedStyleModal( null ) }
				/>
			) }

			{ /* Block toolbar */ }
			<BlockControls>
				{ /* Feeds dropdown */ }
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
						renderContent={ ( { onClose: closeDropdown } ) => (
							<div style={ dropdownContentStyle }>
								{ availableFeeds.length === 0 && (
									<p>{ __( 'No feeds configured.' ) }</p>
								) }
								<div style={ checklistStyle }>
									{ availableFeeds.map( ( feed ) => (
										<div
											key={ feed }
											style={ {
												display: 'flex',
												alignItems: 'center',
												gap: '6px',
											} }
										>
											<div style={ { flex: 1 } }>
												<CheckboxControl
													__nextHasNoMarginBottom
													label={ feed }
													checked={ attributes.feeds.includes(
														feed
													) }
													onChange={ ( checked ) =>
														toggleFeed(
															feed,
															checked
														)
													}
												/>
											</div>
											<Button
												icon={ brush }
												label={
													__( 'Style' ) + ' ' + feed
												}
												size="small"
												variant="tertiary"
												onClick={ () => {
													closeDropdown();
													setFeedStyleModal( feed );
												} }
												style={ {
													minWidth: 'unset',
													padding: '2px 4px',
												} }
											/>
											<span
												style={ {
													display: 'block',
													width: '16px',
													height: '16px',
													borderRadius: '50%',
													background:
														attributes.styles?.[
															feed
														]?.color || 'blue',
													flexShrink: 0,
												} }
											/>
										</div>
									) ) }
								</div>
							</div>
						) }
					/>
				</ToolbarGroup>

				{ /* Maps dropdown */ }
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
												window.spotmapjsobj?.maps[
													mapKey
												]?.label ?? mapKey
											}
											checked={ attributes.maps.includes(
												mapKey
											) }
											onChange={ ( checked ) =>
												toggleMap( mapKey, checked )
											}
										/>
									) ) }
								</div>
								{ availableOverlays.length > 0 && (
									<>
										<Divider spaced />
										<p
											style={ {
												margin: '0 0 6px',
												fontWeight: 600,
												fontSize: '11px',
												textTransform: 'uppercase',
												color: '#757575',
											} }
										>
											{ __( 'Overlays' ) }
										</p>
										<div style={ checklistStyle }>
											{ availableOverlays.map(
												( overlayKey ) => (
													<CheckboxControl
														key={ overlayKey }
														__nextHasNoMarginBottom
														label={
															window.spotmapjsobj
																?.overlays[
																overlayKey
															]?.label ??
															overlayKey
														}
														checked={ (
															attributes.mapOverlays ||
															[]
														).includes(
															overlayKey
														) }
														onChange={ (
															checked
														) =>
															toggleOverlay(
																overlayKey,
																checked
															)
														}
													/>
												)
											) }
										</div>
									</>
								) }
							</div>
						) }
					/>
				</ToolbarGroup>

				{ /* GPX — opens manager modal */ }
				<ToolbarGroup>
					<ToolbarButton
						label={ __( 'GPX tracks' ) }
						onClick={ () => setGpxManagerOpen( true ) }
						icon={ SATELLITE_ICON }
					>
						{ __( 'GPX' ) }
						{ attributes.gpx.length > 0 && (
							<span
								style={ {
									marginLeft: '4px',
									background: '#1e1e1e',
									color: '#fff',
									borderRadius: '10px',
									padding: '0 5px',
									fontSize: '10px',
									lineHeight: '16px',
								} }
							>
								{ attributes.gpx.length }
							</span>
						) }
					</ToolbarButton>
				</ToolbarGroup>

				{ /* Time filter — calendar icon opens popover */ }
				<ToolbarGroup>
					<div
						ref={ timeFilterAnchorRef }
						style={ { display: 'inline-flex' } }
					>
						<ToolbarButton
							label={ __( 'Time filter' ) }
							onClick={ () => setTimeFilterOpen( ( v ) => ! v ) }
							icon={ calendar }
						>
							{ __( 'Time' ) }
						</ToolbarButton>
					</div>
					{ timeFilterOpen && (
						<Popover
							anchor={ timeFilterAnchorRef.current }
							onClose={ () => setTimeFilterOpen( false ) }
							placement="bottom-start"
						>
							<div
								style={ {
									padding: '12px',
									minWidth: '260px',
									display: 'flex',
									flexDirection: 'column',
									gap: '12px',
								} }
							>
								<p
									style={ {
										margin: 0,
										fontWeight: 600,
										fontSize: '13px',
									} }
								>
									{ __( 'Time filter' ) }
								</p>
								<SelectControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Show points from' ) }
									value={ dateFromValue }
									options={ buildDateOptions(
										dateFromValue,
										DATE_PRESETS_FROM
									) }
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
									value={ dateToValue }
									options={ buildDateOptions(
										dateToValue,
										DATE_PRESETS_TO
									) }
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
							</div>
						</Popover>
					) }
				</ToolbarGroup>

				{ /* Map settings — gear icon opens popover */ }
				<ToolbarGroup>
					<div
						ref={ mapSettingsAnchorRef }
						style={ { display: 'inline-flex' } }
					>
						<ToolbarButton
							label={ __( 'Map settings' ) }
							onClick={ () => setMapSettingsOpen( ( v ) => ! v ) }
							icon={ settings }
						>
							{ __( 'Settings' ) }
						</ToolbarButton>
					</div>
					{ mapSettingsOpen && (
						<Popover
							anchor={ mapSettingsAnchorRef.current }
							onClose={ () => setMapSettingsOpen( false ) }
							placement="bottom-start"
						>
							<div
								style={ {
									padding: '12px',
									minWidth: '280px',
									display: 'flex',
									flexDirection: 'column',
									gap: '16px',
								} }
							>
								<div>
									<SectionHeader label={ __( 'Display' ) } />
									<div
										style={ {
											display: 'flex',
											flexDirection: 'column',
											gap: '8px',
										} }
									>
										<SelectControl
											__nextHasNoMarginBottom
											__next40pxDefaultSize
											label={ __( 'Zoom to' ) }
											value={ attributes.mapcenter }
											options={ [
												{
													label: 'All points',
													value: 'all',
												},
												{
													label: 'Last trip',
													value: 'last-trip',
												},
												{
													label: 'Latest point',
													value: 'last',
												},
												{
													label: 'GPX tracks',
													value: 'gpx',
												},
											] }
											onChange={ ( value ) =>
												setAttributes( {
													mapcenter: value,
												} )
											}
										/>
										<RangeControl
											__nextHasNoMarginBottom
											__next40pxDefaultSize
											label={ __( 'Height (px)' ) }
											value={ attributes.height }
											onChange={ ( value ) =>
												setAttributes( {
													height: value,
												} )
											}
											min={ 200 }
											max={ 1200 }
											step={ 50 }
										/>
									</div>
								</div>

								<Divider />

								<div>
									<SectionHeader
										label={ __( 'Interaction' ) }
									/>
									<div
										style={ {
											display: 'flex',
											flexDirection: 'column',
											gap: '4px',
										} }
									>
										<ToggleControl
											__nextHasNoMarginBottom
											label={ __( 'Enable panning' ) }
											checked={ attributes.enablePanning }
											onChange={ ( value ) =>
												setAttributes( {
													enablePanning: value,
												} )
											}
										/>
										<ToggleControl
											__nextHasNoMarginBottom
											label={ __( 'Scroll wheel zoom' ) }
											checked={
												attributes.scrollWheelZoom
											}
											onChange={ ( value ) =>
												setAttributes( {
													scrollWheelZoom: value,
												} )
											}
										/>
									</div>
								</div>

								<Divider />

								<div>
									<SectionHeader label={ __( 'Data' ) } />
									<div
										style={ {
											display: 'flex',
											flexDirection: 'column',
											gap: '8px',
										} }
									>
										<UnitControl
											__nextHasNoMarginBottom
											__next40pxDefaultSize
											label={ __( 'Hide nearby points' ) }
											value={ `${ attributes.filterPoints }m` }
											units={ [
												{
													value: 'm',
													label: 'Meter',
													default: 10,
												},
											] }
											onChange={ ( value ) =>
												setAttributes( {
													filterPoints:
														parseInt( value ) || 0,
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
												setAttributes( {
													autoReload: value,
												} )
											}
											help={ __(
												'Refresh map data every 30 seconds'
											) }
										/>
									</div>
								</div>

								<Divider />

								<div>
									<SectionHeader label={ __( 'Controls' ) } />
									<div
										style={ {
											display: 'flex',
											flexDirection: 'column',
											gap: '4px',
										} }
									>
										<ToggleControl
											__nextHasNoMarginBottom
											label={ __( 'Location button' ) }
											checked={ attributes.locateButton }
											onChange={ ( value ) =>
												setAttributes( {
													locateButton: value,
												} )
											}
										/>
										<ToggleControl
											__nextHasNoMarginBottom
											label={ __( 'Fullscreen button' ) }
											checked={
												attributes.fullscreenButton
											}
											onChange={ ( value ) =>
												setAttributes( {
													fullscreenButton: value,
												} )
											}
										/>
										<NavigationButtonsControl
											value={
												attributes.navigationButtons
											}
											onChange={ ( value ) =>
												setAttributes( {
													navigationButtons: value,
												} )
											}
										/>
									</div>
								</div>
							</div>
						</Popover>
					) }
				</ToolbarGroup>
			</BlockControls>

			{ /* Sidebar — Advanced only */ }
			<InspectorControls>
				<PanelBody title={ __( 'Advanced' ) } initialOpen={ false }>
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

			{ /* Block preview */ }
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
