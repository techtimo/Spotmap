import {
    CheckboxControl,
    Dropdown,
    Flex,
    FlexItem,
    ToolbarButton,
    ToolbarGroup,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

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
            ? [ mapKey, ...maps ]
            : maps.filter( ( m ) => m !== mapKey );
        onChangeMaps( next );
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
                                    <CheckboxControl
                                        __nextHasNoMarginBottom
                                        label={
                                            window.spotmapjsobj?.maps[ mapKey ]
                                                ?.label ?? mapKey
                                        }
                                        checked={ maps.includes( mapKey ) }
                                        disabled={
                                            maps.includes( mapKey ) &&
                                            maps.length <= 1
                                        }
                                        onChange={ ( checked ) =>
                                            toggleMap( mapKey, checked )
                                        }
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
