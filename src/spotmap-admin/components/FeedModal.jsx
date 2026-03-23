import { useState } from '@wordpress/element';
import {
	Modal,
	Button,
	TextControl,
	SelectControl,
	Notice,
} from '@wordpress/components';
import { REDACTED } from '../api';

export default function FeedModal( { providers, feed, onSave, onClose } ) {
	const isEdit = !! feed;
	const providerKeys = Object.keys( providers );

	const [ type, setType ] = useState( feed?.type ?? providerKeys[ 0 ] ?? '' );
	const [ fields, setFields ] = useState( () => {
		const provider = providers[ feed?.type ?? providerKeys[ 0 ] ];
		const initial = {};
		provider?.fields.forEach( ( f ) => {
			initial[ f.key ] = feed?.[ f.key ] ?? '';
		} );
		return initial;
	} );
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ] = useState( null );

	const provider = providers[ type ];

	const setField = ( key, value ) =>
		setFields( ( prev ) => ( { ...prev, [ key ]: value } ) );

	const handleTypeChange = ( newType ) => {
		setType( newType );
		const newProvider = providers[ newType ];
		const reset = {};
		newProvider?.fields.forEach( ( f ) => {
			reset[ f.key ] = '';
		} );
		setFields( reset );
	};

	const handleSave = async () => {
		setSaving( true );
		setError( null );
		try {
			await onSave( { type, ...fields }, feed?.id );
		} catch ( err ) {
			setError( err.message );
			setSaving( false );
		}
	};

	return (
		<Modal
			title={ isEdit ? 'Edit Feed' : 'Add Feed' }
			size="medium"
			onRequestClose={ onClose }
		>
			{ error && (
				<Notice status="error" onRemove={ () => setError( null ) }>
					{ error }
				</Notice>
			) }

			{ ! isEdit && (
				<SelectControl
					label="Provider Type"
					value={ type }
					options={ providerKeys.map( ( key ) => ( {
						value: key,
						label: providers[ key ].label,
					} ) ) }
					onChange={ handleTypeChange }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
			) }

			{ provider?.fields.map( ( field ) => {
				const isRedacted =
					isEdit &&
					field.type === 'password' &&
					fields[ field.key ] === REDACTED;
				return (
					<TextControl
						key={ field.key }
						label={ field.label }
						help={
							field.description
								? // Strip HTML tags from description for plain-text help
								  field.description.replace( /<[^>]+>/g, '' )
								: undefined
						}
						type={ field.type === 'password' ? 'password' : 'text' }
						// Show empty when REDACTED - user must re-enter to change it.
						value={ isRedacted ? '' : fields[ field.key ] ?? '' }
						placeholder={
							isRedacted
								? 'Leave blank to keep existing password'
								: undefined
						}
						autoComplete="off"
						onChange={ ( val ) => setField( field.key, val ) }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
				);
			} ) }

			<div style={ { display: 'flex', gap: '8px', marginTop: '16px' } }>
				<Button
					variant="primary"
					isBusy={ saving }
					onClick={ handleSave }
				>
					Save
				</Button>
				<Button variant="secondary" onClick={ onClose }>
					Cancel
				</Button>
			</div>
		</Modal>
	);
}
