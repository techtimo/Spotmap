import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import {
    PanelBody,
    SelectControl,
    ToggleControl,
    RangeControl,
    CheckboxControl,
    TextControl,
    __experimentalText as Text,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

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
    const { feeds, count, types, groupBy, autoReload, dateRange, filterPoints } =
        attributes;

    const availableFeeds =
        typeof spotmapjsobj !== 'undefined' ? spotmapjsobj.feeds ?? [] : [];

    const blockProps = useBlockProps( {
        style: { padding: '12px', background: '#f0f0f0', borderRadius: '4px' },
    } );

    const toggleType = ( type, checked ) => {
        if ( checked ) {
            setAttributes( { types: [ ...types, type ] } );
        } else {
            setAttributes( { types: types.filter( ( t ) => t !== type ) } );
        }
    };

    const toggleFeed = ( feed, checked ) => {
        if ( checked ) {
            setAttributes( { feeds: [ ...feeds, feed ] } );
        } else {
            setAttributes( { feeds: feeds.filter( ( f ) => f !== feed ) } );
        }
    };

    const activeFeedsLabel =
        feeds.length === 0
            ? __( 'All feeds', 'spotmap' )
            : feeds.join( ', ' );

    const activeTypesLabel =
        types.length === 0
            ? __( 'All types', 'spotmap' )
            : types.join( ', ' );

    const groupByLabel =
        groupBy === 'feed_name'
            ? __( 'Latest per feed', 'spotmap' )
            : groupBy === 'type'
            ? __( 'Latest per type', 'spotmap' )
            : __( 'No grouping', 'spotmap' );

    return (
        <>
            <InspectorControls>
                <PanelBody
                    title={ __( 'Feeds', 'spotmap' ) }
                    initialOpen={ true }
                >
                    { availableFeeds.length === 0 && (
                        <Text isDestructive>
                            { __(
                                'No feeds found. Add feeds in the Spotmap settings.',
                                'spotmap'
                            ) }
                        </Text>
                    ) }
                    { availableFeeds.map( ( feed ) => (
                        <CheckboxControl
                            key={ feed }
                            label={ feed }
                            checked={ feeds.includes( feed ) }
                            onChange={ ( checked ) =>
                                toggleFeed( feed, checked )
                            }
                            help={
                                feeds.length === 0 &&
                                __( '(all feeds shown when none selected)', 'spotmap' )
                            }
                        />
                    ) ) }
                </PanelBody>

                <PanelBody
                    title={ __( 'Display', 'spotmap' ) }
                    initialOpen={ true }
                >
                    <SelectControl
                        label={ __( 'Group by', 'spotmap' ) }
                        value={ groupBy }
                        options={ [
                            {
                                label: __( 'Latest per feed', 'spotmap' ),
                                value: 'feed_name',
                            },
                            {
                                label: __( 'Latest per type', 'spotmap' ),
                                value: 'type',
                            },
                            {
                                label: __( 'No grouping (list)', 'spotmap' ),
                                value: '',
                            },
                        ] }
                        onChange={ ( val ) =>
                            setAttributes( { groupBy: val } )
                        }
                        help={ __(
                            'Group by feed shows the latest message per tracker — ideal for a status overview.',
                            'spotmap'
                        ) }
                    />
                    <RangeControl
                        label={ __( 'Max rows', 'spotmap' ) }
                        value={ count }
                        onChange={ ( val ) => setAttributes( { count: val } ) }
                        min={ 1 }
                        max={ 200 }
                    />
                    <ToggleControl
                        label={ __( 'Auto-reload', 'spotmap' ) }
                        checked={ autoReload }
                        onChange={ ( val ) =>
                            setAttributes( { autoReload: val } )
                        }
                    />
                </PanelBody>

                <PanelBody
                    title={ __( 'Filter by type', 'spotmap' ) }
                    initialOpen={ false }
                >
                    <Text variant="muted">
                        { __(
                            'Leave all unchecked to show every message type.',
                            'spotmap'
                        ) }
                    </Text>
                    { ALL_TYPES.map( ( type ) => (
                        <CheckboxControl
                            key={ type }
                            label={ type }
                            checked={ types.includes( type ) }
                            onChange={ ( checked ) =>
                                toggleType( type, checked )
                            }
                        />
                    ) ) }
                </PanelBody>

                <PanelBody
                    title={ __( 'Date range', 'spotmap' ) }
                    initialOpen={ false }
                >
                    <TextControl
                        label={ __( 'From', 'spotmap' ) }
                        value={ dateRange.from }
                        placeholder="YYYY-MM-DD"
                        onChange={ ( val ) =>
                            setAttributes( {
                                dateRange: { ...dateRange, from: val },
                            } )
                        }
                    />
                    <TextControl
                        label={ __( 'To', 'spotmap' ) }
                        value={ dateRange.to }
                        placeholder="YYYY-MM-DD"
                        onChange={ ( val ) =>
                            setAttributes( {
                                dateRange: { ...dateRange, to: val },
                            } )
                        }
                    />
                </PanelBody>
            </InspectorControls>

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
                                { groupByLabel } &mdash; { activeFeedsLabel } &mdash;{ ' ' }
                                { activeTypesLabel } &mdash;{ ' ' }
                                { count }{ ' ' }
                                { __( 'rows', 'spotmap' ) }
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}
