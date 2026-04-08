import { useState, useEffect } from '@wordpress/element';
import { Button, Modal, Spinner, TextControl } from '@wordpress/components';
import * as api from '../api';
import FeedModal from '../components/FeedModal';
import FeedStatsModal from '../components/FeedStatsModal';
import ProviderSelector from '../components/ProviderSelector';

const isMediaFeed = ( type ) => type === 'media';

export default function FeedsTab( {
    providers,
    openAddModal,
    onNoticeChange = () => {},
} ) {
    const [ feeds, setFeeds ] = useState( null );
    const [ dbFeeds, setDbFeeds ] = useState( null );
    const [ loading, setLoading ] = useState( true );
    // showPicker: true = provider picker modal open
    const [ showPicker, setShowPicker ] = useState( openAddModal );
    // editingFeed: null=closed, { type } = new feed settings, full feed object = edit
    const [ editingFeed, setEditingFeed ] = useState( null );
    const [ confirmDelete, setConfirmDelete ] = useState( null ); // feed object or null
    const [ confirmDeleteDbFeed, setConfirmDeleteDbFeed ] = useState( null ); // { feedName, pointCount }
    const [ importingFeedId, setImportingFeedId ] = useState( null );
    const [ statsFeed, setStatsFeed ] = useState( null ); // feed object or null
    const [ renamingDbFeed, setRenamingDbFeed ] = useState( null ); // { feedName, newName } or null
    const [ renameSaving, setRenameSaving ] = useState( false );

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
        setImportingFeedId( feed.id );
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
                text: count > 0
                    ? `Imported ${ count } photo${ count === 1 ? '' : 's' }.`
                    : 'No new photos found to import.',
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        } finally {
            setImportingFeedId( null );
        }
    };

    const handleDeleteConfirmWith = async ( feed, deletePoints ) => {
        setConfirmDelete( null );
        try {
            await api.deleteFeed( feed.id, deletePoints );
            setFeeds( ( prev ) => prev.filter( ( f ) => f.id !== feed.id ) );
            if ( deletePoints ) {
                setDbFeeds( ( prev ) =>
                    prev.filter( ( d ) => d.feed_name !== feed.name )
                );
            }
            onNoticeChange( {
                status: 'success',
                text: deletePoints
                    ? `Feed "${ feed.name }" and all its points deleted.`
                    : `Feed "${ feed.name }" deleted.`,
            } );
        } catch ( err ) {
            onNoticeChange( { status: 'error', text: err.message } );
        }
    };

    const handleDeletePointsOnly = async ( feed ) => {
        setConfirmDelete( null );
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
                text: `All points for "${ feed.name }" deleted. Feed configuration kept.`,
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
                prev.map( ( d ) =>
                    d.feed_name === feedName ? updated : d
                )
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

    if ( loading ) {
        return <Spinner />;
    }

    const feedList = feeds ?? [];
    const configuredNames = new Set( feedList.map( ( f ) => f.name ) );
    const orphanedDbFeeds = ( dbFeeds ?? [] ).filter(
        ( d ) => ! configuredNames.has( d.feed_name )
    );

    const allRows = [
        ...feedList.map( ( feed ) => ( { kind: 'configured', feed } ) ),
        ...orphanedDbFeeds.map( ( dbFeed ) => ( { kind: 'orphaned', dbFeed } ) ),
    ];

    return (
        <div style={ { marginTop: '1rem' } }>
            { allRows.length === 0 ? (
                <p>No feeds configured yet.</p>
            ) : (
                <table
                    className="wp-list-table widefat fixed striped"
                    style={ { marginBottom: '1rem' } }
                >
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th style={ { width: '80px' } }>Points in DB</th>
                            <th style={ { width: '300px' } }>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        { allRows.map( ( row ) => {
                            if ( row.kind === 'configured' ) {
                                const feed = row.feed;
                                return (
                                    <tr key={ `feed-${ feed.id }` }>
                                        <td>{ feed.name }</td>
                                        <td>
                                            { providers[ feed.type ]?.label ??
                                                feed.type }
                                        </td>
                                        <td>{ feed.point_count ?? 0 }</td>
                                        <td>
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                onClick={ () =>
                                                    setStatsFeed( feed )
                                                }
                                            >
                                                Statistics
                                            </Button>{ ' ' }
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                onClick={ () =>
                                                    setEditingFeed( feed )
                                                }
                                            >
                                                Edit
                                            </Button>{ ' ' }
                                            { isMediaFeed( feed.type ) && (
                                                <Button
                                                    variant="secondary"
                                                    size="small"
                                                    isBusy={
                                                        importingFeedId ===
                                                        feed.id
                                                    }
                                                    disabled={
                                                        importingFeedId ===
                                                        feed.id
                                                    }
                                                    onClick={ () =>
                                                        handleImportPhotos(
                                                            feed
                                                        )
                                                    }
                                                >
                                                    Check Photos
                                                </Button>
                                            ) }{ ' ' }
                                            { feed.paused ? (
                                                <Button
                                                    variant="secondary"
                                                    size="small"
                                                    style={ {
                                                        color: '#996600',
                                                        borderColor: '#996600',
                                                    } }
                                                    onClick={ () =>
                                                        handleTogglePause( feed )
                                                    }
                                                >
                                                    Unpause
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    size="small"
                                                    style={ {
                                                        color: '#0073aa',
                                                        borderColor: '#0073aa',
                                                    } }
                                                    onClick={ () =>
                                                        handleTogglePause( feed )
                                                    }
                                                >
                                                    Pause
                                                </Button>
                                            ) }{ ' ' }
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                isDestructive
                                                onClick={ () =>
                                                    setConfirmDelete( feed )
                                                }
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            }

                            const d = row.dbFeed;
                            return (
                                <tr key={ `db-${ d.feed_name }` }>
                                    <td>{ d.feed_name }</td>
                                    <td style={ { color: '#999', fontStyle: 'italic' } }>
                                        DB only
                                    </td>
                                    <td>{ d.point_count }</td>
                                    <td>
                                        <Button
                                            variant="secondary"
                                            size="small"
                                            onClick={ () =>
                                                setStatsFeed( {
                                                    name: d.feed_name,
                                                } )
                                            }
                                        >
                                            Statistics
                                        </Button>{ ' ' }
                                        <Button
                                            variant="secondary"
                                            size="small"
                                            onClick={ () =>
                                                setRenamingDbFeed( {
                                                    feedName: d.feed_name,
                                                    newName: d.feed_name,
                                                } )
                                            }
                                        >
                                            Rename
                                        </Button>{ ' ' }
                                        <Button
                                            variant="secondary"
                                            size="small"
                                            isDestructive
                                            onClick={ () =>
                                                setConfirmDeleteDbFeed( {
                                                    feedName: d.feed_name,
                                                    pointCount: d.point_count,
                                                } )
                                            }
                                        >
                                            Delete points
                                        </Button>
                                    </td>
                                </tr>
                            );
                        } ) }
                    </tbody>
                </table>
            ) }

            <Button variant="primary" onClick={ () => setShowPicker( true ) }>
                Add Feed
            </Button>

            { /* Step 1: pick a provider type */ }
            { showPicker && (
                <Modal
                    title="Add Feed"
                    size="medium"
                    onRequestClose={ () => setShowPicker( false ) }
                >
                    <ProviderSelector
                        providers={ providers }
                        value=""
                        onChange={ ( type ) => {
                            setShowPicker( false );
                            setEditingFeed( { type } );
                        } }
                    />
                </Modal>
            ) }

            { /* Step 2: fill in settings (also used for Edit) */ }
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

            { confirmDelete !== null && (
                <Modal
                    title={ `Delete feed "${ confirmDelete.name }"?` }
                    onRequestClose={ () => setConfirmDelete( null ) }
                >
                    <p>
                        This feed has{ ' ' }
                        <strong>
                            { confirmDelete.point_count ?? 0 } points
                        </strong>{ ' ' }
                        stored in the database. Choose what to delete:
                    </p>
                    <div
                        style={ {
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                        } }
                    >
                        <Button
                            variant="secondary"
                            onClick={ () =>
                                handleDeleteConfirmWith( confirmDelete, false )
                            }
                        >
                            Delete config only
                        </Button>
                        <Button
                            variant="secondary"
                            isDestructive
                            onClick={ () =>
                                handleDeletePointsOnly( confirmDelete )
                            }
                        >
                            Delete all { confirmDelete.point_count ?? 0 } points
                            only
                        </Button>
                        <Button
                            variant="primary"
                            isDestructive
                            onClick={ () =>
                                handleDeleteConfirmWith( confirmDelete, true )
                            }
                        >
                            Delete config + all{ ' ' }
                            { confirmDelete.point_count ?? 0 } points
                        </Button>
                        <Button
                            variant="tertiary"
                            onClick={ () => setConfirmDelete( null ) }
                        >
                            Cancel
                        </Button>
                    </div>
                </Modal>
            ) }

            { confirmDeleteDbFeed !== null && (
                <Modal
                    title={ `Delete points for "${ confirmDeleteDbFeed.feedName }"?` }
                    onRequestClose={ () => setConfirmDeleteDbFeed( null ) }
                >
                    <p>
                        Permanently delete all{ ' ' }
                        <strong>
                            { confirmDeleteDbFeed.pointCount } points
                        </strong>{ ' ' }
                        from the database. This cannot be undone.
                    </p>
                    <div style={ { display: 'flex', gap: '8px' } }>
                        <Button
                            variant="primary"
                            isDestructive
                            onClick={ handleDeleteDbFeedConfirm }
                        >
                            Delete all points
                        </Button>
                        <Button
                            variant="tertiary"
                            onClick={ () => setConfirmDeleteDbFeed( null ) }
                        >
                            Cancel
                        </Button>
                    </div>
                </Modal>
            ) }

            { renamingDbFeed !== null && (
                <Modal
                    title={ `Rename "${ renamingDbFeed.feedName }"` }
                    onRequestClose={ () => setRenamingDbFeed( null ) }
                >
                    <div style={ { display: 'flex', flexDirection: 'column', gap: '16px' } }>
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
                                disabled={ renameSaving || renamingDbFeed.newName.trim() === '' || renamingDbFeed.newName.trim() === renamingDbFeed.feedName }
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
        </div>
    );
}
