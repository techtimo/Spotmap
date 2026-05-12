import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit';
import { BLOCK_ICON } from './icons';

registerBlockType( metadata.name, {
    icon: BLOCK_ICON,
    edit: Edit,
    save: () => null,
} );
