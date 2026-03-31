import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedsTab from '../tabs/FeedsTab';
import { REDACTED, providers } from './fixtures';

jest.mock( '../api', () => ( {
    REDACTED: '__REDACTED__',
    getFeeds: jest.fn(),
    getDbFeeds: jest.fn(),
    createFeed: jest.fn(),
    updateFeed: jest.fn(),
    deleteFeed: jest.fn(),
    deleteDbFeedPoints: jest.fn(),
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
        point_count: 42,
    },
    {
        id: 'f2',
        type: 'findmespot',
        name: 'Elia',
        feed_id: '07bNOnYeUGdYIqFy0b8Bd3uiFVjqgnzTk',
        password: '',
        point_count: 0,
    },
];

beforeEach( () => {
    api.getFeeds.mockResolvedValue( [ ...sampleFeeds ] );
    api.getDbFeeds.mockResolvedValue( [
        { feed_name: 'Timo', point_count: 42 },
    ] );
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
    api.deleteDbFeedPoints.mockResolvedValue( { deleted: 42 } );
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

    it( 'renders action buttons for each feed row', async () => {
        render( <FeedsTab providers={ providers } /> );
        await screen.findByText( 'Timo' );
        expect(
            screen.getAllByRole( 'button', { name: /Edit/i } ).length
        ).toBeGreaterThan( 0 );
    } );

    it( 'renders point count per feed', async () => {
        render( <FeedsTab providers={ providers } /> );
        await screen.findByText( 'Timo' );
        expect( screen.getByText( '42' ) ).toBeInTheDocument();
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
    it( 'calls onNoticeChange when getFeeds rejects', async () => {
        const onNoticeChange = jest.fn();
        api.getFeeds.mockRejectedValue( new Error( 'Failed to fetch' ) );
        render(
            <FeedsTab
                providers={ providers }
                onNoticeChange={ onNoticeChange }
            />
        );
        await waitFor( () => {
            expect( onNoticeChange ).toHaveBeenCalledWith( {
                status: 'error',
                text: 'Failed to fetch',
            } );
        } );
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
        const onNoticeChange = jest.fn();
        const user = userEvent.setup();
        render(
            <FeedsTab
                providers={ providers }
                onNoticeChange={ onNoticeChange }
            />
        );
        await screen.findByText( 'Timo' );

        await user.click( screen.getByRole( 'button', { name: /Add Feed/i } ) );
        await user.type( screen.getByLabelText( /Feed Name/i ), 'New' );
        await user.click( screen.getByRole( 'button', { name: 'Save' } ) );

        await waitFor( () => {
            expect( onNoticeChange ).toHaveBeenCalledWith( {
                status: 'success',
                text: 'Feed saved.',
            } );
        } );
        expect( screen.getByText( 'New' ) ).toBeInTheDocument();
    } );
} );

describe( 'FeedsTab — delete feed', () => {
    it( 'removes feed from list after deleting config only', async () => {
        const onNoticeChange = jest.fn();
        const user = userEvent.setup();

        render(
            <FeedsTab
                providers={ providers }
                onNoticeChange={ onNoticeChange }
            />
        );
        await screen.findByText( 'Timo' );

        const initialRows = screen.getAllByRole( 'row' );
        const initialTimoRow = initialRows.find( ( r ) =>
            within( r ).queryByText( 'Timo' )
        );
        await user.click(
            within( initialTimoRow ).getByRole( 'button', { name: /Delete/i } )
        );
        await user.click(
            await screen.findByRole( 'button', { name: /Delete config only/i } )
        );

        await waitFor( () => {
            expect( api.deleteFeed ).toHaveBeenCalledWith( 'f1', false );
        } );
        const configuredRows = screen.getAllByRole( 'row' );
        const configuredTimoRow = configuredRows.find(
            ( row ) =>
                within( row ).queryByText( 'Timo' ) &&
                within( row ).queryByRole( 'button', { name: /Edit/i } )
        );
        expect( configuredTimoRow ).toBeUndefined();
        expect( onNoticeChange ).toHaveBeenCalledWith( {
            status: 'success',
            text: 'Feed "Timo" deleted.',
        } );
    } );

    it( 'deletes points but keeps config from delete modal', async () => {
        const onNoticeChange = jest.fn();
        const user = userEvent.setup();

        render(
            <FeedsTab
                providers={ providers }
                onNoticeChange={ onNoticeChange }
            />
        );
        await screen.findByText( 'Timo' );

        const rows = screen.getAllByRole( 'row' );
        const timoRow = rows.find( ( r ) => within( r ).queryByText( 'Timo' ) );
        await user.click(
            within( timoRow ).getByRole( 'button', { name: /Delete/i } )
        );
        await user.click(
            await screen.findByRole( 'button', {
                name: /Delete all 42 points only/i,
            } )
        );

        await waitFor( () => {
            expect( api.deleteDbFeedPoints ).toHaveBeenCalledWith( 'Timo' );
        } );
        expect( api.deleteFeed ).not.toHaveBeenCalled();
        const updatedRows = screen.getAllByRole( 'row' );
        const updatedTimoRow = updatedRows.find(
            ( row ) =>
                within( row ).queryByText( 'Timo' ) &&
                within( row ).queryByRole( 'button', { name: /Edit/i } )
        );
        expect( updatedTimoRow ).toBeDefined();
        expect( within( updatedTimoRow ).getByText( '0' ) ).toBeInTheDocument();
        expect( onNoticeChange ).toHaveBeenCalledWith( {
            status: 'success',
            text: 'All points for "Timo" deleted. Feed configuration kept.',
        } );
    } );
} );
