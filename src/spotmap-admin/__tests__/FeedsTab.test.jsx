import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedsTab from '../tabs/FeedsTab';
import { REDACTED, providers } from './fixtures';

jest.mock( '../api', () => ( {
	REDACTED: '__REDACTED__',
	getFeeds: jest.fn(),
	createFeed: jest.fn(),
	updateFeed: jest.fn(),
	deleteFeed: jest.fn(),
} ) );

// FeedModal imports icons — stub the module.
jest.mock( '../icons', () => ( { ICONS: [ 'star' ] } ) );

import * as api from '../api';

const sampleFeeds = [
	{
		id: 'f1',
		type: 'findmespot',
		name: 'Timo',
		feed_id: '0XXu6',
		password: REDACTED,
	},
	{
		id: 'f2',
		type: 'findmespot',
		name: 'Elia',
		feed_id: '07bNOnYeUGdYIqFy0b8Bd3uiFVjqgnzTk',
		password: '',
	},
];

beforeEach( () => {
	api.getFeeds.mockResolvedValue( [ ...sampleFeeds ] );
	api.createFeed.mockResolvedValue( {
		id: 'f3',
		type: 'findmespot',
		name: 'New',
		feed_id: 'xxx',
		password: '',
	} );
	api.updateFeed.mockResolvedValue( {
		...sampleFeeds[ 0 ],
		name: 'Updated',
	} );
	api.deleteFeed.mockResolvedValue( {} );
} );

afterEach( () => {
	jest.clearAllMocks();
	jest.restoreAllMocks();
} );

describe( 'FeedsTab — loading', () => {
	it( 'shows spinner while feeds are loading', () => {
		// Never resolve so we stay in loading state.
		api.getFeeds.mockReturnValue( new Promise( () => {} ) );
		render( <FeedsTab providers={ providers } /> );
		// Spinner renders as an SVG with class .components-spinner
		expect(
			document.querySelector( '.components-spinner' )
		).toBeInTheDocument();
	} );
} );

describe( 'FeedsTab — loaded', () => {
	it( 'renders feed names in the table', async () => {
		render( <FeedsTab providers={ providers } /> );
		await screen.findByText( 'Timo' );
		expect( screen.getByText( 'Elia' ) ).toBeInTheDocument();
	} );

	it( 'renders provider label instead of type key', async () => {
		render( <FeedsTab providers={ providers } /> );
		await screen.findByText( 'Timo' );
		const cells = screen.getAllByText( 'SPOT Feed' );
		expect( cells.length ).toBe( 2 );
	} );

	it( 'renders feed IDs as code elements', async () => {
		render( <FeedsTab providers={ providers } /> );
		await screen.findByText( '0XXu6' );
		expect( screen.getByText( '0XXu6' ).tagName ).toBe( 'CODE' );
	} );
} );

describe( 'FeedsTab — empty state', () => {
	it( 'shows "No feeds" message when list is empty', async () => {
		api.getFeeds.mockResolvedValue( [] );
		render( <FeedsTab providers={ providers } /> );
		expect(
			await screen.findByText( /No feeds configured/i )
		).toBeInTheDocument();
	} );
} );

describe( 'FeedsTab — error state', () => {
	it( 'shows error notice when getFeeds rejects', async () => {
		api.getFeeds.mockRejectedValue( new Error( 'Failed to fetch' ) );
		render( <FeedsTab providers={ providers } /> );
		const notices = await screen.findAllByText( 'Failed to fetch' );
		expect( notices.length ).toBeGreaterThan( 0 );
	} );
} );

describe( 'FeedsTab — add feed', () => {
	it( 'opens FeedModal when Add Feed is clicked', async () => {
		const user = userEvent.setup();
		render( <FeedsTab providers={ providers } /> );
		await screen.findByText( 'Timo' );

		await user.click( screen.getByRole( 'button', { name: /Add Feed/i } ) );

		// Modal opened — Cancel button only exists inside the modal.
		expect(
			screen.getByRole( 'button', { name: 'Cancel' } )
		).toBeInTheDocument();
	} );

	it( 'adds new feed to the list after save', async () => {
		const user = userEvent.setup();
		render( <FeedsTab providers={ providers } /> );
		await screen.findByText( 'Timo' );

		await user.click( screen.getByRole( 'button', { name: /Add Feed/i } ) );
		await user.type( screen.getByLabelText( /Feed Name/i ), 'New' );
		await user.click( screen.getByRole( 'button', { name: 'Save' } ) );

		const saved = await screen.findAllByText( /Feed saved/i );
		expect( saved.length ).toBeGreaterThan( 0 );
		expect( screen.getByText( 'New' ) ).toBeInTheDocument();
	} );
} );

describe( 'FeedsTab — delete feed', () => {
	it( 'removes feed from list after confirmed delete', async () => {
		const user = userEvent.setup();
		jest.spyOn( window, 'confirm' ).mockReturnValue( true );

		render( <FeedsTab providers={ providers } /> );
		await screen.findByText( 'Timo' );

		const rows = screen.getAllByRole( 'row' );
		const timoRow = rows.find( ( r ) => within( r ).queryByText( 'Timo' ) );
		await user.click(
			within( timoRow ).getByRole( 'button', { name: /Delete/i } )
		);

		await waitFor( () => {
			expect( api.deleteFeed ).toHaveBeenCalledWith( 'f1' );
		} );
		const deleted = await screen.findAllByText( /Feed deleted/i );
		expect( deleted.length ).toBeGreaterThan( 0 );
		expect( screen.queryByText( 'Timo' ) ).not.toBeInTheDocument();
	} );

	it( 'does not delete when confirm is cancelled', async () => {
		const user = userEvent.setup();
		jest.spyOn( window, 'confirm' ).mockReturnValue( false );

		render( <FeedsTab providers={ providers } /> );
		await screen.findByText( 'Timo' );

		const rows = screen.getAllByRole( 'row' );
		const timoRow = rows.find( ( r ) => within( r ).queryByText( 'Timo' ) );
		await user.click(
			within( timoRow ).getByRole( 'button', { name: /Delete/i } )
		);

		expect( api.deleteFeed ).not.toHaveBeenCalled();
		expect( screen.getByText( 'Timo' ) ).toBeInTheDocument();
	} );
} );
