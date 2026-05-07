import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit';
import SpotmapIcon from './icon.svg';

registerBlockType( metadata.name, {
    icon: SpotmapIcon,
    edit: Edit,
    save: () => null,
} );
