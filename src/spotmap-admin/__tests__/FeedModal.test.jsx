import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedModal from '../components/FeedModal';
import { REDACTED, providers } from './fixtures';

jest.mock( '../api', () => ( { REDACTED: '__REDACTED__' } ) );

const noop = () => {};
const pushProviders = {
    ...providers,
    osmand: {
        label: 'OsmAnd',
        fields: [
            {
                key: 'name',
                type: 'text',
                label: 'Feed Name',
                required: true,
                description: '',
            },
        ],
    },
    teltonika: {
        label: 'Teltonika',
        fields: [
            {
                key: 'name',
                type: 'text',
                label: 'Feed Name',
                required: true,
                description: '',
            },
        ],
    },
};

describe( 'FeedModal — add mode', () => {
    it( 'shows "Add Feed" title', () => {
        render(
            <FeedModal
                providers={ providers }
                feed={ null }
                onSave={ noop }
                onClose={ noop }
            />
        );
        expect( screen.getByText( 'Add Feed' ) ).toBeInTheDocument();
    } );

    it( 'shows provider type selector', () => {
        render(
            <FeedModal
                providers={ providers }
                feed={ null }
                onSave={ noop }
                onClose={ noop }
            />
        );
        expect( screen.getByText( 'Provider Type' ) ).toBeInTheDocument();
    } );

    it( 'renders all provider fields', () => {
        render(
            <FeedModal
                providers={ providers }
                feed={ null }
                onSave={ noop }
                onClose={ noop }
            />
        );
        expect( screen.getByText( 'Feed Name' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Feed ID' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Feed Password' ) ).toBeInTheDocument();
    } );

    it( 'calls onSave with typed values', async () => {
        const user = userEvent.setup();
        const onSave = jest.fn().mockResolvedValue( undefined );
        render(
            <FeedModal
                providers={ providers }
                feed={ null }
                onSave={ onSave }
                onClose={ noop }
            />
        );

        await user.type( screen.getByLabelText( /Feed Name/i ), 'MyFeed' );
        await user.click( screen.getByRole( 'button', { name: 'Save' } ) );

        await waitFor( () => {
            expect( onSave ).toHaveBeenCalledWith(
                expect.objectContaining( {
                    name: 'MyFeed',
                    type: 'findmespot',
                } ),
                undefined
            );
        } );
    } );
} );

describe( 'FeedModal — edit mode', () => {
    const feed = {
        id: 'feed-1',
        type: 'findmespot',
        name: 'Timo',
        feed_id: '0XXu6',
        password: REDACTED,
    };

    it( 'shows "Edit Feed" title', () => {
        render(
            <FeedModal
                providers={ providers }
                feed={ feed }
                onSave={ noop }
                onClose={ noop }
            />
        );
        expect( screen.getByText( 'Edit Feed' ) ).toBeInTheDocument();
    } );

    it( 'hides provider type selector', () => {
        render(
            <FeedModal
                providers={ providers }
                feed={ feed }
                onSave={ noop }
                onClose={ noop }
            />
        );
        expect( screen.queryByText( 'Provider Type' ) ).not.toBeInTheDocument();
    } );

    it( 'shows empty password field with placeholder when value is REDACTED', () => {
        render(
            <FeedModal
                providers={ providers }
                feed={ feed }
                onSave={ noop }
                onClose={ noop }
            />
        );
        const passwordInput = screen.getByLabelText( /Feed Password/i );
        expect( passwordInput.value ).toBe( '' );
        expect( passwordInput.placeholder ).toMatch( /keep existing/i );
    } );

    it( 'passes feed id to onSave', async () => {
        const user = userEvent.setup();
        const onSave = jest.fn().mockResolvedValue( undefined );
        render(
            <FeedModal
                providers={ providers }
                feed={ feed }
                onSave={ onSave }
                onClose={ noop }
            />
        );

        await user.click( screen.getByRole( 'button', { name: 'Save' } ) );

        await waitFor( () => {
            expect( onSave ).toHaveBeenCalledWith(
                expect.objectContaining( { name: 'Timo' } ),
                'feed-1'
            );
        } );
    } );

    it( 'calls onClose when Cancel is clicked', async () => {
        const user = userEvent.setup();
        const onClose = jest.fn();
        render(
            <FeedModal
                providers={ providers }
                feed={ feed }
                onSave={ noop }
                onClose={ onClose }
            />
        );
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
        expect( onClose ).toHaveBeenCalled();
    } );

    it( 'shows error notice when onSave rejects', async () => {
        const user = userEvent.setup();
        const onSave = jest
            .fn()
            .mockRejectedValue( new Error( 'Server error' ) );
        render(
            <FeedModal
                providers={ providers }
                feed={ feed }
                onSave={ onSave }
                onClose={ noop }
            />
        );
        await user.click( screen.getByRole( 'button', { name: 'Save' } ) );
        // WP components also announce to a11y-speak, so multiple matches are expected.
        const notices = await screen.findAllByText( 'Server error' );
        expect( notices.length ).toBeGreaterThan( 0 );
    } );
} );

describe( 'FeedModal — push feed URLs', () => {
    const originalRestUrl = window.spotmapAdminData.restUrl;

    afterEach( () => {
        window.spotmapAdminData.restUrl = originalRestUrl;
    } );

    it( 'builds a Teltonika URL with &key for rest_route-based sites', async () => {
        window.spotmapAdminData.restUrl =
            'http://localhost:8888/index.php?rest_route=/spotmap/v1/';
        const user = userEvent.setup();

        render(
            <FeedModal
                providers={ pushProviders }
                feed={ null }
                onSave={ noop }
                onClose={ noop }
            />
        );

        await user.click( screen.getByRole( 'button', { name: /Teltonika/i } ) );

        expect(
            screen.getByText( /index\.php\?rest_route=\/spotmap\/v1\/ingest\/teltonika&key=/i )
        ).toBeInTheDocument();
    } );

    it( 'normalizes a malformed server-provided Teltonika tracking URL', () => {
        render(
            <FeedModal
                providers={ pushProviders }
                feed={ {
                    id: 'feed-tel',
                    type: 'teltonika',
                    name: 'Tracker',
                    key: 'abc123',
                    tracking_url:
                        'http://localhost:8888/index.php?rest_route=/spotmap/v1/ingest/teltonika?key=abc123',
                } }
                onSave={ noop }
                onClose={ noop }
            />
        );

        expect(
            screen.getByText(
                'http://localhost:8888/index.php?rest_route=/spotmap/v1/ingest/teltonika&key=abc123'
            )
        ).toBeInTheDocument();
    } );

    it( 'normalizes a malformed server-provided OsmAnd tracking URL', () => {
        render(
            <FeedModal
                providers={ pushProviders }
                feed={ {
                    id: 'feed-osm',
                    type: 'osmand',
                    name: 'Phone',
                    key: 'abc123',
                    tracking_url:
                        'http://localhost:8888/index.php?rest_route=/spotmap/v1/ingest/osmand?key=abc123&lat={0}&lon={1}&timestamp={2}',
                } }
                onSave={ noop }
                onClose={ noop }
            />
        );

        expect(
            screen.getByText(
                'http://localhost:8888/index.php?rest_route=/spotmap/v1/ingest/osmand&key=abc123&lat={0}&lon={1}&timestamp={2}'
            )
        ).toBeInTheDocument();
    } );
} );
