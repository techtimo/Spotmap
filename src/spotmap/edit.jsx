import "leaflet/dist/leaflet.css";

import { __ } from '@wordpress/i18n';

/**
 * React hook that is used to mark the block wrapper element.
 * It provides all the necessary props like the class name.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
 */
import { useBlockProps } from '@wordpress/block-editor';

/**
 * Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
 * Those files can contain any CSS code that gets applied to the editor.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './editor.scss';

import Map from './map'
/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 *
 * @return {Element} Element to render.
 */
// https://wordpress.github.io/gutenberg/
import { ResizableBox } from '@wordpress/components'

export default function Edit({ attributes, isSelected, setAttributes, toggleSelection }) {
	// console.log(attributes);
	return (
		<div  {...useBlockProps()}>
			{/* {__('Spotmap – hello from the editor!', 'spotmap2')} */}
			<div style={{ height: 300 }}>
				<Map {...attributes} setAttributes={setAttributes} />
			</div>
		</div >
	);
}
