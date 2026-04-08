import { useState } from '@wordpress/element';
import {
    Button,
    DatePicker,
    DateTimePicker,
    Modal,
    RadioControl,
    SelectControl,
    TextControl,
    ToolbarButton,
    ToolbarGroup,
} from '@wordpress/components';
import { calendar } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

const UNIT_OPTIONS = [
    { label: __( 'hours' ), value: 'hours' },
    { label: __( 'days' ), value: 'days' },
    { label: __( 'weeks' ), value: 'weeks' },
    { label: __( 'months' ), value: 'months' },
    { label: __( 'years' ), value: 'years' },
];

/**
 * Parse a stored from/to value back to local state shape.
 * Returns { type: 'none'|'relative'|'specific', relAmount, relUnit, specific }
 */
const parseEndpoint = ( value ) => {
    if ( ! value ) {
        return { type: 'none', relAmount: 1, relUnit: 'days', specific: '' };
    }
    if ( value.startsWith( 'last-' ) ) {
        const parts = value.slice( 5 ).split( '-' );
        const amount = parseInt( parts[ 0 ] ) || 1;
        const unit = parts.slice( 1 ).join( '-' ) || 'days';
        return { type: 'relative', relAmount: amount, relUnit: unit, specific: '' };
    }
    return { type: 'specific', relAmount: 1, relUnit: 'days', specific: value };
};

/** Build the stored value string from local endpoint state. */
const buildEndpoint = ( state ) => {
    if ( state.type === 'none' ) return '';
    if ( state.type === 'relative' ) {
        return `last-${ state.relAmount }-${ state.relUnit }`;
    }
    return state.specific || '';
};

const formatShort = ( value ) => {
    if ( ! value ) return '';
    if ( value.startsWith( 'last-' ) ) {
        const parts = value.slice( 5 ).split( '-' );
        return `last ${ parts[ 0 ] } ${ parts.slice( 1 ).join( ' ' ) }`;
    }
    try {
        const d = new Date( value );
        if ( ! isNaN( d ) ) {
            return d.toLocaleDateString( undefined, { dateStyle: 'short' } );
        }
    } catch {
        // fall through
    }
    return value;
};

/** Derive the toolbar button label from the stored dateRange. */
const getButtonLabel = ( dateRange ) => {
    const mode = dateRange?.mode;
    const from = dateRange?.from || '';
    const to = dateRange?.to || '';

    if ( ! from && ! to ) return __( 'Time' );

    if ( mode === 'single-day' && from ) {
        return from.split( ' ' )[ 0 ] || __( 'Time' );
    }

    const parts = [];
    if ( from ) parts.push( formatShort( from ) );
    if ( to ) parts.push( formatShort( to ) );
    return parts.join( ' – ' ) || __( 'Time' );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function RelativeInputs( { amount, unit, onChange } ) {
    return (
        <div
            style={ {
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-end',
                marginTop: '8px',
                marginLeft: '28px',
            } }
        >
            <TextControl
                label={ __( 'Amount' ) }
                hideLabelFromVision
                type="number"
                min={ 1 }
                value={ amount }
                onChange={ ( v ) =>
                    onChange( { amount: Math.max( 1, parseInt( v ) || 1 ), unit } )
                }
                style={ { width: '80px' } }
            />
            <SelectControl
                __next40pxDefaultSize
                label={ __( 'Unit' ) }
                hideLabelFromVision
                value={ unit }
                options={ UNIT_OPTIONS }
                onChange={ ( u ) => onChange( { amount, unit: u } ) }
            />
        </div>
    );
}

function EndpointSection( { label, state, onChange } ) {
    return (
        <div>
            <RadioControl
                label={ label }
                selected={ state.type }
                options={ [
                    { label: __( 'No filter' ), value: 'none' },
                    { label: __( 'Relative (last N…)' ), value: 'relative' },
                    { label: __( 'Specific date and time' ), value: 'specific' },
                ] }
                onChange={ ( type ) => onChange( { ...state, type } ) }
            />
            { state.type === 'relative' && (
                <RelativeInputs
                    amount={ state.relAmount }
                    unit={ state.relUnit }
                    onChange={ ( { amount, unit } ) =>
                        onChange( { ...state, relAmount: amount, relUnit: unit } )
                    }
                />
            ) }
            { state.type === 'specific' && (
                <div style={ { marginTop: '8px' } }>
                    <DateTimePicker
                        currentDate={ state.specific || new Date().toISOString() }
                        onChange={ ( date ) =>
                            onChange( { ...state, specific: date } )
                        }
                    />
                </div>
            ) }
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * Toolbar group for selecting the date range filter.
 *
 * @param {Object}   props
 * @param {Object}   props.dateRange         { from: string, to: string, mode?: string }
 * @param {Function} props.onChangeDateRange Called with new { from, to, mode } object.
 */
export default function TimeToolbarGroup( { dateRange, onChangeDateRange } ) {
    const [ isOpen, setIsOpen ] = useState( false );

    // Local modal state – initialised when the modal opens.
    const [ localMode, setLocalMode ] = useState( 'range' );
    const [ singleDay, setSingleDay ] = useState( '' );
    const [ fromState, setFromState ] = useState( () =>
        parseEndpoint( '' )
    );
    const [ toState, setToState ] = useState( () => parseEndpoint( '' ) );

    const openModal = () => {
        const storedMode = dateRange?.mode;
        const from = dateRange?.from || '';
        const to = dateRange?.to || '';

        if ( storedMode === 'single-day' ) {
            setLocalMode( 'single-day' );
            // from is stored as "YYYY-MM-DD 00:00:00"
            setSingleDay( from.split( ' ' )[ 0 ] || '' );
        } else {
            setLocalMode( 'range' );
            setSingleDay( '' );
        }

        setFromState( parseEndpoint( from ) );
        setToState( parseEndpoint( to ) );
        setIsOpen( true );
    };

    const applyFilter = () => {
        if ( localMode === 'single-day' ) {
            if ( singleDay ) {
                onChangeDateRange( {
                    from: `${ singleDay } 00:00:00`,
                    to: `${ singleDay } 23:59:59`,
                    mode: 'single-day',
                } );
            } else {
                onChangeDateRange( { from: '', to: '', mode: 'single-day' } );
            }
        } else {
            onChangeDateRange( {
                from: buildEndpoint( fromState ),
                to: buildEndpoint( toState ),
                mode: 'range',
            } );
        }
        setIsOpen( false );
    };

    const clearFilter = () => {
        onChangeDateRange( { from: '', to: '', mode: 'range' } );
        setIsOpen( false );
    };

    const hasFilter = !! ( dateRange?.from || dateRange?.to );

    /**
     * Resolve an endpoint state to an approximate Unix ms timestamp so any
     * combination of specific / relative endpoints can be compared.
     * Returns null when the endpoint is "none" or unparseable.
     */
    const UNIT_MS = {
        hours: 3600 * 1000,
        days: 24 * 3600 * 1000,
        weeks: 7 * 24 * 3600 * 1000,
        months: 30 * 24 * 3600 * 1000,
        years: 365 * 24 * 3600 * 1000,
    };
    const resolveMs = ( state ) => {
        if ( state.type === 'none' ) return null;
        if ( state.type === 'specific' ) {
            const d = new Date( state.specific );
            return isNaN( d ) ? null : d.getTime();
        }
        // relative: "last N unit" → now − N × unit
        const ms = UNIT_MS[ state.relUnit ];
        return ms ? Date.now() - state.relAmount * ms : null;
    };

    // Validate: "to" must be more than 1 second after "from".
    let validationError = '';
    if ( localMode === 'range' ) {
        const fromMs = resolveMs( fromState );
        const toMs = resolveMs( toState );
        if ( fromMs !== null && toMs !== null && toMs - fromMs <= 1000 ) {
            validationError = __(
                '"To" must be more than 1 second after "From".'
            );
        }
    }

    return (
        <ToolbarGroup>
            <ToolbarButton
                label={ __( 'Time filter' ) }
                icon={ calendar }
                onClick={ openModal }
                isPressed={ hasFilter }
            >
                { getButtonLabel( dateRange ) }
            </ToolbarButton>

            { isOpen && (
                <Modal
                    title={ __( 'Time filter' ) }
                    onRequestClose={ () => setIsOpen( false ) }
                    size="medium"
                >
                    <div
                        style={ {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px',
                        } }
                    >
                        <RadioControl
                            label={ __( 'Filter mode' ) }
                            selected={ localMode }
                            options={ [
                                {
                                    label: __( 'Single day' ),
                                    value: 'single-day',
                                },
                                {
                                    label: __( 'Date range (start and end separately)' ),
                                    value: 'range',
                                },
                            ] }
                            onChange={ setLocalMode }
                        />

                        { localMode === 'single-day' && (
                            <div>
                                <p style={ { margin: '0 0 8px' } }>
                                    { __( 'Show only points from this day:' ) }
                                </p>
                                <DatePicker
                                    currentDate={
                                        singleDay
                                            ? `${ singleDay }T12:00:00`
                                            : new Date().toISOString()
                                    }
                                    onChange={ ( date ) =>
                                        setSingleDay( date.split( 'T' )[ 0 ] )
                                    }
                                />
                            </div>
                        ) }

                        { localMode === 'range' && (
                            <>
                                <EndpointSection
                                    label={ __( 'Show points from' ) }
                                    state={ fromState }
                                    onChange={ setFromState }
                                />
                                <hr style={ { margin: '0', borderColor: '#ddd' } } />
                                <EndpointSection
                                    label={ __( 'Show points to' ) }
                                    state={ toState }
                                    onChange={ setToState }
                                />
                            </>
                        ) }

                        { validationError && (
                            <p
                                style={ {
                                    margin: '0',
                                    color: '#cc1818',
                                    fontSize: '13px',
                                } }
                            >
                                { validationError }
                            </p>
                        ) }

                        <div
                            style={ {
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '8px',
                                marginTop: '8px',
                            } }
                        >
                            <Button
                                variant="tertiary"
                                isDestructive
                                onClick={ clearFilter }
                            >
                                { __( 'Clear filter' ) }
                            </Button>
                            <div style={ { display: 'flex', gap: '8px' } }>
                                <Button
                                    variant="secondary"
                                    onClick={ () => setIsOpen( false ) }
                                >
                                    { __( 'Cancel' ) }
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={ applyFilter }
                                    disabled={ !! validationError }
                                >
                                    { __( 'Apply' ) }
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            ) }
        </ToolbarGroup>
    );
}
