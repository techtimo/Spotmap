import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconPicker from '../components/IconPicker';

// icons.js requires @fortawesome files at module level — mock it.
jest.mock( '../icons', () => ( {
	ICONS: [ 'star', 'map-marker-alt', 'heart', 'mountain', 'compass' ],
} ) );

const noop = () => {};

describe( 'IconPicker', () => {
	it( 'renders all icons when search is empty', () => {
		render( <IconPicker current="" onSelect={ noop } onClose={ noop } /> );
		expect( screen.getByText( 'star' ) ).toBeInTheDocument();
		expect( screen.getByText( 'heart' ) ).toBeInTheDocument();
		expect( screen.getByText( 'compass' ) ).toBeInTheDocument();
	} );

	it( 'filters icons by search term', async () => {
		const user = userEvent.setup();
		render( <IconPicker current="" onSelect={ noop } onClose={ noop } /> );

		await user.type( screen.getByLabelText( /Search icons/i ), 'mar' );

		expect( screen.getByText( 'map-marker-alt' ) ).toBeInTheDocument();
		expect( screen.queryByText( 'star' ) ).not.toBeInTheDocument();
		expect( screen.queryByText( 'heart' ) ).not.toBeInTheDocument();
	} );

	it( 'shows no-match message when search finds nothing', async () => {
		const user = userEvent.setup();
		render( <IconPicker current="" onSelect={ noop } onClose={ noop } /> );

		await user.type(
			screen.getByLabelText( /Search icons/i ),
			'xyznotfound'
		);

		expect( screen.getByText( /No icons match/i ) ).toBeInTheDocument();
	} );

	it( 'calls onSelect with icon name when clicked', async () => {
		const user = userEvent.setup();
		const onSelect = jest.fn();
		render(
			<IconPicker current="" onSelect={ onSelect } onClose={ noop } />
		);

		await user.click( screen.getByText( 'star' ) );

		expect( onSelect ).toHaveBeenCalledWith( 'star' );
	} );

	it( 'highlights the currently selected icon', () => {
		render(
			<IconPicker current="heart" onSelect={ noop } onClose={ noop } />
		);
		// The selected button has a blue border — check it exists via aria or style
		const heartButton = screen.getByText( 'heart' ).closest( 'button' );
		expect( heartButton ).toHaveStyle( 'border: 2px solid #0073aa' );
	} );
} );
