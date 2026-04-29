import { useState, useRef } from '@wordpress/element';
import { CheckboxControl, Popover, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

// Toggle with a flyout sub-popover that reveals on hover.
export default function NavigationButtonsControl( { value, onChange } ) {
    const [ open, setOpen ] = useState( false );
    const anchorRef = useRef( null );
    const closeTimer = useRef( null );
    const update = ( key, v ) => onChange( { ...value, [ key ]: v } );

    const scheduleClose = () => {
        closeTimer.current = setTimeout( () => setOpen( false ), 150 );
    };
    const cancelClose = () => {
        if ( closeTimer.current ) {
            clearTimeout( closeTimer.current );
        }
    };

    return (
        <div
            ref={ anchorRef }
            onMouseEnter={ () => {
                cancelClose();
                setOpen( true );
            } }
            onMouseLeave={ scheduleClose }
        >
            <ToggleControl
                __nextHasNoMarginBottom
                label={ __( 'Zoom-to navigation buttons' ) }
                checked={ value.enabled }
                onChange={ ( v ) => update( 'enabled', v ) }
            />
            { open && (
                <Popover
                    anchor={ anchorRef.current }
                    placement="left-end"
                    focusOnMount={ false }
                    onClose={ () => setOpen( false ) }
                >
                    <div
                        style={ {
                            padding: '8px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            minWidth: '140px',
                        } }
                        onMouseEnter={ cancelClose }
                        onMouseLeave={ scheduleClose }
                    >
                        <CheckboxControl
                            __nextHasNoMarginBottom
                            label={ __( 'All points' ) }
                            checked={ value.allPoints }
                            onChange={ ( v ) => update( 'allPoints', v ) }
                        />
                        <CheckboxControl
                            __nextHasNoMarginBottom
                            label={ __( 'Latest point' ) }
                            checked={ value.latestPoint }
                            onChange={ ( v ) => update( 'latestPoint', v ) }
                        />
                        <CheckboxControl
                            __nextHasNoMarginBottom
                            label={ __( 'GPX tracks' ) }
                            checked={ value.gpxTracks }
                            onChange={ ( v ) => update( 'gpxTracks', v ) }
                        />
                    </div>
                </Popover>
            ) }
        </div>
    );
}
