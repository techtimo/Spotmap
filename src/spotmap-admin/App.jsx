import { useState, useEffect } from '@wordpress/element';
import { Notice, TabPanel, Spinner } from '@wordpress/components';
import * as api from './api';
import FeedsTab from './tabs/FeedsTab';
import MarkersTab from './tabs/MarkersTab';
import TokensTab from './tabs/TokensTab';
import DefaultsTab from './tabs/DefaultsTab';
import EditPointsTab from './tabs/EditPointsTab';

const TABS = [
	{ name: 'feeds', title: 'Feeds' },
	{ name: 'markers', title: 'Markers' },
	{ name: 'tokens', title: 'API Tokens' },
	{ name: 'defaults', title: 'Defaults' },
	{ name: 'edit-points', title: 'Edit Points' },
];

const TAB_NAMES = TABS.map( ( t ) => t.name );

function getTabFromHash() {
	const hash = window.location.hash.slice( 1 );
	if ( hash === 'add-feed' ) {
		return 'feeds';
	}
	return TAB_NAMES.includes( hash ) ? hash : TAB_NAMES[ 0 ];
}

export default function App() {
	const [ providers, setProviders ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ globalNotice, setGlobalNotice ] = useState( null );
	const [ initialTab ] = useState( getTabFromHash );
	const openAddFeed = window.location.hash === '#add-feed';

	useEffect( () => {
		api.getProviders()
			.then( setProviders )
			.catch( ( err ) => setError( err.message ) );
	}, [] );

	const handleTabSelect = ( tabName ) => {
		window.location.hash = tabName;
	};

	if ( error ) {
		return (
			<div className="wrap">
				{ globalNotice && (
					<Notice
						status={ globalNotice.status }
						onRemove={ () => setGlobalNotice( null ) }
						isDismissible
					>
						{ globalNotice.text }
					</Notice>
				) }
				<h1>Spotmap Settings</h1>
				<div className="notice notice-error">
					<p>Failed to load settings: { error }</p>
				</div>
			</div>
		);
	}

	if ( ! providers ) {
		return (
			<div className="wrap">
				{ globalNotice && (
					<Notice
						status={ globalNotice.status }
						onRemove={ () => setGlobalNotice( null ) }
						isDismissible
					>
						{ globalNotice.text }
					</Notice>
				) }
				<h1>Spotmap Settings</h1>
				<Spinner />
			</div>
		);
	}

	return (
		<div className="wrap">
			{ globalNotice && (
				<Notice
					status={ globalNotice.status }
					onRemove={ () => setGlobalNotice( null ) }
					isDismissible
				>
					{ globalNotice.text }
				</Notice>
			) }
			<h1>Spotmap Settings</h1>
			<TabPanel
				tabs={ TABS }
				initialTabName={ initialTab }
				onSelect={ handleTabSelect }
			>
				{ ( tab ) =>
					( {
						feeds: (
							<FeedsTab
								providers={ providers }
								openAddModal={ openAddFeed }
							/>
						),
						markers: <MarkersTab />,
						tokens: <TokensTab />,
						defaults: (
							<DefaultsTab onNoticeChange={ setGlobalNotice } />
						),
						'edit-points': (
							<EditPointsTab onNoticeChange={ setGlobalNotice } />
						),
					} )[ tab.name ]
				}
			</TabPanel>
		</div>
	);
}
