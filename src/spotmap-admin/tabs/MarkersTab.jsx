import { useState, useEffect } from '@wordpress/element';
import { Button, SelectControl, Spinner } from '@wordpress/components';
import * as api from '../api';
import IconPicker from '../components/IconPicker';

const ICON_SHAPES = [
    { value: 'marker', label: 'Marker' },
    { value: 'circle', label: 'Circle' },
    { value: 'circle-dot', label: 'Circle Dot' },
];

export default function MarkersTab( { onNoticeChange } ) {
    const [ markers, setMarkers ] = useState( null );
    const [ saving, setSaving ] = useState( false );
    const [ pickerFor, setPickerFor ] = useState( null ); // marker type key

    useEffect( () => {
        api.getMarkers()
            .then( setMarkers )
            .catch( ( err ) =>
                onNoticeChange( { status: 'error', text: err.message } )
            );
    }, [ onNoticeChange ] );

    const update = ( type, key, value ) =>
        setMarkers( ( prev ) => ( {
            ...prev,
            [ type ]: { ...prev[ type ], [ key ]: value },
        } ) );

    const handleSave = async () => {
        setSaving( true );
        try {
            const saved = await api.updateMarkers( markers );
            setMarkers( saved );
            onNoticeChange( {
                status: 'success',
                text: 'Marker settings saved.',
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        } finally {
            setSaving( false );
        }
    };

    if ( ! markers ) {
        return <Spinner />;
    }

    return (
        <div style={ { marginTop: '1rem' } }>
            <table className="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style={ { width: '140px' } }>Type</th>
                        <th style={ { width: '160px' } }>Shape</th>
                        <th style={ { width: '200px' } }>Icon</th>
                    </tr>
                </thead>
                <tbody>
                    { Object.entries( markers ).map( ( [ type, config ] ) => (
                        <tr key={ type }>
                            <td>
                                <strong>{ type }</strong>
                            </td>
                            <td>
                                <SelectControl
                                    value={ config.iconShape }
                                    options={ ICON_SHAPES }
                                    onChange={ ( val ) =>
                                        update( type, 'iconShape', val )
                                    }
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                />
                            </td>
                            <td>
                                <div
                                    style={ {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    } }
                                >
                                    <i
                                        className={ `fas fa-${ config.icon }` }
                                        style={ {
                                            fontSize: '1.3em',
                                            width: '1.5em',
                                            textAlign: 'center',
                                        } }
                                    />
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={ () => setPickerFor( type ) }
                                    >
                                        { config.icon || 'Pick icon…' }
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ) ) }
                </tbody>
            </table>

            <Button
                variant="primary"
                isBusy={ saving }
                style={ { marginTop: '1rem' } }
                onClick={ handleSave }
            >
                Save Marker Settings
            </Button>

            { pickerFor && (
                <IconPicker
                    current={ markers[ pickerFor ]?.icon ?? '' }
                    onSelect={ ( icon ) => {
                        update( pickerFor, 'icon', icon );
                        setPickerFor( null );
                    } }
                    onClose={ () => setPickerFor( null ) }
                />
            ) }
        </div>
    );
}
