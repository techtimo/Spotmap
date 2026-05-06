import {
    Button,
    CheckboxControl,
    Dropdown,
    Flex,
    FlexItem,
    ToolbarButton,
    ToolbarGroup,
} from '@wordpress/components';
import { brush } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Toolbar group for selecting which feeds appear on the map.
 *
 * @param {Object}        props
 * @param {string[]}      props.feeds      Selected feed names.
 * @param {string[]}      props.allFeeds   All available feed names.
 * @param {Object}        props.styles     Map of feedName → { color, ... }.
 * @param {Function}      props.onToggle   Called with (feedName, checked).
 * @param {Function|null} props.onStyle    Optional. When provided, shows a
 *                                         brush button per selected feed and
 *                                         calls onStyle(feedName) on click.
 */
export default function FeedsToolbarGroup( {
    feeds,
    allFeeds,
    styles,
    onToggle,
    onStyle = null,
} ) {
    return (
        <ToolbarGroup>
            <Dropdown
                popoverProps={ { placement: 'bottom-start' } }
                renderToggle={ ( { isOpen, onToggle: toggleDropdown } ) => (
                    <ToolbarButton
                        icon="rss"
                        label={ __( 'Feeds' ) }
                        onClick={ toggleDropdown }
                        isPressed={ isOpen }
                    >
                        { __( 'Feeds' ) }
                    </ToolbarButton>
                ) }
                renderContent={ ( { onClose } ) => (
                    <div
                        style={ {
                            padding: '8px',
                            minWidth: '220px',
                        } }
                    >
                        { allFeeds.map( ( feed ) => {
                            const isSelected = feeds.includes( feed );
                            return (
                                <Flex
                                    key={ feed }
                                    gap={ 2 }
                                    align="center"
                                    style={ { marginBottom: '4px' } }
                                >
                                    <FlexItem isBlock>
                                        <CheckboxControl
                                            __nextHasNoMarginBottom
                                            label={ feed }
                                            checked={ isSelected }
                                            onChange={ ( checked ) =>
                                                onToggle( feed, checked )
                                            }
                                        />
                                    </FlexItem>
                                    { onStyle && (
                                        <Button
                                            icon={ brush }
                                            label={ __( 'Style' ) + ' ' + feed }
                                            size="small"
                                            variant="tertiary"
                                            style={ {
                                                visibility: isSelected
                                                    ? 'visible'
                                                    : 'hidden',
                                            } }
                                            onClick={ () => {
                                                onClose();
                                                onStyle( feed );
                                            } }
                                        />
                                    ) }
                                    <span
                                        style={ {
                                            display: 'block',
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '50%',
                                            background:
                                                styles?.[ feed ]?.color ||
                                                'blue',
                                            flexShrink: 0,
                                        } }
                                    />
                                </Flex>
                            );
                        } ) }
                    </div>
                ) }
            />
        </ToolbarGroup>
    );
}
