import { useState } from '@wordpress/element';
import {
    CheckboxControl,
    Dropdown,
    Flex,
    FlexItem,
    ToolbarButton,
    ToolbarGroup,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * A single row in the base-layer list. Shows a permanent "● active" badge for the
 * primary map, and a hover-only "set active" link for other checked layers.
 */
function MapRowItem( {
    mapKey,
    label,
    isChecked,
    isActive,
    isDisabled,
    onToggle,
    onSetActive,
} ) {
    const [ hovered, setHovered ] = useState( false );
    return (
        <div
            onMouseEnter={ () => setHovered( true ) }
            onMouseLeave={ () => setHovered( false ) }
            style={ { display: 'flex', alignItems: 'center', gap: '6px' } }
        >
            <div style={ { flex: 1 } }>
                <CheckboxControl
                    __nextHasNoMarginBottom
                    label={ label }
                    checked={ isChecked }
                    disabled={ isDisabled }
                    onChange={ onToggle }
                />
            </div>
            { isActive && (
                <span
                    title={ __( 'Currently shown by default' ) }
                    style={ {
                        fontSize: '10px',
                        color: '#007cba',
                        fontWeight: 700,
                        flexShrink: 0,
                        lineHeight: 1,
                    } }
                >
                    { '●' }
                </span>
            ) }
            { ! isActive && isChecked && hovered && (
                <button
                    type="button"
                    title={ __( 'Show this layer first by default' ) }
                    style={ {
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: '#007cba',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        textDecoration: 'underline',
                    } }
                    onClick={ () => onSetActive( mapKey ) }
                >
                    { __( 'set active' ) }
                </button>
            ) }
        </div>
    );
}

const MAP_ICON = (
    <svg
        width="800px"
        height="800px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M9 20L3 17V4L9 7M9 20L15 17M9 20V7M15 17L21 20V7L15 4M15 17V4M9 7L15 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/**
 * Toolbar group for selecting tile layers and overlays.
 *
 * @param {Object}   props
 * @param {string[]} props.maps             Selected base layer keys.
 * @param {string[]} props.mapOverlays      Selected overlay keys.
 * @param {Function} props.onChangeMaps     Called with new maps array.
 * @param {Function} props.onChangeOverlays Called with new overlays array.
 */
export default function MapsToolbarGroup( {
    maps,
    mapOverlays,
    onChangeMaps,
    onChangeOverlays,
} ) {
    const availableMaps = window.spotmapjsobj?.maps
        ? Object.keys( window.spotmapjsobj.maps )
        : [];
    const availableOverlays = window.spotmapjsobj?.overlays
        ? Object.keys( window.spotmapjsobj.overlays )
        : [];

    const toggleMap = ( mapKey, checked ) => {
        if ( ! checked && maps.length <= 1 ) {
            return;
        }
        const next = checked
            ? [ ...maps, mapKey ] // append so active (index 0) stays unchanged
            : maps.filter( ( m ) => m !== mapKey );
        onChangeMaps( next );
    };

    const setActiveMap = ( mapKey ) => {
        onChangeMaps( [ mapKey, ...maps.filter( ( m ) => m !== mapKey ) ] );
    };

    const toggleOverlay = ( overlayKey, checked ) => {
        const current = mapOverlays || [];
        const next = checked
            ? [ ...current, overlayKey ]
            : current.filter( ( o ) => o !== overlayKey );
        onChangeOverlays( next );
    };

    return (
        <ToolbarGroup>
            <Dropdown
                popoverProps={ { placement: 'bottom-start' } }
                renderToggle={ ( { isOpen, onToggle } ) => (
                    <ToolbarButton
                        icon={ MAP_ICON }
                        label={ __( 'Maps' ) }
                        onClick={ onToggle }
                        isPressed={ isOpen }
                    >
                        { __( 'Maps' ) }
                    </ToolbarButton>
                ) }
                renderContent={ () => (
                    <div style={ { padding: '8px', minWidth: '200px' } }>
                        { availableMaps.length === 0 && (
                            <p>{ __( 'No maps available.' ) }</p>
                        ) }
                        <Flex direction="column" gap={ 1 }>
                            { availableMaps.map( ( mapKey ) => (
                                <FlexItem key={ mapKey }>
                                    <MapRowItem
                                        mapKey={ mapKey }
                                        label={
                                            window.spotmapjsobj?.maps[ mapKey ]
                                                ?.label ?? mapKey
                                        }
                                        isChecked={ maps.includes( mapKey ) }
                                        isActive={ maps[ 0 ] === mapKey }
                                        isDisabled={
                                            maps.includes( mapKey ) &&
                                            maps.length <= 1
                                        }
                                        onToggle={ ( checked ) =>
                                            toggleMap( mapKey, checked )
                                        }
                                        onSetActive={ setActiveMap }
                                    />
                                </FlexItem>
                            ) ) }
                        </Flex>
                        { availableOverlays.length > 0 && (
                            <>
                                <hr />
                                <Flex direction="column" gap={ 1 }>
                                    { availableOverlays.map( ( overlayKey ) => (
                                        <FlexItem key={ overlayKey }>
                                            <CheckboxControl
                                                __nextHasNoMarginBottom
                                                label={
                                                    window.spotmapjsobj
                                                        ?.overlays[ overlayKey ]
                                                        ?.label ?? overlayKey
                                                }
                                                checked={ (
                                                    mapOverlays || []
                                                ).includes( overlayKey ) }
                                                onChange={ ( checked ) =>
                                                    toggleOverlay(
                                                        overlayKey,
                                                        checked
                                                    )
                                                }
                                            />
                                        </FlexItem>
                                    ) ) }
                                </Flex>
                            </>
                        ) }
                    </div>
                ) }
            />
        </ToolbarGroup>
    );
}
