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

export default function App() {
	const [ providers, setProviders ] = useState( null );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		api.getProviders()
			.then( setProviders )
			.catch( ( err ) => setError( err.message ) );
	}, [] );

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
			<TabPanel tabs={ TABS }>
				{ ( tab ) =>
					( {
						feeds: <FeedsTab providers={ providers } />,
						markers: <MarkersTab />,
						tokens: <TokensTab />,
						defaults: <DefaultsTab />,
					} )[ tab.name ]
				}
			</TabPanel>
		</div>
	);
}
