import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	TextControl,
	BaseControl,
	Flex,
	FlexItem,
	Spinner,
} from '@wordpress/components';
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
	const [ clearing, setClearing ] = useState( false );
	const [ inputVal, setInputVal ] = useState( '' );

	// If the parent resets the value (e.g. after save), sync editing state.
	useEffect( () => {
		if ( value === REDACTED ) {
			setEditing( false );
			setClearing( false );
			setInputVal( '' );
		}
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
								setClearing( false );
								setInputVal( '' );
								// Keep REDACTED until the user actually types a new value.
								onChange( REDACTED );
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
								setClearing( true );
								setInputVal( '' );
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

	const handleInputChange = ( val ) => {
		setInputVal( val );
		if ( clearing ) {
			// In clear mode every value (including empty) is intentional.
			onChange( val );
		} else {
			// In change mode an empty field means "keep the stored token".
			onChange( val === '' ? REDACTED : val );
		}
	};

	return (
		<TextControl
			label={ meta.label }
			help={ meta.help }
			value={ inputVal }
			type="text"
			autoComplete="off"
			onChange={ handleInputChange }
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
}

export default function TokensTab( { onNoticeChange } ) {
	const [ tokens, setTokens ] = useState( null );
	const [ saving, setSaving ] = useState( false );

	useEffect( () => {
		api.getTokens()
			.then( setTokens )
			.catch( ( err ) =>
				onNoticeChange( { status: 'error', text: err.message } )
			);
	}, [] );

	const handleSave = async () => {
		setSaving( true );
		try {
			const saved = await api.updateTokens( tokens );
			setTokens( saved );
			onNoticeChange( { status: 'success', text: 'API tokens saved.' } );
		} catch ( err ) {
			onNoticeChange( { status: 'error', text: err.message } );
		} finally {
			setSaving( false );
		}
	};

	if ( ! tokens ) {
		return <Spinner />;
	}

	return (
		<div style={ { maxWidth: '600px', marginTop: '1rem' } }>
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
