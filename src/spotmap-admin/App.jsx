import { useState, useEffect } from '@wordpress/element';
import { TabPanel, Spinner } from '@wordpress/components';
import * as api from './api';
import FeedsTab from './tabs/FeedsTab';
import MarkersTab from './tabs/MarkersTab';
import TokensTab from './tabs/TokensTab';
import DefaultsTab from './tabs/DefaultsTab';

const TABS = [
	{ name: 'feeds', title: 'Feeds' },
	{ name: 'markers', title: 'Markers' },
	{ name: 'tokens', title: 'API Tokens' },
	{ name: 'defaults', title: 'Defaults' },
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
				<h1>Spotmap Settings</h1>
				<Spinner />
			</div>
		);
	}

	return (
		<div className="wrap">
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
						defaults: <DefaultsTab />,
					} )[ tab.name ]
				}
			</TabPanel>
		</div>
	);
}
