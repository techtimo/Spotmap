/* global navigator */
import { useState } from '@wordpress/element';
import {
    Modal,
    Button,
    TextControl,
    BaseControl,
    Flex,
    FlexItem,
    Notice,
} from '@wordpress/components';
import { REDACTED } from '../api';
import ProviderSelector from './ProviderSelector';

function TrackingUrlBox( { title, description, url } ) {
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
            <p style={ { margin: '0 0 6px', fontWeight: 600 } }>{ title }</p>
            <p style={ { margin: '0 0 10px', fontSize: '0.85em' } }>
                { description }
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

function generateFeedKey() {
    const bytes = new Uint8Array( 16 );
    crypto.getRandomValues( bytes );
    return Array.from( bytes )
        .map( ( b ) => b.toString( 16 ).padStart( 2, '0' ) )
        .join( '' );
}

function getIngestBase() {
    return window.spotmapAdminData.restUrl.replace( /\/$/, '' );
}

function appendQueryParam( url, key, value ) {
    const separator = url.includes( '?' ) ? '&' : '?';
    return `${ url }${ separator }${ key }=${ encodeURIComponent( value ) }`;
}

function normalizeTrackingUrl( url ) {
    if ( ! url ) {
        return url;
    }

    return url.replace( /(rest_route=[^&?]+)\?/, '$1&' );
}

function buildOsmAndUrl( key ) {
    return `${ appendQueryParam(
        `${ getIngestBase() }/ingest/osmand`,
        'key',
        key
    ) }&lat={0}&lon={1}&timestamp={2}&hdop={3}&altitude={4}&speed={5}&bearing={6}&batproc={11}`;
}

function buildTeltonikaUrl( key ) {
    return appendQueryParam( `${ getIngestBase() }/ingest/teltonika`, 'key', key );
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
        // For new OsmAnd/Teltonika feeds, generate the key upfront so the URL is visible immediately.
        if (
            ! feed &&
            ( initialType === 'osmand' || initialType === 'teltonika' )
        ) {
            initial.key = generateFeedKey();
        }
        return initial;
    } );
    const [ saving, setSaving ] = useState( false );
    const [ error, setError ] = useState( null );
    // Tracks which password fields are in edit mode (Set of field keys).
    const [ passwordEditing, setPasswordEditing ] = useState( () => new Set() );
    // Tracks which password fields are in "clear" mode.
    const [ passwordClearing, setPasswordClearing ] = useState( () => new Set() );

    const startPasswordEdit = ( key ) => {
        setPasswordEditing( ( prev ) => new Set( [ ...prev, key ] ) );
        setPasswordClearing( ( prev ) => {
            const next = new Set( prev );
            next.delete( key );
            return next;
        } );
        setFields( ( prev ) => ( { ...prev, [ key ]: REDACTED } ) );
    };

    const startPasswordClear = ( key ) => {
        setPasswordEditing( ( prev ) => new Set( [ ...prev, key ] ) );
        setPasswordClearing( ( prev ) => new Set( [ ...prev, key ] ) );
        setFields( ( prev ) => ( { ...prev, [ key ]: '' } ) );
    };

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
        if ( newType === 'osmand' || newType === 'teltonika' ) {
            reset.key = generateFeedKey();
        }
        setFields( reset );
    };

    // For new OsmAnd/Teltonika feeds the URL is built from the browser-generated key so it's
    // visible immediately. For existing feeds the server-provided URL is used.
    const osmandTrackingUrl =
        type === 'osmand'
            ? normalizeTrackingUrl(
                feed?.tracking_url ??
                    ( fields.key ? buildOsmAndUrl( fields.key ) : null )
            )
            : null;
    const teltonikaTrackingUrl =
        type === 'teltonika'
            ? normalizeTrackingUrl(
                feed?.tracking_url ??
                    ( fields.key ? buildTeltonikaUrl( fields.key ) : null )
            )
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
            <div style={ { display: 'flex', flexDirection: 'column', gap: '16px' } }>
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
                const help = field.description
                    ? field.description.replace( /<[^>]+>/g, '' )
                    : undefined;
                const isPasswordField = field.type === 'password';
                const isStored =
                    isEdit &&
                    isPasswordField &&
                    fields[ field.key ] === REDACTED &&
                    ! passwordEditing.has( field.key );

                if ( isStored ) {
                    return (
                        <BaseControl
                            key={ field.key }
                            label={ field.label }
                            id={ `password-${ field.key }` }
                            __nextHasNoMarginBottom
                        >
                            <Flex align="center" gap={ 2 }>
                                <FlexItem>
                                    <span style={ { color: '#1d7e1d' } }>
                                        &#10003; Password stored
                                    </span>
                                </FlexItem>
                                <FlexItem>
                                    <Button
                                        variant="link"
                                        onClick={ () =>
                                            startPasswordEdit( field.key )
                                        }
                                    >
                                        Change
                                    </Button>
                                </FlexItem>
                                <FlexItem>
                                    <Button
                                        variant="link"
                                        isDestructive
                                        onClick={ () =>
                                            startPasswordClear( field.key )
                                        }
                                    >
                                        Clear
                                    </Button>
                                </FlexItem>
                            </Flex>
                        </BaseControl>
                    );
                }

                const isClearing =
                    isPasswordField && passwordClearing.has( field.key );
                return (
                    <TextControl
                        key={ field.key }
                        label={ field.label }
                        help={ help }
                        type={ isPasswordField ? 'password' : 'text' }
                        value={
                            isPasswordField &&
                            fields[ field.key ] === REDACTED
                                ? ''
                                : fields[ field.key ] ?? ''
                        }
                        autoComplete="off"
                        onChange={ ( val ) => {
                            if ( isPasswordField ) {
                                if ( isClearing ) {
                                    setField( field.key, val );
                                } else {
                                    // In change mode empty means "keep stored".
                                    setField(
                                        field.key,
                                        val === '' ? REDACTED : val
                                    );
                                }
                            } else {
                                setField( field.key, val );
                            }
                        } }
                        __nextHasNoMarginBottom
                        __next40pxDefaultSize
                    />
                );
            } ) }

            { osmandTrackingUrl && (
                <TrackingUrlBox
                    title="OsmAnd Tracking URL"
                    description={
                        <>
                            Enter this URL in OsmAnd:{ ' ' }
                            <em>
                                Plugins → Trip Recording → Online tracking → Web
                                address
                            </em>
                            . Set Tracking interval to 10 s or more.{ ' ' }
                            <a
                                href="https://osmand.net/docs/user/plugins/trip-recording/#required-setup-parameters"
                                target="_blank"
                                rel="noreferrer"
                            >
                                OsmAnd docs ↗
                            </a>
                        </>
                    }
                    url={ osmandTrackingUrl }
                />
            ) }
            { teltonikaTrackingUrl && (
                <TrackingUrlBox
                    title="Teltonika Push URL"
                    description="Configure this as the HTTP POST destination in your Teltonika device (Codec 8 / JSON over HTTP). The device should POST JSON with a single object key containing latitude, longitude, altitude, speed, angle, and timestamp fields."
                    url={ teltonikaTrackingUrl }
                />
            ) }

            <div style={ { display: 'flex', gap: '8px' } }>
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
            </div>
        </Modal>
    );
}
