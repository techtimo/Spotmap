import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TokensTab from '../tabs/TokensTab';
import { REDACTED } from './fixtures';

jest.mock( '../api', () => ( {
	REDACTED: '__REDACTED__',
	getTokens: jest.fn(),
	updateTokens: jest.fn(),
} ) );

import * as api from '../api';

const tokens = {
	timezonedb: REDACTED,
	mapbox: '',
};

beforeEach( () => {
	api.getTokens.mockResolvedValue( { ...tokens } );
	api.updateTokens.mockResolvedValue( { ...tokens } );
} );

afterEach( () => {
	jest.clearAllMocks();
} );

describe( 'TokensTab — REDACTED token (stored)', () => {
	it( 'shows "Token stored" for a REDACTED value', async () => {
		render( <TokensTab /> );
		expect(
			await screen.findByText( /Token stored/i )
		).toBeInTheDocument();
	} );

	it( 'shows Change and Clear buttons for a stored token', async () => {
		render( <TokensTab /> );
		expect(
			await screen.findByRole( 'button', { name: /Change/i } )
		).toBeInTheDocument();
		expect(
			await screen.findByRole( 'button', { name: /Clear/i } )
		).toBeInTheDocument();
	} );

	it( 'switches to text input after clicking Change', async () => {
		const user = userEvent.setup();
		render( <TokensTab /> );
		await screen.findByRole( 'button', { name: /Change/i } );

		await user.click( screen.getByRole( 'button', { name: /Change/i } ) );

		// After clicking Change, the TextControl for timezonedb should appear.
		// TimezoneDB label is shown in TOKEN_META.
		const input = await screen.findByLabelText( /TimezoneDB/i );
		expect( input ).toBeInTheDocument();
		expect( input.value ).toBe( '' );
	} );
} );

describe( 'TokensTab — empty token (not stored)', () => {
	it( 'shows text input directly for an empty value', async () => {
		render( <TokensTab /> );
		// mapbox is empty — should show TextControl immediately
		const input = await screen.findByLabelText( /Mapbox/i );
		expect( input ).toBeInTheDocument();
	} );
} );

describe( 'TokensTab — save', () => {
	it( 'calls updateTokens and shows success notice', async () => {
		const user = userEvent.setup();
		api.updateTokens.mockResolvedValue( {
			timezonedb: REDACTED,
			mapbox: '',
		} );
		render( <TokensTab /> );
		await screen.findByText( /Token stored/i );

		await user.click(
			screen.getByRole( 'button', { name: /Save API Tokens/i } )
		);

		await waitFor( () => {
			expect( api.updateTokens ).toHaveBeenCalled();
		} );
		const notices = await screen.findAllByText( /API tokens saved/i );
		expect( notices.length ).toBeGreaterThan( 0 );
	} );

	it( 'shows error notice when save fails', async () => {
		const user = userEvent.setup();
		api.updateTokens.mockRejectedValue( new Error( 'Network error' ) );
		render( <TokensTab /> );
		await screen.findByText( /Token stored/i );

		await user.click(
			screen.getByRole( 'button', { name: /Save API Tokens/i } )
		);

		const notices = await screen.findAllByText( 'Network error' );
		expect( notices.length ).toBeGreaterThan( 0 );
	} );
} );
