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

    it( 'sends REDACTED when Change is clicked but input left empty', async () => {
        const user = userEvent.setup();
        api.updateTokens.mockResolvedValue( {
            timezonedb: REDACTED,
            mapbox: '',
        } );
        render( <TokensTab /> );
        await user.click(
            await screen.findByRole( 'button', { name: /Change/i } )
        );

        await user.click(
            screen.getByRole( 'button', { name: /Save API Tokens/i } )
        );

        await waitFor( () => {
            expect( api.updateTokens ).toHaveBeenCalledWith(
                expect.objectContaining( { timezonedb: REDACTED } )
            );
        } );
    } );

    it( 'sends REDACTED when Change is clicked, value typed then deleted', async () => {
        const user = userEvent.setup();
        api.updateTokens.mockResolvedValue( {
            timezonedb: REDACTED,
            mapbox: '',
        } );
        render( <TokensTab /> );
        await user.click(
            await screen.findByRole( 'button', { name: /Change/i } )
        );

        const input = await screen.findByLabelText( /TimezoneDB/i );
        await user.type( input, 'abc' );
        await user.keyboard( '{Backspace}{Backspace}{Backspace}' );

        await user.click(
            screen.getByRole( 'button', { name: /Save API Tokens/i } )
        );

        await waitFor( () => {
            expect( api.updateTokens ).toHaveBeenCalledWith(
                expect.objectContaining( { timezonedb: REDACTED } )
            );
        } );
    } );

    it( 'sends empty string when Clear is clicked and saved without typing', async () => {
        const user = userEvent.setup();
        api.updateTokens.mockResolvedValue( { timezonedb: '', mapbox: '' } );
        render( <TokensTab /> );
        await user.click(
            await screen.findByRole( 'button', { name: /Clear/i } )
        );

        await user.click(
            screen.getByRole( 'button', { name: /Save API Tokens/i } )
        );

        await waitFor( () => {
            expect( api.updateTokens ).toHaveBeenCalledWith(
                expect.objectContaining( { timezonedb: '' } )
            );
        } );
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
    it( 'calls updateTokens and fires success notice via onNoticeChange', async () => {
        const user = userEvent.setup();
        const onNoticeChange = jest.fn();
        api.updateTokens.mockResolvedValue( {
            timezonedb: REDACTED,
            mapbox: '',
        } );
        render( <TokensTab onNoticeChange={ onNoticeChange } /> );
        await screen.findByText( /Token stored/i );

        await user.click(
            screen.getByRole( 'button', { name: /Save API Tokens/i } )
        );

        await waitFor( () => {
            expect( onNoticeChange ).toHaveBeenCalledWith(
                expect.objectContaining( { status: 'success' } )
            );
        } );
    } );

    it( 'fires error notice via onNoticeChange when save fails', async () => {
        const user = userEvent.setup();
        const onNoticeChange = jest.fn();
        api.updateTokens.mockRejectedValue( new Error( 'Network error' ) );
        render( <TokensTab onNoticeChange={ onNoticeChange } /> );
        await screen.findByText( /Token stored/i );

        await user.click(
            screen.getByRole( 'button', { name: /Save API Tokens/i } )
        );

        await waitFor( () => {
            expect( onNoticeChange ).toHaveBeenCalledWith(
                expect.objectContaining( {
                    status: 'error',
                    text: 'Network error',
                } )
            );
        } );
    } );
} );
