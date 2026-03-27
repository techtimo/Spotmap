import { useState } from '@wordpress/element';
import { Modal, Button, TextControl, Notice } from '@wordpress/components';
import { REDACTED } from '../api';
import ProviderSelector from './ProviderSelector';

function OsmAndTrackingUrl( { url } ) {
    const [ copied, setCopied ] = useState( false );
    const copy = () => {
        navigator.clipboard.writeText( url ).then( () => {
            setCopied( true );
            setTimeout( () => setCopied( false ), 2000 );
        } );
    };
    return (
        <div
            style={ {
                margin: '16px 0',
                padding: '12px',
                background: '#f0f6fc',
                border: '1px solid #c3d9ef',
                borderRadius: '4px',
            } }
        >
            <p style={ { margin: '0 0 6px', fontWeight: 600 } }>
                OsmAnd Tracking URL
            </p>
            <p style={ { margin: '0 0 10px', fontSize: '0.85em' } }>
                Enter this URL in OsmAnd:{ ' ' }
                <em>
                    Plugins → Trip Recording → Online tracking → Web address
                </em>
                . Set Tracking interval to 10 s or more.{ ' ' }
                <a
                    href="https://osmand.net/docs/user/plugins/trip-recording/#required-setup-parameters"
                    target="_blank"
                    rel="noreferrer"
                >
                    OsmAnd docs ↗
                </a>
            </p>
            <div
                style={ { display: 'flex', alignItems: 'center', gap: '8px' } }
            >
                <code
                    style={ {
                        flex: 1,
                        wordBreak: 'break-all',
                        background: '#fff',
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '3px',
                        fontSize: '0.75em',
                    } }
                >
                    { url }
                </code>
                <Button variant="secondary" size="small" onClick={ copy }>
                    { copied ? '✓ Copied' : 'Copy' }
                </Button>
            </div>
        </div>
    );
}

function generateOsmAndKey() {
    const bytes = new Uint8Array( 16 );
    crypto.getRandomValues( bytes );
    return Array.from( bytes )
        .map( ( b ) => b.toString( 16 ).padStart( 2, '0' ) )
        .join( '' );
}

function buildOsmAndUrl( key ) {
    const base = window.spotmapAdminData.restUrl.replace( /\/$/, '' );
    return (
        base +
        '/ingest/osmand?key=' +
        encodeURIComponent( key ) +
        '&lat={0}&lon={1}&timestamp={2}&hdop={3}&altitude={4}&speed={5}&bearing={6}&batproc={11}'
    );
}

export default function FeedModal( { providers, feed, onSave, onClose } ) {
    const isEdit = !! feed;
    const providerKeys = Object.keys( providers );

    const [ type, setType ] = useState( feed?.type ?? providerKeys[ 0 ] ?? '' );
    const [ fields, setFields ] = useState( () => {
        const initialType = feed?.type ?? providerKeys[ 0 ] ?? '';
        const provider = providers[ initialType ];
        const initial = {};
        provider?.fields.forEach( ( f ) => {
            initial[ f.key ] = feed?.[ f.key ] ?? '';
        } );
        // For new OsmAnd feeds, generate the key upfront so the URL is visible immediately.
        if ( ! feed && initialType === 'osmand' ) {
            initial.key = generateOsmAndKey();
        }
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
        if ( newType === 'osmand' ) {
            reset.key = generateOsmAndKey();
        }
        setFields( reset );
    };

    // For new OsmAnd feeds the URL is built from the browser-generated key so it's
    // visible immediately. For existing feeds the server-provided URL is used.
    const osmandTrackingUrl =
        type === 'osmand'
            ? feed?.tracking_url ??
              ( fields.key ? buildOsmAndUrl( fields.key ) : null )
            : null;

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
                <ProviderSelector
                    providers={ providers }
                    value={ type }
                    onChange={ handleTypeChange }
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

            { osmandTrackingUrl && (
                <OsmAndTrackingUrl url={ osmandTrackingUrl } />
            ) }

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
