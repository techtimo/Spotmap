import { useState, useEffect, useMemo } from '@wordpress/element';
import {
    Button,
    // eslint-disable-next-line @wordpress/no-unsafe-wp-apis
    __experimentalConfirmDialog as ConfirmDialog,
    Modal,
    Spinner,
    TextControl,
} from '@wordpress/components';
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import '../admin.css';
import * as api from '../api';
import FeedModal from '../components/FeedModal';
import FeedStatsModal from '../components/FeedStatsModal';
import GpxDownloadModal from '../components/GpxDownloadModal';
import ProviderSelector from '../components/ProviderSelector';

const isMediaFeed = ( type ) => type === 'media';
const SINGLETON_TYPES = [ 'media', 'posts' ];

const STORAGE_KEY = 'spotmap_feeds_view';
const DEFAULT_VIEW = {
    type: 'table',
    perPage: 25,
    page: 1,
    sort: { field: 'name', direction: 'asc' },
    fields: [ 'name', 'typeLabel', 'pointCount', 'status' ],
    filters: [],
    search: '',
    layout: {},
};

const STATUS_ELEMENTS = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'orphaned', label: 'DB only' },
];

const formatTimestamp = ( ts ) =>
    ts
        ? new Date( ts * 1000 ).toLocaleString( [], {
              dateStyle: 'short',
              timeStyle: 'short',
          } )
        : '—';

export default function FeedsTab( {
    providers,
    openAddModal,
    onNoticeChange = () => {},
} ) {
    const [ feeds, setFeeds ] = useState( null );
    const [ dbFeeds, setDbFeeds ] = useState( null );
    const [ loading, setLoading ] = useState( true );
    const [ showPicker, setShowPicker ] = useState( openAddModal );
    const [ editingFeed, setEditingFeed ] = useState( null );
    const [ confirmDeleteConfig, setConfirmDeleteConfig ] = useState( null );
    const [ confirmDeletePoints, setConfirmDeletePoints ] = useState( null );
    const [ confirmDeleteBoth, setConfirmDeleteBoth ] = useState( null );
    const [ confirmDeleteDbFeed, setConfirmDeleteDbFeed ] = useState( null );
    const [ statsFeed, setStatsFeed ] = useState( null );
    const [ renamingDbFeed, setRenamingDbFeed ] = useState( null );
    const [ renameSaving, setRenameSaving ] = useState( false );
    const [ gpxDownloadFeed, setGpxDownloadFeed ] = useState( null );

    const [ view, setView ] = useState( () => {
        try {
            const saved = window.localStorage.getItem( STORAGE_KEY );
            return saved
                ? { ...DEFAULT_VIEW, ...JSON.parse( saved ) }
                : DEFAULT_VIEW;
        } catch {
            return DEFAULT_VIEW;
        }
    } );

    useEffect( () => {
        let cancelled = false;
        Promise.all( [ api.getFeeds(), api.getDbFeeds() ] )
            .then( ( [ feedData, dbFeedData ] ) => {
                if ( ! cancelled ) {
                    setFeeds( feedData );
                    setDbFeeds( dbFeedData );
                }
            } )
            .catch( ( err ) => {
                if ( ! cancelled ) {
                    setFeeds( [] );
                    setDbFeeds( [] );
                    onNoticeChange( { status: 'error', text: err.message } );
                }
            } )
            .finally( () => {
                if ( ! cancelled ) {
                    setLoading( false );
                }
            } );
        return () => {
            cancelled = true;
        };
    }, [ onNoticeChange ] );

    const handleViewChange = ( newView ) => {
        setView( newView );
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify( newView )
            );
        } catch {}
    };

    const handleSave = async ( data, id ) => {
        const saved = id
            ? await api.updateFeed( id, data )
            : await api.createFeed( data );
        setFeeds( ( prev ) =>
            id
                ? prev.map( ( f ) => ( f.id === id ? saved : f ) )
                : [ ...prev, saved ]
        );
        setEditingFeed( null );
        onNoticeChange( { status: 'success', text: 'Feed saved.' } );
    };

    const handleTogglePause = async ( feed ) => {
        try {
            const updated = feed.paused
                ? await api.unpauseFeed( feed.id )
                : await api.pauseFeed( feed.id );
            setFeeds( ( prev ) =>
                prev.map( ( f ) =>
                    f.id === feed.id ? { ...f, paused: updated.paused } : f
                )
            );
            onNoticeChange( {
                status: 'success',
                text: updated.paused ? 'Feed paused.' : 'Feed resumed.',
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        }
    };

    const handleImportPhotos = async ( feed ) => {
        try {
            const result = await api.importPhotos( feed.id );
            const count = result.imported ?? 0;
            setFeeds( ( prev ) =>
                prev.map( ( f ) =>
                    f.id === feed.id
                        ? { ...f, point_count: ( f.point_count ?? 0 ) + count }
                        : f
                )
            );
            onNoticeChange( {
                status: 'success',
                text:
                    count > 0
                        ? `Imported ${ count } photo${
                              count === 1 ? '' : 's'
                          }.`
                        : 'No new photos found to import.',
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        }
    };

    const handleDeleteConfigOnly = async ( feed ) => {
        setConfirmDeleteConfig( null );
        try {
            await api.deleteFeed( feed.id, false );
            setFeeds( ( prev ) => prev.filter( ( f ) => f.id !== feed.id ) );
            onNoticeChange( {
                status: 'success',
                text: `Feed config "${ feed.name }" deleted. GPS points kept.`,
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        }
    };

    const handleDeletePointsOnly = async ( feed ) => {
        setConfirmDeletePoints( null );
        try {
            await api.deleteDbFeedPoints( feed.name );
            setDbFeeds( ( prev ) =>
                prev.filter( ( d ) => d.feed_name !== feed.name )
            );
            setFeeds( ( prev ) =>
                prev.map( ( f ) =>
                    f.id === feed.id ? { ...f, point_count: 0 } : f
                )
            );
            onNoticeChange( {
                status: 'success',
                text: `All points for "${ feed.name }" deleted. Feed config kept.`,
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        }
    };

    const handleDeleteBoth = async ( feed ) => {
        setConfirmDeleteBoth( null );
        try {
            await api.deleteFeed( feed.id, true );
            setFeeds( ( prev ) => prev.filter( ( f ) => f.id !== feed.id ) );
            setDbFeeds( ( prev ) =>
                prev.filter( ( d ) => d.feed_name !== feed.name )
            );
            onNoticeChange( {
                status: 'success',
                text: `Feed "${ feed.name }" and all its points deleted.`,
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        }
    };

    const handleDeleteDbFeedConfirm = async () => {
        const { feedName } = confirmDeleteDbFeed;
        setConfirmDeleteDbFeed( null );
        try {
            await api.deleteDbFeedPoints( feedName );
            setDbFeeds( ( prev ) =>
                prev.filter( ( d ) => d.feed_name !== feedName )
            );
            setFeeds( ( prev ) =>
                prev.map( ( f ) =>
                    f.name === feedName ? { ...f, point_count: 0 } : f
                )
            );
            onNoticeChange( {
                status: 'success',
                text: `All points for "${ feedName }" deleted.`,
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        }
    };

    const handleRenameDbFeed = async () => {
        const { feedName, newName } = renamingDbFeed;
        setRenameSaving( true );
        try {
            const updated = await api.renameDbFeed( feedName, newName.trim() );
            setDbFeeds( ( prev ) =>
                prev.map( ( d ) => ( d.feed_name === feedName ? updated : d ) )
            );
            setRenamingDbFeed( null );
            onNoticeChange( {
                status: 'success',
                text: `Feed renamed from "${ feedName }" to "${ updated.feed_name }".`,
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        } finally {
            setRenameSaving( false );
        }
    };

    const allItems = useMemo( () => {
        const feedList = feeds ?? [];
        const configuredNames = new Set( feedList.map( ( f ) => f.name ) );
        const orphanedDbFeeds = ( dbFeeds ?? [] ).filter(
            ( d ) => ! configuredNames.has( d.feed_name )
        );
        const dbByName = new Map(
            ( dbFeeds ?? [] ).map( ( d ) => [ d.feed_name, d ] )
        );
        return [
            ...feedList.map( ( feed ) => {
                const dbRow = dbByName.get( feed.name );
                return {
                    id: String( feed.id ),
                    name: feed.name,
                    typeLabel: providers[ feed.type ]?.label ?? feed.type,
                    pointCount: feed.point_count ?? 0,
                    firstPoint: dbRow?.first_point ?? null,
                    lastPoint: dbRow?.last_point ?? null,
                    status: feed.paused ? 'paused' : 'active',
                    isOrphaned: false,
                    _feed: feed,
                };
            } ),
            ...orphanedDbFeeds.map( ( d ) => ( {
                id: `db-${ d.feed_name }`,
                name: d.feed_name,
                typeLabel: 'DB only',
                pointCount: d.point_count,
                firstPoint: d.first_point ?? null,
                lastPoint: d.last_point ?? null,
                status: 'orphaned',
                isOrphaned: true,
                _feed: null,
                _dbFeed: d,
            } ) ),
        ];
    }, [ feeds, dbFeeds, providers ] );

    const fields = useMemo( () => {
        const typeElements = [
            ...new Set( allItems.map( ( i ) => i.typeLabel ) ),
        ]
            .sort()
            .map( ( label ) => ( { value: label, label } ) );
        return [
            {
                id: 'name',
                label: 'Name',
                enableSorting: true,
                enableGlobalSearch: true,
            },
            {
                id: 'typeLabel',
                label: 'Type',
                enableSorting: false,
                enableHiding: true,
                elements: typeElements,
                filterBy: { operators: [ 'is' ] },
            },
            {
                id: 'pointCount',
                label: 'Points in DB',
                enableSorting: true,
                enableHiding: true,
            },
            {
                id: 'status',
                label: 'Status',
                enableSorting: false,
                enableHiding: true,
                elements: STATUS_ELEMENTS,
                filterBy: { operators: [ 'is' ] },
                render: ( { item } ) => {
                    if ( item.status === 'paused' ) {
                        return 'Paused';
                    }
                    if ( item.status === 'orphaned' ) {
                        return 'DB only';
                    }
                    return 'Active';
                },
            },
            {
                id: 'firstPoint',
                label: 'First point',
                enableSorting: true,
                enableHiding: true,
                render: ( { item } ) => formatTimestamp( item.firstPoint ),
            },
            {
                id: 'lastPoint',
                label: 'Last point',
                enableSorting: true,
                enableHiding: true,
                render: ( { item } ) => formatTimestamp( item.lastPoint ),
            },
        ];
    }, [ allItems ] );

    const actions = useMemo(
        () => [
            {
                id: 'edit',
                label: 'Edit',
                isEligible: ( item ) => ! item.isOrphaned,
                callback: ( [ item ] ) => setEditingFeed( item._feed ),
            },
            {
                id: 'statistics',
                label: 'Statistics',
                callback: ( [ item ] ) =>
                    setStatsFeed(
                        item.isOrphaned ? { name: item.name } : item._feed
                    ),
            },
            {
                id: 'download-gpx',
                label: 'Download GPX',
                isEligible: ( item ) => item.pointCount > 0,
                callback: ( [ item ] ) => setGpxDownloadFeed( item.name ),
            },
            {
                id: 'pause',
                label: 'Pause feed',
                isEligible: ( item ) =>
                    ! item.isOrphaned && ! item._feed.paused,
                callback: ( [ item ] ) => handleTogglePause( item._feed ),
            },
            {
                id: 'resume',
                label: 'Resume feed',
                isEligible: ( item ) => ! item.isOrphaned && item._feed.paused,
                callback: ( [ item ] ) => handleTogglePause( item._feed ),
            },
            {
                id: 'import-photos',
                label: 'Check for new photos',
                isEligible: ( item ) =>
                    ! item.isOrphaned && isMediaFeed( item._feed?.type ),
                callback: ( [ item ] ) => handleImportPhotos( item._feed ),
            },
            {
                id: 'rename',
                label: 'Rename',
                isEligible: ( item ) => item.isOrphaned,
                callback: ( [ item ] ) =>
                    setRenamingDbFeed( {
                        feedName: item.name,
                        newName: item.name,
                    } ),
            },
            {
                id: 'delete-config',
                label: 'Delete config',
                isDestructive: true,
                isEligible: ( item ) => ! item.isOrphaned,
                callback: ( [ item ] ) => setConfirmDeleteConfig( item._feed ),
            },
            {
                id: 'delete-points',
                label: 'Delete points',
                isDestructive: true,
                isEligible: ( item ) => ! item.isOrphaned,
                callback: ( [ item ] ) => setConfirmDeletePoints( item._feed ),
            },
            {
                id: 'delete-feed',
                label: 'Delete feed and points',
                isDestructive: true,
                isEligible: ( item ) => ! item.isOrphaned,
                callback: ( [ item ] ) => setConfirmDeleteBoth( item._feed ),
            },
            {
                id: 'delete-db-points',
                label: 'Delete points',
                isDestructive: true,
                isEligible: ( item ) => item.isOrphaned,
                callback: ( [ item ] ) =>
                    setConfirmDeleteDbFeed( {
                        feedName: item.name,
                        pointCount: item.pointCount,
                    } ),
            },
        ],
        []
    ); // eslint-disable-line react-hooks/exhaustive-deps

    const { data: pageData, paginationInfo } = useMemo(
        () => filterSortAndPaginate( allItems, view, fields ),
        [ allItems, view, fields ]
    );

    if ( loading ) {
        return <Spinner />;
    }

    return (
        <div style={ { marginTop: '1rem' } }>
            <div style={ { marginBottom: '1rem' } }>
                <Button
                    variant="primary"
                    onClick={ () => setShowPicker( true ) }
                >
                    Add Feed
                </Button>
            </div>

            <div className="spotmap-feeds-dataviews">
                <DataViews
                    data={ pageData }
                    fields={ fields }
                    view={ view }
                    onChangeView={ handleViewChange }
                    actions={ actions }
                    paginationInfo={ paginationInfo }
                    getItemId={ ( item ) => item.id }
                    defaultLayouts={ { table: {} } }
                />
            </div>

            { showPicker && (
                <Modal
                    title="Add Feed"
                    size="medium"
                    onRequestClose={ () => setShowPicker( false ) }
                >
                    <ProviderSelector
                        providers={ providers }
                        value=""
                        disabledTypes={ SINGLETON_TYPES.filter( ( t ) =>
                            feeds?.some( ( f ) => f.type === t )
                        ) }
                        onChange={ ( type ) => {
                            setShowPicker( false );
                            setEditingFeed( { type } );
                        } }
                    />
                </Modal>
            ) }

            { editingFeed !== null && (
                <FeedModal
                    providers={ providers }
                    feed={ editingFeed }
                    existingFeeds={ feeds }
                    onSave={ handleSave }
                    onClose={ () => setEditingFeed( null ) }
                    onBack={
                        ! editingFeed.id
                            ? () => {
                                  setEditingFeed( null );
                                  setShowPicker( true );
                              }
                            : undefined
                    }
                />
            ) }

            { confirmDeleteConfig !== null && (
                <ConfirmDialog
                    title={ `Delete config for "${ confirmDeleteConfig.name }"?` }
                    confirmButtonText="Delete config"
                    onConfirm={ () =>
                        handleDeleteConfigOnly( confirmDeleteConfig )
                    }
                    onCancel={ () => setConfirmDeleteConfig( null ) }
                >
                    The feed configuration will be removed. The{ ' ' }
                    <strong>
                        { confirmDeleteConfig.point_count ?? 0 } GPS points
                    </strong>{ ' ' }
                    stored in the database will be kept.
                </ConfirmDialog>
            ) }

            { confirmDeletePoints !== null && (
                <ConfirmDialog
                    title={ `Delete points for "${ confirmDeletePoints.name }"?` }
                    confirmButtonText={ `Delete ${
                        confirmDeletePoints.point_count ?? 0
                    } points` }
                    onConfirm={ () =>
                        handleDeletePointsOnly( confirmDeletePoints )
                    }
                    onCancel={ () => setConfirmDeletePoints( null ) }
                >
                    Permanently delete all{ ' ' }
                    <strong>
                        { confirmDeletePoints.point_count ?? 0 } GPS points
                    </strong>{ ' ' }
                    for &quot;{ confirmDeletePoints.name }&quot;. The feed
                    configuration will be kept. This cannot be undone.
                </ConfirmDialog>
            ) }

            { confirmDeleteBoth !== null && (
                <ConfirmDialog
                    title={ `Delete feed "${ confirmDeleteBoth.name }"?` }
                    confirmButtonText="Delete feed and points"
                    onConfirm={ () => handleDeleteBoth( confirmDeleteBoth ) }
                    onCancel={ () => setConfirmDeleteBoth( null ) }
                >
                    Permanently delete the feed configuration and all{ ' ' }
                    <strong>
                        { confirmDeleteBoth.point_count ?? 0 } GPS points
                    </strong>{ ' ' }
                    for &quot;{ confirmDeleteBoth.name }&quot;. This cannot be
                    undone.
                </ConfirmDialog>
            ) }

            { confirmDeleteDbFeed !== null && (
                <ConfirmDialog
                    title={ `Delete points for "${ confirmDeleteDbFeed.feedName }"?` }
                    confirmButtonText={ `Delete ${ confirmDeleteDbFeed.pointCount } points` }
                    onConfirm={ handleDeleteDbFeedConfirm }
                    onCancel={ () => setConfirmDeleteDbFeed( null ) }
                >
                    Permanently delete all{ ' ' }
                    <strong>
                        { confirmDeleteDbFeed.pointCount } GPS points
                    </strong>{ ' ' }
                    for &quot;{ confirmDeleteDbFeed.feedName }&quot;. This
                    cannot be undone.
                </ConfirmDialog>
            ) }

            { renamingDbFeed !== null && (
                <Modal
                    title={ `Rename "${ renamingDbFeed.feedName }"` }
                    onRequestClose={ () => setRenamingDbFeed( null ) }
                >
                    <div
                        style={ {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                        } }
                    >
                        <TextControl
                            label="New name"
                            value={ renamingDbFeed.newName }
                            onChange={ ( val ) =>
                                setRenamingDbFeed( ( prev ) => ( {
                                    ...prev,
                                    newName: val,
                                } ) )
                            }
                            __nextHasNoMarginBottom
                            __next40pxDefaultSize
                        />
                        <div style={ { display: 'flex', gap: '8px' } }>
                            <Button
                                variant="primary"
                                isBusy={ renameSaving }
                                disabled={
                                    renameSaving ||
                                    renamingDbFeed.newName.trim() === '' ||
                                    renamingDbFeed.newName.trim() ===
                                        renamingDbFeed.feedName
                                }
                                onClick={ handleRenameDbFeed }
                            >
                                Rename
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={ () => setRenamingDbFeed( null ) }
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Modal>
            ) }

            { statsFeed !== null && (
                <FeedStatsModal
                    feed={ statsFeed }
                    onClose={ () => setStatsFeed( null ) }
                />
            ) }

            { gpxDownloadFeed !== null && (
                <GpxDownloadModal
                    feedName={ gpxDownloadFeed }
                    onClose={ () => setGpxDownloadFeed( null ) }
                />
            ) }
        </div>
    );
}
