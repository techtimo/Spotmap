/* global navigator */
import { useState } from '@wordpress/element';
import {
    Modal,
    Button,
    TextControl,
    SelectControl,
    BaseControl,
    Flex,
    FlexItem,
    Notice,
} from '@wordpress/components';
import { Fragment } from '@wordpress/element';
import { arrowLeft, chevronDown, chevronUp } from '@wordpress/icons';
import { REDACTED, getVictronInstallations } from '../api';

// Message types that can have per-feed custom overrides (SPOT only).
const SPOT_CUSTOM_MESSAGE_TYPES = [
    { key: 'OK', label: 'OK' },
    { key: 'HELP', label: 'HELP' },
    { key: 'CUSTOM', label: 'CUSTOM' },
];

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
    return appendQueryParam(
        `${ getIngestBase() }/ingest/teltonika`,
        'key',
        key
    );
}

/**
 * Feed settings modal — used for both Add (with type pre-selected by
 * ProviderPickerModal) and Edit (feed prop has a full feed object).
 *
 * @param {Object}   root0
 * @param {Object}   root0.providers     Map of provider type → provider config.
 * @param {Object}   root0.feed          Feed object (partial for new, full for edit).
 * @param {Array}    root0.existingFeeds List of existing feeds for name-conflict checks.
 * @param {Function} root0.onSave        Called with (data, id) after successful save.
 * @param {Function} root0.onClose       Called when the modal is closed/cancelled.
 * @param {Function} root0.onBack        Called to go back to the provider picker.
 */
export default function FeedModal( {
    providers,
    feed,
    existingFeeds = [],
    onSave,
    onClose,
    onBack,
} ) {
    const isEdit = !! feed?.id;
    const type = feed?.type ?? '';
    const provider = providers[ type ];

    const [ fields, setFields ] = useState( () => {
        const initial = {};
        provider?.fields.forEach( ( f ) => {
            initial[ f.key ] = feed?.[ f.key ] ?? f.default ?? '';
        } );
        // Generate the ingest key upfront for new push-type feeds so the URL
        // is visible before the user hits Save.
        if ( ! isEdit && ( type === 'osmand' || type === 'teltonika' || type === 'ogn' ) ) {
            initial.key = generateFeedKey();
        }
        // Victron: installation picker fields not in provider.fields schema.
        if ( type === 'victron' ) {
            initial.installation_id = feed?.installation_id ?? '';
            initial.installation_name = feed?.installation_name ?? '';
        }
        return initial;
    } );

    // Victron installation picker state.
    const [ victronInstallations, setVictronInstallations ] = useState( () =>
        feed?.installation_id
            ? [
                  {
                      id: feed.installation_id,
                      name: feed.installation_name ?? feed.installation_id,
                  },
              ]
            : null
    );
    const [ victronTokenExpiry, setVictronTokenExpiry ] = useState( null );
    const [ victronLoading, setVictronLoading ] = useState( false );
    const [ victronError, setVictronError ] = useState( null );

    const handleVictronConnect = async () => {
        setVictronLoading( true );
        setVictronError( null );
        try {
            const result = await getVictronInstallations( fields.token );
            setVictronInstallations( result.installations );
            setVictronTokenExpiry( result.token_expires );
            // Auto-select if only one installation.
            if ( result.installations.length === 1 ) {
                const inst = result.installations[ 0 ];
                setField( 'installation_id', String( inst.id ) );
                setField( 'installation_name', inst.name );
                if ( ! fields.name ) {
                    setField( 'name', inst.name );
                }
            } else {
                setField( 'installation_id', '' );
                setField( 'installation_name', '' );
            }
        } catch ( err ) {
            setVictronError( err.message );
        } finally {
            setVictronLoading( false );
        }
    };

    const [ customMessages, setCustomMessages ] = useState( () => {
        const stored = feed?.custom_messages ?? {};
        const result = {};
        SPOT_CUSTOM_MESSAGE_TYPES.forEach( ( { key } ) => {
            result[ key ] = stored[ key ] ?? '';
        } );
        return result;
    } );
    const [ showAdvanced, setShowAdvanced ] = useState( false );

    const [ saving, setSaving ] = useState( false );
    const [ error, setError ] = useState( null );
    const [ nameWarningAcknowledged, setNameWarningAcknowledged ] =
        useState( false );
    const [ passwordEditing, setPasswordEditing ] = useState( () => new Set() );
    const [ passwordClearing, setPasswordClearing ] = useState(
        () => new Set()
    );

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

    const setField = ( key, value ) => {
        if ( key === 'name' ) {
            setNameWarningAcknowledged( false );
        }
        setFields( ( prev ) => ( { ...prev, [ key ]: value } ) );
    };

    const enteredName = fields.name ?? '';
    const duplicateFeed =
        enteredName !== ''
            ? existingFeeds.find(
                  ( f ) => f.name === enteredName && f.id !== feed?.id
              )
            : null;

    // Always build the ingest URL client-side from the key so it stays
    // consistent between add and edit regardless of server URL formatting.
    const ingestKey = feed?.key ?? fields.key;
    const osmandTrackingUrl =
        type === 'osmand' && ingestKey
            ? normalizeTrackingUrl( buildOsmAndUrl( ingestKey ) )
            : null;
    const teltonikaTrackingUrl =
        type === 'teltonika' && ingestKey
            ? normalizeTrackingUrl( buildTeltonikaUrl( ingestKey ) )
            : null;
    const ognProxyCommand =
        type === 'ogn' && ingestKey
            ? `node tools/ogn-proxy.js --key ${ ingestKey } --flarm-id ${ fields.flarm_id || 'XXXXXX' }`
            : null;

    const handleSave = async () => {
        setSaving( true );
        setError( null );
        try {
            const data = { type, ...fields };
            if ( type === 'findmespot' ) {
                data.custom_messages = customMessages;
            }
            if ( type === 'victron' && ! data.installation_id ) {
                throw new Error(
                    'Please connect to VRM and select an installation.'
                );
            }
            await onSave( data, feed?.id );
        } catch ( err ) {
            setError( err.message );
            setSaving( false );
        }
    };

    return (
        <Modal
            title={
                isEdit ? 'Edit Feed' : `Add ${ provider?.label ?? type } Feed`
            }
            size="medium"
            onRequestClose={ onClose }
            headerActions={
                onBack && (
                    <Button
                        icon={ arrowLeft }
                        label="Back to provider selection"
                        onClick={ onBack }
                    />
                )
            }
        >
            <div
                style={ {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                } }
            >
                { error && (
                    <Notice status="error" onRemove={ () => setError( null ) }>
                        { error }
                    </Notice>
                ) }

                { duplicateFeed && ! nameWarningAcknowledged && (
                    <Notice status="warning" isDismissible={ false }>
                        <strong>
                            A feed named &ldquo;{ enteredName }&rdquo; already
                            exists.
                        </strong>{ ' ' }
                        Using the same name means both feeds will write GPS
                        points to the same database bucket — their data will be
                        mixed together. Renaming either feed later will move{ ' ' }
                        <em>all</em> of those shared points to the new name. Use
                        a unique name unless you intentionally want to merge
                        these feeds.
                        <div style={ { marginTop: '8px' } }>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={ () =>
                                    setNameWarningAcknowledged( true )
                                }
                            >
                                I understand, proceed anyway
                            </Button>
                        </div>
                    </Notice>
                ) }

                { isEdit && (
                    <BaseControl
                        label="Provider"
                        id="feed-provider-label"
                        __nextHasNoMarginBottom
                    >
                        <p style={ { margin: '4px 0 0', fontWeight: 500 } }>
                            { provider?.label ?? type }
                        </p>
                    </BaseControl>
                ) }

                { type === 'posts' && (
                    <Notice status="info" isDismissible={ false }>
                        Shows published posts and pages that have a location set
                        via the <strong>Post Location</strong> panel in the
                        editor sidebar. No data is fetched from external
                        services.
                    </Notice>
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
                    const fieldValue = fields[ field.key ] ?? '';
                    const looksLikeUrl =
                        type === 'garmin-inreach' &&
                        field.key === 'mapshare_address' &&
                        ( fieldValue.includes( '://' ) ||
                            fieldValue.startsWith( 'www.' ) );
                    return (
                        <Fragment key={ field.key }>
                            <TextControl
                                label={ field.label }
                                help={ help }
                                type={ isPasswordField ? 'password' : 'text' }
                                value={
                                    isPasswordField && fieldValue === REDACTED
                                        ? ''
                                        : fieldValue
                                }
                                autoComplete="off"
                                onChange={ ( val ) => {
                                    if ( isPasswordField ) {
                                        if ( isClearing ) {
                                            setField( field.key, val );
                                        } else {
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
                            { looksLikeUrl && (
                                <Notice status="warning" isDismissible={ false }>
                                    Enter only the last part of the URL — e.g.{' '}
                                    <strong>
                                        { fieldValue.split( '/' ).filter( Boolean ).pop() ?? 'Username' }
                                    </strong>{' '}
                                    — not the full address.
                                </Notice>
                            ) }
                        </Fragment>
                    );
                } ) }

                { type === 'victron' && (
                    <div
                        style={ {
                            padding: '12px',
                            background: '#f9f9f9',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                        } }
                    >
                        { victronError && (
                            <Notice
                                status="error"
                                onRemove={ () => setVictronError( null ) }
                            >
                                { victronError }
                            </Notice>
                        ) }

                        <Flex align="center" gap={ 2 }>
                            <FlexItem>
                                <Button
                                    variant="secondary"
                                    isBusy={ victronLoading }
                                    disabled={
                                        victronLoading ||
                                        ! fields.token ||
                                        fields.token === REDACTED
                                    }
                                    onClick={ handleVictronConnect }
                                >
                                    { victronInstallations
                                        ? 'Reload installations'
                                        : 'Connect to VRM' }
                                </Button>
                            </FlexItem>
                            { isEdit && fields.token === REDACTED && (
                                <FlexItem>
                                    <span
                                        style={ {
                                            fontSize: '0.85em',
                                            color: '#555',
                                        } }
                                    >
                                        Change the token to reload
                                        installations.
                                    </span>
                                </FlexItem>
                            ) }
                            { victronTokenExpiry !== null && (
                                <FlexItem>
                                    <span
                                        style={ {
                                            fontSize: '0.85em',
                                            color: '#1d7e1d',
                                        } }
                                    >
                                        { victronTokenExpiry === 0
                                            ? '✓ Token valid (no expiry)'
                                            : `✓ Token valid until ${ new Date(
                                                  victronTokenExpiry * 1000
                                              ).toLocaleDateString() }` }
                                    </span>
                                </FlexItem>
                            ) }
                        </Flex>

                        { victronInstallations !== null &&
                            ( victronInstallations.length === 0 ? (
                                <Notice
                                    status="warning"
                                    isDismissible={ false }
                                >
                                    No GPS-capable installations found for this
                                    token.
                                </Notice>
                            ) : (
                                <SelectControl
                                    label="Installation"
                                    value={ fields.installation_id }
                                    options={ [
                                        {
                                            label: '— select an installation —',
                                            value: '',
                                        },
                                        ...victronInstallations.map(
                                            ( inst ) => ( {
                                                label: inst.name,
                                                value: String( inst.id ),
                                            } )
                                        ),
                                    ] }
                                    onChange={ ( val ) => {
                                        const inst = victronInstallations.find(
                                            ( i ) => String( i.id ) === val
                                        );
                                        setField( 'installation_id', val );
                                        setField(
                                            'installation_name',
                                            inst?.name ?? ''
                                        );
                                        if ( inst && ! fields.name ) {
                                            setField( 'name', inst.name );
                                        }
                                    } }
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                />
                            ) ) }

                        { ! victronInstallations && fields.installation_id && (
                            <BaseControl
                                label="Installation"
                                id="victron-installation-stored"
                                __nextHasNoMarginBottom
                            >
                                <p style={ { margin: '4px 0 0' } }>
                                    { fields.installation_name ||
                                        fields.installation_id }
                                </p>
                            </BaseControl>
                        ) }
                    </div>
                ) }

                { osmandTrackingUrl && (
                    <TrackingUrlBox
                        title="OsmAnd Tracking URL"
                        description={
                            <>
                                Enter this URL in OsmAnd:{ ' ' }
                                <em>
                                    Plugins → Trip Recording → Online tracking →
                                    Web address
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
                { ognProxyCommand && (
                    <TrackingUrlBox
                        title="OGN Proxy Command"
                        description="Run this command locally to connect to the OGN APRS stream and forward positions to Spotmap. The glider must be airborne and within range of an OGN receiver."
                        url={ ognProxyCommand }
                    />
                ) }

                { type === 'findmespot' && (
                    <Button
                        variant="link"
                        icon={ showAdvanced ? chevronUp : chevronDown }
                        onClick={ () => setShowAdvanced( ( v ) => ! v ) }
                        style={ { padding: 0 } }
                    >
                        Advanced settings
                    </Button>
                ) }
                { type === 'findmespot' && showAdvanced && (
                    <div
                        style={ {
                            padding: '12px',
                            background: '#f9f9f9',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        } }
                    >
                        <p
                            style={ {
                                margin: 0,
                                fontSize: '0.85em',
                                color: '#555',
                            } }
                        >
                            Override the popup message text for specific point
                            types on this feed. Leave blank to use the device
                            message. This is to protect phone numbers from being
                            exposed.
                        </p>
                        { SPOT_CUSTOM_MESSAGE_TYPES.map( ( { key, label } ) => (
                            <TextControl
                                key={ key }
                                label={ `${ label } message override` }
                                value={ customMessages[ key ] ?? '' }
                                placeholder="Leave blank to use default…"
                                onChange={ ( val ) =>
                                    setCustomMessages( ( prev ) => ( {
                                        ...prev,
                                        [ key ]: val,
                                    } ) )
                                }
                                __nextHasNoMarginBottom
                                __next40pxDefaultSize
                            />
                        ) ) }
                    </div>
                ) }

                <div style={ { display: 'flex', gap: '8px' } }>
                    <Button
                        variant="primary"
                        isBusy={ saving }
                        disabled={
                            saving ||
                            ( !! duplicateFeed && ! nameWarningAcknowledged )
                        }
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
