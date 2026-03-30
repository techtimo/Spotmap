import { useState, useEffect } from '@wordpress/element';
import { Button, Modal, Spinner } from '@wordpress/components';
import * as api from '../api';
import FeedModal from '../components/FeedModal';

const isPushFeed = ( type ) => type === 'osmand' || type === 'teltonika';

export default function FeedsTab( {
    providers,
    openAddModal,
    onNoticeChange,
} ) {
    const [ feeds, setFeeds ] = useState( null );
    const [ dbFeeds, setDbFeeds ] = useState( null );
    const [ loading, setLoading ] = useState( true );
    const [ editingFeed, setEditingFeed ] = useState(
        openAddModal ? {} : null
    ); // null=closed, {}=new, feed=edit
    const [ confirmDelete, setConfirmDelete ] = useState( null ); // feed object or null
    const [ confirmDeleteDbFeed, setConfirmDeleteDbFeed ] = useState( null ); // { feedName, pointCount }

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

    const handleDeleteClick = ( feed ) => {
        if ( ( feed.point_count ?? 0 ) === 0 ) {
            handleDeleteConfirmWith( feed, false );
            return;
        }
        setConfirmDelete( feed );
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

    if ( loading ) {
        return <Spinner />;
    }

    const configuredNames = new Set( ( feeds ?? [] ).map( ( f ) => f.name ) );
    const orphanedDbFeeds = ( dbFeeds ?? [] ).filter(
        ( d ) => ! configuredNames.has( d.feed_name )
    );

    return (
        <div style={ { marginTop: '1rem' } }>
            <h3 style={ { marginTop: 0 } }>Configured feeds</h3>

            { feeds.length === 0 ? (
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
                            <th>Feed ID</th>
                            <th style={ { width: '80px' } }>Points</th>
                            <th style={ { width: '220px' } }>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        { feeds.map( ( feed ) => (
                            <tr key={ feed.id }>
                                <td>{ feed.name }</td>
                                <td>
                                    { providers[ feed.type ]?.label ??
                                        feed.type }
                                </td>
                                <td>
                                    { isPushFeed( feed.type ) ? (
                                        <em style={ { color: '#888' } }>
                                            push feed
                                        </em>
                                    ) : (
                                        <code>{ feed.feed_id }</code>
                                    ) }
                                </td>
                                <td>{ feed.point_count ?? 0 }</td>
                                <td>
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={ () => setEditingFeed( feed ) }
                                    >
                                        Edit
                                    </Button>{ ' ' }
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
                                            handleDeleteClick( feed )
                                        }
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        ) ) }
                    </tbody>
                </table>
            ) }

            <Button variant="primary" onClick={ () => setEditingFeed( {} ) }>
                Add Feed
            </Button>

            { orphanedDbFeeds.length > 0 && (
                <div style={ { marginTop: '2rem' } }>
                    <h3>Feeds in database</h3>
                    <p style={ { color: '#666' } }>
                        These feeds have data in the database but are no longer
                        configured. You can delete their points here.
                    </p>
                    <table className="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Feed name</th>
                                <th style={ { width: '80px' } }>Points</th>
                                <th style={ { width: '160px' } }>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            { orphanedDbFeeds.map( ( d ) => (
                                <tr key={ d.feed_name }>
                                    <td>{ d.feed_name }</td>
                                    <td>{ d.point_count }</td>
                                    <td>
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
                            ) ) }
                        </tbody>
                    </table>
                </div>
            ) }

            { editingFeed !== null && (
                <FeedModal
                    providers={ providers }
                    feed={ editingFeed.id ? editingFeed : null }
                    onSave={ handleSave }
                    onClose={ () => setEditingFeed( null ) }
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
        </div>
    );
}
