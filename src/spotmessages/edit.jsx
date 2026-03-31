import { BlockControls, useBlockProps } from '@wordpress/block-editor';
import {
    CheckboxControl,
    Dropdown,
    Flex,
    FlexItem,
    RangeControl,
    SelectControl,
    ToggleControl,
    ToolbarButton,
    ToolbarGroup,
    __experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { settings } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import TimeToolbarGroup from '../spotmap/components/TimeToolbarGroup';

const ALL_TYPES = [
    'OK',
    'CUSTOM',
    'HELP',
    'HELP-CANCEL',
    'SOS',
    'TRACK',
    'EXTREME-TRACK',
    'UNLIMITED-TRACK',
    'MEDIA',
    'NEWMOVEMENT',
];

export default function Edit( { attributes, setAttributes } ) {
    const {
        feeds,
        count,
        types,
        groupBy,
        autoReload,
        dateRange,
        filterPoints,
    } = attributes;

    const availableFeeds =
        typeof spotmapjsobj !== 'undefined' ? spotmapjsobj.feeds ?? [] : [];

    const blockProps = useBlockProps( {
        style: { padding: '12px', background: '#f0f0f0', borderRadius: '4px' },
    } );

    const toggleType = ( type, checked ) => {
        setAttributes( {
            types: checked
                ? [ ...types, type ]
                : types.filter( ( t ) => t !== type ),
        } );
    };

    const toggleFeed = ( feed, checked ) => {
        setAttributes( {
            feeds: checked
                ? [ ...feeds, feed ]
                : feeds.filter( ( f ) => f !== feed ),
        } );
    };

    const GROUP_BY_LABELS = {
        'feed_name, type': __( 'Latest per feed & type', 'spotmap' ),
        feed_name: __( 'Latest per feed', 'spotmap' ),
        type: __( 'Latest per type', 'spotmap' ),
    };
    const groupByLabel =
        GROUP_BY_LABELS[ groupBy ] ?? __( 'No grouping', 'spotmap' );

    const activeFeedsLabel =
        feeds.length === 0 ? __( 'All feeds', 'spotmap' ) : feeds.join( ', ' );

    const activeTypesLabel =
        types.length === 0 ? __( 'All types', 'spotmap' ) : types.join( ', ' );

    return (
        <>
            <BlockControls>
                { /* Feeds */ }
                <ToolbarGroup>
                    <Dropdown
                        popoverProps={ { placement: 'bottom-start' } }
                        renderToggle={ ( { isOpen, onToggle } ) => (
                            <ToolbarButton
                                icon="rss"
                                label={ __( 'Feeds', 'spotmap' ) }
                                onClick={ onToggle }
                                isPressed={ isOpen }
                            >
                                { __( 'Feeds', 'spotmap' ) }
                            </ToolbarButton>
                        ) }
                        renderContent={ () => (
                            <div
                                style={ { padding: '8px', minWidth: '200px' } }
                            >
                                { availableFeeds.length === 0 && (
                                    <p>{ __( 'No feeds yet.', 'spotmap' ) }</p>
                                ) }
                                { availableFeeds.map( ( feed ) => (
                                    <Flex key={ feed } gap={ 2 } align="center">
                                        <FlexItem isBlock>
                                            <CheckboxControl
                                                __nextHasNoMarginBottom
                                                label={ feed }
                                                checked={ feeds.includes(
                                                    feed
                                                ) }
                                                onChange={ ( checked ) =>
                                                    toggleFeed( feed, checked )
                                                }
                                            />
                                        </FlexItem>
                                    </Flex>
                                ) ) }
                                { availableFeeds.length > 0 &&
                                    feeds.length === 0 && (
                                        <p
                                            style={ {
                                                margin: '4px 0 0',
                                                fontSize: '11px',
                                                color: '#757575',
                                            } }
                                        >
                                            { __(
                                                'All feeds shown when none selected',
                                                'spotmap'
                                            ) }
                                        </p>
                                    ) }
                            </div>
                        ) }
                    />
                </ToolbarGroup>

                { /* Time filter */ }
                <TimeToolbarGroup
                    dateRange={ dateRange }
                    onChangeDateRange={ ( next ) =>
                        setAttributes( { dateRange: next } )
                    }
                />

                { /* Table settings */ }
                <ToolbarGroup>
                    <Dropdown
                        popoverProps={ { placement: 'bottom-start' } }
                        renderToggle={ ( { isOpen, onToggle } ) => (
                            <ToolbarButton
                                label={ __( 'Table settings', 'spotmap' ) }
                                icon={ settings }
                                onClick={ onToggle }
                                isPressed={ isOpen }
                            >
                                { __( 'Settings', 'spotmap' ) }
                            </ToolbarButton>
                        ) }
                        renderContent={ () => (
                            <div
                                style={ {
                                    padding: '12px',
                                    minWidth: '280px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                } }
                            >
                                <SelectControl
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                    label={ __( 'Group by', 'spotmap' ) }
                                    value={ groupBy }
                                    options={ [
                                        {
                                            label: __(
                                                'Latest per feed & type',
                                                'spotmap'
                                            ),
                                            value: 'feed_name, type',
                                        },
                                        {
                                            label: __(
                                                'Latest per feed',
                                                'spotmap'
                                            ),
                                            value: 'feed_name',
                                        },
                                        {
                                            label: __(
                                                'Latest per type',
                                                'spotmap'
                                            ),
                                            value: 'type',
                                        },
                                        {
                                            label: __(
                                                'No grouping (list)',
                                                'spotmap'
                                            ),
                                            value: '',
                                        },
                                    ] }
                                    onChange={ ( val ) =>
                                        setAttributes( { groupBy: val } )
                                    }
                                />
                                <RangeControl
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                    label={ __( 'Max rows', 'spotmap' ) }
                                    value={ count }
                                    onChange={ ( val ) =>
                                        setAttributes( { count: val } )
                                    }
                                    min={ 1 }
                                    max={ 200 }
                                />
                                <UnitControl
                                    __nextHasNoMarginBottom
                                    __next40pxDefaultSize
                                    label={ __(
                                        'Hide nearby points',
                                        'spotmap'
                                    ) }
                                    value={ `${ filterPoints }m` }
                                    units={ [
                                        {
                                            value: 'm',
                                            label: 'Meter',
                                            default: 5,
                                        },
                                    ] }
                                    onChange={ ( val ) =>
                                        setAttributes( {
                                            filterPoints: parseInt( val ) || 0,
                                        } )
                                    }
                                    help={ __(
                                        'Hide duplicate points within this radius',
                                        'spotmap'
                                    ) }
                                />
                                <ToggleControl
                                    __nextHasNoMarginBottom
                                    label={ __( 'Auto-reload', 'spotmap' ) }
                                    checked={ autoReload }
                                    onChange={ ( val ) =>
                                        setAttributes( { autoReload: val } )
                                    }
                                    help={ __(
                                        'Refresh table data every 30 seconds',
                                        'spotmap'
                                    ) }
                                />
                                <p
                                    style={ {
                                        margin: '8px 0 4px',
                                        fontWeight: 600,
                                        fontSize: '11px',
                                        textTransform: 'uppercase',
                                        color: '#1e1e1e',
                                    } }
                                >
                                    { __( 'Filter by type', 'spotmap' ) }
                                </p>
                                <p
                                    style={ {
                                        margin: '0 0 4px',
                                        fontSize: '11px',
                                        color: '#757575',
                                    } }
                                >
                                    { __(
                                        'Leave all unchecked to show every type.',
                                        'spotmap'
                                    ) }
                                </p>
                                { ALL_TYPES.map( ( type ) => (
                                    <CheckboxControl
                                        __nextHasNoMarginBottom
                                        key={ type }
                                        label={ type }
                                        checked={ types.includes( type ) }
                                        onChange={ ( checked ) =>
                                            toggleType( type, checked )
                                        }
                                    />
                                ) ) }
                            </div>
                        ) }
                    />
                </ToolbarGroup>
            </BlockControls>

            <div { ...blockProps }>
                <strong>{ __( 'Spot Messages', 'spotmap' ) }</strong>
                <table
                    style={ {
                        width: '100%',
                        borderCollapse: 'collapse',
                        marginTop: '8px',
                        fontSize: '13px',
                    } }
                >
                    <thead>
                        <tr style={ { background: '#ddd' } }>
                            { groupBy === 'feed_name' && (
                                <th
                                    style={ {
                                        padding: '4px 8px',
                                        textAlign: 'left',
                                    } }
                                >
                                    { __( 'Feed', 'spotmap' ) }
                                </th>
                            ) }
                            <th
                                style={ {
                                    padding: '4px 8px',
                                    textAlign: 'left',
                                } }
                            >
                                { __( 'Type', 'spotmap' ) }
                            </th>
                            <th
                                style={ {
                                    padding: '4px 8px',
                                    textAlign: 'left',
                                } }
                            >
                                { __( 'Message', 'spotmap' ) }
                            </th>
                            <th
                                style={ {
                                    padding: '4px 8px',
                                    textAlign: 'left',
                                } }
                            >
                                { __( 'Time', 'spotmap' ) }
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td
                                colSpan={ groupBy === 'feed_name' ? 4 : 3 }
                                style={ {
                                    padding: '8px',
                                    color: '#777',
                                    fontStyle: 'italic',
                                } }
                            >
                                { groupByLabel } &mdash; { activeFeedsLabel }{ ' ' }
                                &mdash; { activeTypesLabel } &mdash; { count }{ ' ' }
                                { __( 'rows', 'spotmap' ) }
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}
