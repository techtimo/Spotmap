import { useState, useEffect } from '@wordpress/element';
import { Button, Notice, TextControl, BaseControl, Flex, FlexItem, Spinner } from '@wordpress/components';
import * as api from '../api';

const { REDACTED } = api;

const TOKEN_META = {
	timezonedb: {
		label: 'TimezoneDB',
		help: 'Used for automatic timezone lookup. Get a free key at timezonedb.com.',
	},
	mapbox: {
		label: 'Mapbox',
		help: 'Required to display Mapbox tile layers.',
	},
	thunderforest: {
		label: 'Thunderforest',
		help: 'Required to display Thunderforest tile layers (e.g. OpenCycleMap).',
	},
	'linz.govt.nz': {
		label: 'LINZ (New Zealand)',
		help: 'Required for LINZ topographic tile layers.',
	},
	'geoservices.ign.fr': {
		label: 'IGN France (Géoportail)',
		help: 'Required for French IGN tile layers.',
	},
	'osdatahub.os.uk': {
		label: 'Ordnance Survey (UK)',
		help: 'Required for OS tile layers.',
	},
};

function TokenField( { tokenKey, value, onChange } ) {
	const meta = TOKEN_META[ tokenKey ] ?? { label: tokenKey, help: '' };
	const isStored = value === REDACTED;
	const [ editing, setEditing ] = useState( ! isStored );

	// If the parent resets the value (e.g. after save), sync editing state.
	useEffect( () => {
		if ( value === REDACTED ) setEditing( false );
	}, [ value ] );

	if ( isStored && ! editing ) {
		return (
			<BaseControl
				label={ meta.label }
				help={ meta.help }
				id={ `token-${ tokenKey }` }
				__nextHasNoMarginBottom={ false }
			>
				<Flex align="center" gap={ 2 }>
					<FlexItem>
						<span style={ { color: '#1d7e1d' } }>
							&#10003; Token stored
						</span>
					</FlexItem>
					<FlexItem>
						<Button
							variant="link"
							onClick={ () => {
								setEditing( true );
								onChange( '' );
							} }
						>
							Change
						</Button>
					</FlexItem>
					<FlexItem>
						<Button
							variant="link"
							isDestructive
							onClick={ () => {
								setEditing( true );
								onChange( '' );
							} }
						>
							Clear
						</Button>
					</FlexItem>
				</Flex>
			</BaseControl>
		);
	}

	return (
		<TextControl
			label={ meta.label }
			help={ meta.help }
			value={ value }
			type="text"
			autoComplete="off"
			onChange={ onChange }
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
}

export default function TokensTab() {
	const [ tokens, setTokens ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		api.getTokens()
			.then( setTokens )
			.catch( ( err ) => setNotice( { status: 'error', text: err.message } ) );
	}, [] );

	const handleSave = async () => {
		setSaving( true );
		try {
			const saved = await api.updateTokens( tokens );
			setTokens( saved );
			setNotice( { status: 'success', text: 'API tokens saved.' } );
		} catch ( err ) {
			setNotice( { status: 'error', text: err.message } );
		} finally {
			setSaving( false );
		}
	};

	if ( ! tokens ) return <Spinner />;

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

			{ Object.keys( tokens ).map( ( key ) => (
				<TokenField
					key={ key }
					tokenKey={ key }
					value={ tokens[ key ] }
					onChange={ ( val ) =>
						setTokens( ( prev ) => ( { ...prev, [ key ]: val } ) )
					}
				/>
			) ) }

			<Button
				variant="primary"
				isBusy={ saving }
				style={ { marginTop: '8px' } }
				onClick={ handleSave }
			>
				Save API Tokens
			</Button>
		</div>
	);
}
