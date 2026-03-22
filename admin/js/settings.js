const $ = jQuery;
$( document ).ready( function () {
	$( '#spotmap-add-feed-button' ).on( 'click', function () {
		const api = $( '#spotmap-add-feed-select' ).find( ':selected' ).val();
		if ( api === 'findmespot' ) {
			const table = $( '#findmespot-feeds' ).next().children();
			if ( table.length ) {
				const index = table.children().length / 3;
				const clone = table.children().slice( 0, 3 ).clone( true, true );
				clone.children().find( 'input' ).attr( 'value', '' );
				const inputs = clone.children().next();

				inputs.each( function () {
					const name = $( this ).children().attr( 'name' );
					const newName = name.replace( '[0]', '[' + index + ']' );
					$( this ).children().attr( 'name', newName );
				} );
				table.append( clone );
			} else {
				$( 'h2' )
					.before()
					.append(
						$( `<h2>Spot Feed</h2><p id="findmespot-feeds">Here goes a detailed description.</p><table class="form-table" role="presentation"><tbody><tr><th scope="row">Feed Name</th><td>		<input type="text" name="spotmap_findmespot_name[0]" value="">
                </td></tr><tr><th scope="row">Feed Id</th><td>		<input type="text" name="spotmap_findmespot_id[0]" value="">
                </td></tr><tr><th scope="row">Feed password</th><td>		<input type="password" name="spotmap_findmespot_password[0]" value="">
                <p class="description">Leave this empty if the feed is public</p>
                </td></tr></tbody></table>` )
					);
			}
		}
	} );
	// to update the font awesome preview in the dashboard Marker section
	$( '.spotmap-icon-input' ).on( 'change', function () {
		const value = $( this ).val();
		const icon = $( this ).next();
		icon.removeClass()
			.addClass( 'fas' )
			.addClass( 'fa-' + value );
	} );
} );
