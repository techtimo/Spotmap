import { useState, useEffect } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import * as api from '../api';
import FeedModal from '../components/FeedModal';

export default function FeedsTab( { providers } ) {
	const [ feeds, setFeeds ] = useState( null );
	const [ editingFeed, setEditingFeed ] = useState( null ); // null=closed, {}=new, feed=edit
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		api.getFeeds()
			.then( setFeeds )
			.catch( ( err ) => setNotice( { status: 'error', text: err.message } ) );
	}, [] );

	const handleSave = async ( data, id ) => {
		const saved = id
			? await api.updateFeed( id, data )
			: await api.createFeed( data );

		setFeeds( ( prev ) =>
			id ? prev.map( ( f ) => ( f.id === id ? saved : f ) ) : [ ...prev, saved ]
		);
		setEditingFeed( null );
		setNotice( { status: 'success', text: 'Feed saved.' } );
	};

	const handleDelete = async ( feed ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( `Delete feed "${ feed.name }"?` ) ) return;
		try {
			await api.deleteFeed( feed.id );
			setFeeds( ( prev ) => prev.filter( ( f ) => f.id !== feed.id ) );
			setNotice( { status: 'success', text: 'Feed deleted.' } );
		} catch ( err ) {
			setNotice( { status: 'error', text: err.message } );
		}
	};

	if ( ! feeds ) return <Spinner />;

	return (
		<div style={ { marginTop: '1rem' } }>
			{ notice && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( null ) }
					isDismissible
				>
					{ notice.text }
				</Notice>
			) }

			{ feeds.length === 0 ? (
				<p>No feeds configured yet.</p>
			) : (
				<table className="wp-list-table widefat fixed striped" style={ { marginBottom: '1rem' } }>
					<thead>
						<tr>
							<th>Name</th>
							<th>Type</th>
							<th>Feed ID</th>
							<th style={ { width: '140px' } }>Actions</th>
						</tr>
					</thead>
					<tbody>
						{ feeds.map( ( feed ) => (
							<tr key={ feed.id }>
								<td>{ feed.name }</td>
								<td>{ providers[ feed.type ]?.label ?? feed.type }</td>
								<td>
									<code>{ feed.feed_id }</code>
								</td>
								<td>
									<Button
										variant="secondary"
										size="small"
										onClick={ () => setEditingFeed( feed ) }
									>
										Edit
									</Button>{ ' ' }
									<Button
										variant="secondary"
										size="small"
										isDestructive
										onClick={ () => handleDelete( feed ) }
									>
										Delete
									</Button>
								</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }

			<Button
				variant="primary"
				onClick={ () => setEditingFeed( {} ) }
			>
				Add Feed
			</Button>

			{ editingFeed !== null && (
				<FeedModal
					providers={ providers }
					feed={ editingFeed.id ? editingFeed : null }
					onSave={ handleSave }
					onClose={ () => setEditingFeed( null ) }
				/>
			) }
		</div>
	);
}
