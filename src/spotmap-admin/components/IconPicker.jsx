import { useState, useMemo } from '@wordpress/element';
import { Modal, TextControl } from '@wordpress/components';
import { ICONS } from '../icons';

export default function IconPicker( { current, onSelect, onClose } ) {
	const [ search, setSearch ] = useState( '' );

	const query = search.trim().toLowerCase();
	const filtered = useMemo(
		() =>
			query ? ICONS.filter( ( icon ) => icon.includes( query ) ) : ICONS,
		[ query ]
	);

	return (
		<Modal title="Pick an Icon" size="large" onRequestClose={ onClose }>
			<TextControl
				label="Search icons"
				value={ search }
				onChange={ setSearch }
				placeholder="e.g. star, map, user…"
				// eslint-disable-next-line jsx-a11y/no-autofocus
				autoFocus
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>

			{ filtered.length === 0 && (
				<p style={ { marginTop: '1rem', color: '#757575' } }>
					No icons match &ldquo;{ search }&rdquo;
				</p>
			) }

			<div
				style={ {
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
					gap: '6px',
					maxHeight: '420px',
					overflowY: 'auto',
					marginTop: '1rem',
					paddingRight: '4px',
				} }
			>
				{ filtered.map( ( icon ) => {
					const isSelected = icon === current;
					return (
						<button
							key={ icon }
							type="button"
							onClick={ () => onSelect( icon ) }
							style={ {
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: '4px',
								padding: '8px 4px',
								border: isSelected
									? '2px solid #0073aa'
									: '1px solid #ddd',
								borderRadius: '4px',
								background: isSelected ? '#f0f7fc' : '#fff',
								cursor: 'pointer',
								fontSize: '11px',
								overflow: 'hidden',
								lineHeight: 1.2,
							} }
						>
							<i
								className={ `fas fa-${ icon }` }
								style={ { fontSize: '1.3em' } }
							/>
							<span
								style={ {
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
									maxWidth: '100%',
								} }
							>
								{ icon }
							</span>
						</button>
					);
				} ) }
			</div>
		</Modal>
	);
}
