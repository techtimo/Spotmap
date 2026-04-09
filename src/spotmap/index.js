import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit';

const SpotmapIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
    >
        <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#F59E0B" />
                <stop offset="100%" stop-color="#EF4444" />
            </linearGradient>
        </defs>

        { /* <!-- Background --> */ }
        <rect width="24" height="24" rx="5" fill="#FFFFFF" />

        { /* <!-- Crosshair (fully opaque) --> */ }
        <line
            x1="12"
            y1="1.8"
            x2="12"
            y2="0.8"
            stroke="#60A5FA"
            stroke-width="1.4"
            stroke-linecap="round"
        />
        <line
            x1="12"
            y1="22.2"
            x2="12"
            y2="23.2"
            stroke="#60A5FA"
            stroke-width="1.4"
            stroke-linecap="round"
        />
        <line
            x1="1.8"
            y1="12"
            x2="0.8"
            y2="12"
            stroke="#60A5FA"
            stroke-width="1.4"
            stroke-linecap="round"
        />
        <line
            x1="22.2"
            y1="12"
            x2="23.2"
            y2="12"
            stroke="#60A5FA"
            stroke-width="1.4"
            stroke-linecap="round"
        />

        { /* <!-- Globe --> */ }
        <circle
            cx="12"
            cy="12"
            r="10.2"
            fill="none"
            stroke="#3B82F6"
            stroke-width="1.4"
        />
        { /* <!-- Latitude ellipses --> */ }
        <ellipse
            cx="12"
            cy="12"
            rx="10.2"
            ry="3.9"
            fill="none"
            stroke="#3B82F6"
            stroke-width="1"
        />
        <ellipse
            cx="12"
            cy="12"
            rx="10.2"
            ry="7.7"
            fill="none"
            stroke="#3B82F6"
            stroke-width="1"
        />
        { /* <!-- Meridian ellipse --> */ }
        <ellipse
            cx="12"
            cy="12"
            rx="4.8"
            ry="10.2"
            fill="none"
            stroke="#3B82F6"
            stroke-width="1"
        />

        { /* <!-- Route (clean S curve) --> */ }
        <path
            d="M5 17 
           C 9 8, 14 18, 19 6"
            fill="none"
            stroke="url(#g)"
            stroke-width="2.2"
            stroke-linecap="round"
        />

        { /* <!-- Start --> */ }
        <circle cx="5" cy="17" r="1.4" fill="#F59E0B" />

        { /* <!-- End --> */ }
        <circle cx="19" cy="6" r="1.8" fill="#EF4444" />
    </svg>
);

registerBlockType( metadata.name, {
    icon: SpotmapIcon,
    edit: Edit,
    save: () => null,
} );
