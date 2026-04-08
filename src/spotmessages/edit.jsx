import { useEffect, useRef, useState } from '@wordpress/element';
import { BlockControls, useBlockProps } from '@wordpress/block-editor';
import {
    Button,
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
    'TRACK',
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

    const tableRef = useRef( null );
    const spotmapRef = useRef( null );
    const [ tableId ] = useState(
        () => 'spotmap-msgs-' + Math.random().toString( 36 ).slice( 2, 10 )
    );

    const blockProps = useBlockProps( {
        style: { padding: '12px', background: '#f0f0f0', borderRadius: '4px' },
    } );

    // Inject plugin CSS into the editor document (handles iframe rendering).
    useEffect( () => {
        const el = tableRef.current;
        if ( ! el ) {
            return;
        }
        const doc = el.ownerDocument;
        const baseUrl = window.spotmapjsobj?.url || '';
        const href = baseUrl + 'css/custom.css';
        if ( doc.querySelector( `link[href="${ href }"]` ) ) {
            return;
        }
        const link = doc.createElement( 'link' );
        link.rel = 'stylesheet';
        link.href = href;
        doc.head.appendChild( link );
        return () => link.remove();
    }, [] );

    // Render live table preview whenever relevant attributes change.
    // Debounced so rapid attribute changes (sliders, typing) don't abort
    // in-flight requests — the current fetch is allowed to complete, then
    // the instance is replaced after the debounce settles.
    useEffect( () => {
        if ( ! tableRef.current || typeof window.Spotmap === 'undefined' ) {
            return;
        }

        // Mirror render-block-messages.php: empty feeds means "show all feeds".
        const resolvedFeeds = feeds.length > 0 ? feeds : availableFeeds;

        const options = {
            feeds: resolvedFeeds,
            type: types,
            filterPoints,
            dateRange,
            orderBy: 'time DESC',
            limit: count,
            groupBy,
            autoReload: false,
            debug: false,
            tableElement: tableRef.current,
        };

        const timer = setTimeout( () => {
            if ( spotmapRef.current ) {
                spotmapRef.current.destroy();
                spotmapRef.current = null;
            }

            try {
                const sm = new window.Spotmap( options );
                spotmapRef.current = sm;
                sm.initTable( tableId );
            } catch ( e ) {
                // eslint-disable-next-line no-console
                console.error( 'Spotmap table preview error:', e );
            }
        }, 300 );

        // Only cancel the pending timer — do NOT abort an already-running fetch.
        return () => clearTimeout( timer );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ tableId, feeds, types, filterPoints, dateRange, count, groupBy ] );

    // Destroy on unmount only (separate from the debounced effect above).
    useEffect( () => {
        return () => {
            if ( spotmapRef.current ) {
                spotmapRef.current.destroy();
                spotmapRef.current = null;
            }
        };
    }, [] );

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
                                { availableFeeds.length > 0 && (
                                    <Flex
                                        gap={ 2 }
                                        style={ {
                                            marginBottom: '8px',
                                            paddingBottom: '8px',
                                            borderBottom: '1px solid #ddd',
                                        } }
                                    >
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={ () =>
                                                setAttributes( {
                                                    feeds: [
                                                        ...availableFeeds,
                                                    ],
                                                } )
                                            }
                                        >
                                            { __( 'Select all', 'spotmap' ) }
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={ () =>
                                                setAttributes( { feeds: [] } )
                                            }
                                        >
                                            { __( 'Select none', 'spotmap' ) }
                                        </Button>
                                    </Flex>
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
                                                margin: '8px 0 0',
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
                <table ref={ tableRef } id={ tableId }></table>
            </div>
        </>
    );
}
