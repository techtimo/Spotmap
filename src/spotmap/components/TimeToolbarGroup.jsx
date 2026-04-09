import { useState, useEffect } from '@wordpress/element';
import {
    Button,
    DatePicker,
    DateTimePicker,
    Modal,
    Notice,
    RadioControl,
    ToolbarButton,
    ToolbarGroup,
    __experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { calendar } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

const TIME_UNITS = [
    { value: 'hours', label: __( 'hours', 'spotmap' ) },
    { value: 'days', label: __( 'days', 'spotmap' ) },
    { value: 'weeks', label: __( 'weeks', 'spotmap' ) },
    { value: 'months', label: __( 'months', 'spotmap' ) },
    { value: 'years', label: __( 'years', 'spotmap' ) },
];

// Normalize legacy singular/non-plural unit strings from old presets.
const UNIT_ALIASES = {
    hour: 'hours',
    minute: 'hours',
    minutes: 'hours',
    day: 'days',
    week: 'weeks',
    month: 'months',
    year: 'years',
};
const normalizeUnit = ( u ) =>
    UNIT_ALIASES[ u ] ??
    ( TIME_UNITS.find( ( o ) => o.value === u ) ? u : 'hours' );

/**
 * Split a UnitControl value string (e.g. "5hours") into amount and unit parts.
 * Returns { amount: string, unit: string }.
 *
 * @param {string|number} v The raw UnitControl value.
 */
const splitUCValue = ( v ) => {
    if ( ! v && v !== 0 ) {
        return { amount: '', unit: 'hours' };
    }
    const str = String( v );
    const numPart = str.match( /^(\d*)/ )?.[ 1 ] ?? '';
    const unitPart = str.slice( numPart.length );
    return { amount: numPart, unit: normalizeUnit( unitPart ) || 'hours' };
};

/**
 * Parse a stored from/to value back to local state shape.
 * Returns { type: 'none'|'relative'|'specific', relAmount: string, relUnit: string, specific: string }
 *
 * @param {string} value The stored from/to string.
 */
const parseEndpoint = ( value ) => {
    if ( ! value ) {
        return { type: 'none', relAmount: '1', relUnit: 'hours', specific: '' };
    }
    if ( value.startsWith( 'last-' ) ) {
        const parts = value.slice( 5 ).split( '-' );
        const amount = parts[ 0 ] || '1';
        const unit = normalizeUnit( parts.slice( 1 ).join( '-' ) || 'hours' );
        return {
            type: 'relative',
            relAmount: amount,
            relUnit: unit,
            specific: '',
        };
    }
    return {
        type: 'specific',
        relAmount: '1',
        relUnit: 'hours',
        specific: value,
    };
};

/**
 * Build the stored value string from local endpoint state. Returns null if invalid.
 *
 * @param {Object} state The endpoint state object.
 */
const buildEndpoint = ( state ) => {
    if ( state.type === 'none' ) {
        return '';
    }
    if ( state.type === 'relative' ) {
        if ( ! state.relAmount ) {
            return null; // invalid — empty amount
        }
        return `last-${ state.relAmount }-${ state.relUnit }`;
    }
    return state.specific || '';
};

/**
 * Detect single-day mode purely from stored from/to values.
 * True when from = "YYYY-MM-DD 00:00:00" and to = "YYYY-MM-DD 23:59:59" with the same date.
 *
 * @param {string} from The stored "from" datetime string.
 * @param {string} to   The stored "to" datetime string.
 */
const isSingleDayRange = ( from, to ) => {
    if ( ! from || ! to ) {
        return false;
    }
    const fromMatch = from.match( /^(\d{4}-\d{2}-\d{2}) 00:00:00$/ );
    const toMatch = to.match( /^(\d{4}-\d{2}-\d{2}) 23:59:59$/ );
    return !! ( fromMatch && toMatch && fromMatch[ 1 ] === toMatch[ 1 ] );
};

const formatShort = ( value ) => {
    if ( ! value ) {
        return '';
    }
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

const getButtonLabel = ( dateRange ) => {
    const from = dateRange?.from || '';
    const to = dateRange?.to || '';
    if ( ! from && ! to ) {
        return __( 'Time' );
    }
    if ( isSingleDayRange( from, to ) ) {
        return from.split( ' ' )[ 0 ];
    }
    const parts = [];
    if ( from ) {
        parts.push( formatShort( from ) );
    }
    if ( to ) {
        parts.push( formatShort( to ) );
    }
    return parts.join( ' – ' ) || __( 'Time' );
};

// ─── Scoped styles ───────────────────────────────────────────────────────────

const UNIT_CONTROL_STYLES = `
.spotmap-unit-control .components-input-control__input {
    flex: 1 1 auto !important;
}
.spotmap-unit-control .components-input-control__suffix {
    flex: 0 0 40px !important;
}
.spotmap-unit-control .components-unit-control__select {
    width: 40px !important;
    min-width: 40px !important;
}
`;

// ─── Sub-components ─────────────────────────────────────────────────────────

function EndpointSection( { label, state, onChange } ) {
    const idPrefix = label.toLowerCase().replace( /\s+/g, '-' );
    const set = ( type ) => onChange( { ...state, type } );
    return (
        <fieldset style={ { border: 'none', margin: 0, padding: 0 } }>
            <legend
                style={ {
                    fontWeight: 600,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '8px',
                } }
            >
                { label }
            </legend>

            { /* No filter */ }
            <label
                htmlFor={ `${ idPrefix }-none` }
                style={ {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                } }
            >
                <input
                    id={ `${ idPrefix }-none` }
                    type="radio"
                    checked={ state.type === 'none' }
                    onChange={ () => set( 'none' ) }
                />
                { __( 'No filter' ) }
            </label>

            { /* Relative */ }
            <label
                htmlFor={ `${ idPrefix }-relative` }
                style={ {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                } }
            >
                <input
                    id={ `${ idPrefix }-relative` }
                    type="radio"
                    checked={ state.type === 'relative' }
                    onChange={ () => set( 'relative' ) }
                />
                { __( 'Relative (last N…)' ) }
            </label>
            { state.type === 'relative' && (
                <div
                    className="spotmap-unit-control"
                    style={ { marginBottom: '6px', marginLeft: '24px' } }
                >
                    <UnitControl
                        label={ label }
                        hideLabelFromVision
                        value={ `${ state.relAmount }${ state.relUnit }` }
                        units={ TIME_UNITS }
                        min={ 1 }
                        onChange={ ( v ) => {
                            const { amount, unit } = splitUCValue( v );
                            onChange( {
                                ...state,
                                relAmount: amount,
                                relUnit: unit,
                            } );
                        } }
                    />
                </div>
            ) }

            { /* Specific */ }
            <label
                htmlFor={ `${ idPrefix }-specific` }
                style={ {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                } }
            >
                <input
                    id={ `${ idPrefix }-specific` }
                    type="radio"
                    checked={ state.type === 'specific' }
                    onChange={ () => set( 'specific' ) }
                />
                { __( 'Specific date and time' ) }
            </label>
            { state.type === 'specific' && (
                <div style={ { marginLeft: '24px' } }>
                    <DateTimePicker
                        currentDate={
                            state.specific || new Date().toISOString()
                        }
                        onChange={ ( date ) =>
                            onChange( { ...state, specific: date } )
                        }
                    />
                </div>
            ) }
        </fieldset>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

const UNIT_MS = {
    hours: 3600 * 1000,
    days: 24 * 3600 * 1000,
    weeks: 7 * 24 * 3600 * 1000,
    months: 30 * 24 * 3600 * 1000,
    years: 365 * 24 * 3600 * 1000,
};

const resolveMs = ( state ) => {
    if ( state.type === 'none' ) {
        return null;
    }
    if ( state.type === 'specific' ) {
        const d = new Date( state.specific );
        return isNaN( d ) ? null : d.getTime();
    }
    const ms = UNIT_MS[ state.relUnit ];
    return ms && state.relAmount
        ? Date.now() - parseInt( state.relAmount ) * ms
        : null;
};

/**
 * Toolbar group for selecting the date range filter.
 *
 * @param {Object}   props
 * @param {Object}   props.dateRange         { from: string, to: string }
 * @param {Function} props.onChangeDateRange Called with new { from, to } object.
 */
export default function TimeToolbarGroup( { dateRange, onChangeDateRange } ) {
    const [ isOpen, setIsOpen ] = useState( false );
    const [ showErrors, setShowErrors ] = useState( false );

    const from = dateRange?.from || '';
    const to = dateRange?.to || '';

    const [ localMode, setLocalMode ] = useState( 'range' );
    const [ singleDay, setSingleDay ] = useState( '' );
    const [ fromState, setFromState ] = useState( () => parseEndpoint( '' ) );
    const [ toState, setToState ] = useState( () => parseEndpoint( '' ) );

    // Sync local state from prop whenever modal opens.
    useEffect( () => {
        if ( ! isOpen ) {
            return;
        }
        setShowErrors( false );

        if ( isSingleDayRange( from, to ) ) {
            setLocalMode( 'single-day' );
            setSingleDay( from.split( ' ' )[ 0 ] );
            setFromState( parseEndpoint( '' ) );
            setToState( parseEndpoint( '' ) );
        } else {
            setLocalMode( 'range' );
            setSingleDay( '' );
            setFromState( parseEndpoint( from ) );
            setToState( parseEndpoint( to ) );
        }
    }, [ isOpen ] ); // eslint-disable-line react-hooks/exhaustive-deps

    // Collect all current errors (shown only after first Apply attempt).
    const errors = [];
    if ( localMode === 'range' ) {
        if ( fromState.type === 'relative' && ! fromState.relAmount ) {
            errors.push( __( '"From": enter an amount.' ) );
        }
        if ( toState.type === 'relative' && ! toState.relAmount ) {
            errors.push( __( '"To": enter an amount.' ) );
        }
        if ( ! errors.length ) {
            const fromMs = resolveMs( fromState );
            const toMs = resolveMs( toState );
            if ( fromMs !== null && toMs !== null && toMs - fromMs <= 1000 ) {
                errors.push(
                    __( '"To" must be more than 1 second after "From".' )
                );
            }
        }
    }

    const applyFilter = () => {
        if ( errors.length ) {
            setShowErrors( true );
            return;
        }
        if ( localMode === 'single-day' ) {
            if ( singleDay ) {
                onChangeDateRange( {
                    from: `${ singleDay } 00:00:00`,
                    to: `${ singleDay } 23:59:59`,
                } );
            } else {
                onChangeDateRange( { from: '', to: '' } );
            }
        } else {
            onChangeDateRange( {
                from: buildEndpoint( fromState ),
                to: buildEndpoint( toState ),
            } );
        }
        setIsOpen( false );
    };

    const clearFilter = () => {
        onChangeDateRange( { from: '', to: '' } );
        setIsOpen( false );
    };

    const hasFilter = !! ( from || to );

    return (
        <ToolbarGroup>
            <ToolbarButton
                label={ __( 'Time filter' ) }
                icon={ calendar }
                onClick={ () => setIsOpen( true ) }
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
                    <style>{ UNIT_CONTROL_STYLES }</style>
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
                                    label: __(
                                        'Date range (start and end separately)'
                                    ),
                                    value: 'range',
                                },
                                {
                                    label: __( 'Single day' ),
                                    value: 'single-day',
                                },
                            ] }
                            onChange={ ( mode ) => {
                                setLocalMode( mode );
                                setShowErrors( false );
                            } }
                        />

                        { localMode === 'single-day' && (
                            <div>
                                <p style={ { margin: '0 0 8px' } }>
                                    { __( 'Show only points from this day:' ) }
                                </p>
                                { /* min-height reserves space for a 6-row month so
                                     the buttons below never shift when cycling months */ }
                                <div style={ { minHeight: '272px' } }>
                                    <DatePicker
                                        currentDate={
                                            singleDay
                                                ? `${ singleDay }T12:00:00`
                                                : new Date().toISOString()
                                        }
                                        onChange={ ( date ) =>
                                            setSingleDay(
                                                date.split( 'T' )[ 0 ]
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        ) }

                        { localMode === 'range' && (
                            <>
                                <EndpointSection
                                    label={ __( 'Show points from' ) }
                                    state={ fromState }
                                    onChange={ ( s ) => {
                                        setFromState( s );
                                        setShowErrors( false );
                                    } }
                                />
                                <hr
                                    style={ {
                                        margin: '0',
                                        borderColor: '#ddd',
                                    } }
                                />
                                <EndpointSection
                                    label={ __( 'Show points to' ) }
                                    state={ toState }
                                    onChange={ ( s ) => {
                                        setToState( s );
                                        setShowErrors( false );
                                    } }
                                />
                            </>
                        ) }

                        { showErrors && errors.length > 0 && (
                            <Notice status="warning" isDismissible={ false }>
                                { errors.map( ( e, i ) => (
                                    <div key={ i }>{ e }</div>
                                ) ) }
                            </Notice>
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
