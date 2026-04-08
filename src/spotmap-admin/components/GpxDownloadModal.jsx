import { useState } from '@wordpress/element';
import {
    Modal,
    Button,
    RadioControl,
    TextControl,
    Notice,
} from '@wordpress/components';

export default function GpxDownloadModal( { feedName, onClose } ) {
    const [ splitMode, setSplitMode ] = useState( 'single' );
    const [ splitHours, setSplitHours ] = useState( '' );
    const [ outputFormat, setOutputFormat ] = useState( 'multi-track' );
    const [ downloading, setDownloading ] = useState( false );
    const [ error, setError ] = useState( null );

    const parsedHours = parseFloat( splitHours );
    const splitHoursValid =
        splitMode === 'single' || ( ! isNaN( parsedHours ) && parsedHours > 0 );
    const showFormatChoice =
        splitMode === 'split' && ! isNaN( parsedHours ) && parsedHours > 0;

    const handleDownload = async () => {
        setDownloading( true );
        setError( null );
        try {
            const params = new URLSearchParams( { feed_name: feedName } );
            if ( splitMode === 'split' && parsedHours > 0 ) {
                params.set( 'split_hours', parsedHours );
                params.set( 'format', outputFormat );
            } else {
                params.set( 'format', 'single' );
            }

            const restUrl = window.spotmapAdminData.restUrl.replace(
                /\/$/,
                ''
            );
            const base = `${ restUrl }/db-feeds/export-gpx`;
            const url = base + ( base.includes( '?' ) ? '&' : '?' ) + params;

            const response = await fetch( url, {
                headers: {
                    'X-WP-Nonce': window.spotmapAdminData.nonce,
                },
            } );

            if ( ! response.ok ) {
                const errData = await response.json().catch( () => ( {} ) );
                throw new Error(
                    errData.message ?? `HTTP ${ response.status }`
                );
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL( blob );
            const a = document.createElement( 'a' );
            a.href = objectUrl;

            const contentDisposition =
                response.headers.get( 'Content-Disposition' ) ?? '';
            const filenameMatch = contentDisposition.match(
                /filename="?([^";]+)"?/
            );
            a.download = filenameMatch
                ? filenameMatch[ 1 ].trim()
                : feedName + '.gpx';

            document.body.appendChild( a );
            a.click();
            document.body.removeChild( a );
            URL.revokeObjectURL( objectUrl );
            onClose();
        } catch ( err ) {
            setError( err.message );
        } finally {
            setDownloading( false );
        }
    };

    return (
        <Modal
            title={ `Download GPX — ${ feedName }` }
            onRequestClose={ onClose }
            size="medium"
        >
            <div
                style={ {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                } }
            >
                { error && (
                    <Notice status="error" onRemove={ () => setError( null ) }>
                        { error }
                    </Notice>
                ) }

                <RadioControl
                    label="Track segmentation"
                    selected={ splitMode }
                    options={ [
                        {
                            label: 'Single track (all points in one track)',
                            value: 'single',
                        },
                        {
                            label: 'Split into multiple tracks by time gap',
                            value: 'split',
                        },
                    ] }
                    onChange={ ( val ) => {
                        setSplitMode( val );
                        setSplitHours( '' );
                    } }
                />

                { splitMode === 'split' && (
                    <TextControl
                        label="Split when gap between two consecutive points exceeds (hours)"
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={ splitHours }
                        onChange={ setSplitHours }
                        __nextHasNoMarginBottom
                        __next40pxDefaultSize
                    />
                ) }

                { showFormatChoice && (
                    <RadioControl
                        label="Output format"
                        selected={ outputFormat }
                        options={ [
                            {
                                label: 'Single GPX file with multiple track segments',
                                value: 'multi-track',
                            },
                            {
                                label: 'ZIP archive with one GPX file per segment',
                                value: 'zip',
                            },
                        ] }
                        onChange={ setOutputFormat }
                    />
                ) }

                <div
                    style={ {
                        display: 'flex',
                        gap: '8px',
                        marginTop: '8px',
                    } }
                >
                    <Button
                        variant="primary"
                        isBusy={ downloading }
                        disabled={ downloading || ! splitHoursValid }
                        onClick={ handleDownload }
                    >
                        Download
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={ downloading }
                        onClick={ onClose }
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
