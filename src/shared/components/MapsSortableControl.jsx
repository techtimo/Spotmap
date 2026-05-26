import { BaseControl, Button } from '@wordpress/components';

/**
 * @param {Object}   props
 * @param {string}   props.value        Comma-separated map keys, e.g. "openstreetmap,opentopomap".
 * @param {Function} props.onChange     Called with new comma-separated string, or null when empty.
 * @param {string}   [props.label]      When provided, wraps the list in a BaseControl with this label.
 * @param {string}   [props.help]       BaseControl help text (only used when label is set).
 * @param {string}   [props.maxHeight]  Max-height of the scrollable list. Default: '180px'.
 * @param {number}   [props.minSelected] Minimum number of selected items (remove button hidden at limit). Default: 0.
 */
export default function MapsSortableControl( {
    value,
    onChange,
    label,
    help,
    maxHeight = '180px',
    minSelected = 0,
} ) {
    const allMaps = window.spotmapjsobj?.maps ?? {};
    const allKeys = Object.keys( allMaps );

    const selected = value
        ? value
              .split( ',' )
              .map( ( k ) => k.trim() )
              .filter( ( k ) => allKeys.includes( k ) )
        : [];
    const unselected = allKeys.filter( ( k ) => ! selected.includes( k ) );

    const emit = ( arr ) => onChange( arr.length ? arr.join( ',' ) : null );

    const rowStyle = ( bg ) => ( {
        display: 'flex',
        alignItems: 'center',
        padding: '3px 8px',
        gap: '4px',
        borderBottom: '1px solid #eee',
        background: bg,
    } );

    const list = (
        <div
            style={ {
                border: '1px solid #ddd',
                borderRadius: '2px',
                maxHeight,
                overflowY: 'auto',
            } }
        >
            { selected.length === 0 && unselected.length === 0 && (
                <div
                    style={ {
                        padding: '8px 12px',
                        color: '#757575',
                        fontSize: '13px',
                    } }
                >
                    No maps configured.
                </div>
            ) }
            { selected.map( ( key, i ) => (
                <div key={ key } style={ rowStyle( '#fff' ) }>
                    <span style={ { flex: 1, fontSize: '13px' } }>
                        { allMaps[ key ]?.label ?? key }
                    </span>
                    { i === 0 && (
                        <span
                            title="Active (shown first)"
                            style={ {
                                fontSize: '10px',
                                color: '#007cba',
                                fontWeight: 700,
                                flexShrink: 0,
                            } }
                        >
                            { '●' }
                        </span>
                    ) }
                    <Button
                        size="compact"
                        disabled={ i === 0 }
                        onClick={ () => {
                            const n = [ ...selected ];
                            [ n[ i - 1 ], n[ i ] ] = [ n[ i ], n[ i - 1 ] ];
                            emit( n );
                        } }
                    >
                        ↑
                    </Button>
                    <Button
                        size="compact"
                        disabled={ i === selected.length - 1 }
                        onClick={ () => {
                            const n = [ ...selected ];
                            [ n[ i ], n[ i + 1 ] ] = [ n[ i + 1 ], n[ i ] ];
                            emit( n );
                        } }
                    >
                        ↓
                    </Button>
                    <Button
                        size="compact"
                        isDestructive
                        disabled={ selected.length <= minSelected }
                        onClick={ () =>
                            emit( selected.filter( ( k ) => k !== key ) )
                        }
                    >
                        ×
                    </Button>
                </div>
            ) ) }
            { unselected.length > 0 && (
                <div
                    style={ {
                        borderTop:
                            selected.length > 0 ? '1px solid #ccc' : 'none',
                    } }
                >
                    { unselected.map( ( key ) => (
                        <div key={ key } style={ rowStyle( '#f6f7f7' ) }>
                            <span
                                style={ {
                                    flex: 1,
                                    fontSize: '13px',
                                    color: '#50575e',
                                } }
                            >
                                { allMaps[ key ]?.label ?? key }
                            </span>
                            <Button
                                size="compact"
                                onClick={ () => emit( [ ...selected, key ] ) }
                            >
                                + Add
                            </Button>
                        </div>
                    ) ) }
                </div>
            ) }
        </div>
    );

    if ( label ) {
        return (
            <BaseControl
                label={ label }
                help={ help }
                __nextHasNoMarginBottom
            >
                <div style={ { marginTop: '8px' } }>{ list }</div>
            </BaseControl>
        );
    }

    return list;
}
