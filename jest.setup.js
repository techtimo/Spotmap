require( '@testing-library/jest-dom' );

// Required by @wordpress/components
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// Provide spotmapAdminData before any module reads it at import time.
window.spotmapAdminData = {
	restUrl: 'http://localhost/wp-json/spotmap/v1/',
	REDACTED: '__REDACTED__',
};
