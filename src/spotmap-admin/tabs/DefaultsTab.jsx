import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	Notice,
	TextControl,
	__experimentalNumberControl as NumberControl,
	Spinner,
} from '@wordpress/components';
import * as api from '../api';

const FIELDS = [
	{
		key: 'height',
		label: 'Map Height (px)',
		help: 'Default height of the map in pixels.',
		type: 'number',
	},
	{
		key: 'maps',
		label: 'Default Maps',
		help: 'Comma-separated list of map layer keys, e.g. openstreetmap,opentopomap.',
		type: 'text',
	},
	{
		key: 'mapcenter',
		label: 'Map Center',
		help: '"all" to fit all points, "auto" for last position, or "lat,lon" for a fixed coordinate.',
		type: 'text',
	},
	{
		key: 'width',
		label: 'Map Width',
		help: 'Container width style: normal, wide, or full.',
		type: 'text',
	},
	{
		key: 'color',
		label: 'Track Colors',
		help: 'Comma-separated list of colors for multi-feed tracks, e.g. blue,red.',
		type: 'text',
	},
	{
		key: 'splitlines',
		label: 'Split Lines (hours)',
		help: 'Break the track line if the gap between two points exceeds this many hours.',
		type: 'text',
	},
	{
		key: 'filter-points',
		label: 'Filter Points (minutes)',
		help: 'Hide points recorded within this many minutes of each other.',
		type: 'number',
	},
	{
		key: 'map-overlays',
		label: 'Map Overlays',
		help: 'Comma-separated overlay keys to enable by default. Leave blank for none.',
		type: 'text',
	},
];

export default function DefaultsTab() {
	const [ defaults, setDefaults ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		api.getDefaults()
			.then( setDefaults )
			.catch( ( err ) =>
				setNotice( { status: 'error', text: err.message } )
			);
	}, [] );

	const set = ( key, value ) =>
		setDefaults( ( prev ) => ( { ...prev, [ key ]: value } ) );

	const handleSave = async () => {
		setSaving( true );
		try {
			const saved = await api.updateDefaults( defaults );
			setDefaults( saved );
			setNotice( { status: 'success', text: 'Default settings saved.' } );
		} catch ( err ) {
			setNotice( { status: 'error', text: err.message } );
		} finally {
			setSaving( false );
		}
	};

	if ( ! defaults ) return <Spinner />;

	return (
		<div style={ { maxWidth: '600px', marginTop: '1rem' } }>
			{ notice && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( null ) }
					isDismissible
				>
					{ notice.text }
				</Notice>
			) }

			{ FIELDS.map( ( field ) => {
				const value = defaults[ field.key ] ?? '';
				if ( field.type === 'number' ) {
					return (
						<NumberControl
							key={ field.key }
							label={ field.label }
							help={ field.help }
							value={ value === null ? '' : value }
							min={ 0 }
							onChange={ ( val ) =>
								set(
									field.key,
									val === '' ? null : Number( val )
								)
							}
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
					);
				}
				return (
					<TextControl
						key={ field.key }
						label={ field.label }
						help={ field.help }
						value={ value === null ? '' : String( value ) }
						onChange={ ( val ) =>
							set( field.key, val === '' ? null : val )
						}
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
				);
			} ) }

			<Button
				variant="primary"
				isBusy={ saving }
				style={ { marginTop: '8px' } }
				onClick={ handleSave }
			>
				Save Defaults
			</Button>
		</div>
	);
}
