import { useState, useRef } from '@wordpress/element';
import {
    Button,
    ColorPalette,
    Modal,
    ToggleControl,
} from '@wordpress/components';
import { brush, trash, upload } from '@wordpress/icons';
import { uploadMedia } from '@wordpress/media-utils';
import { __ } from '@wordpress/i18n';
import { COLORS } from '../constants';

const GPX_PAGE_SIZE = 10;

/**
 * GPX track manager — upload files, pick from the media library, style tracks.
 *
 * @param {Object}   props
 * @param {Array}    props.gpx      Current GPX track array: { id, url, name, color, visible, download }.
 * @param {Function} props.onChange Called with the updated array on any change.
 * @param {Function} props.onClose  Called to close the modal.
 */
export default function GpxManagerModal( { gpx, onChange, onClose } ) {
    const [ page, setPage ] = useState( 0 );
    const [ isDragging, setIsDragging ] = useState( false );
    const [ styleTarget, setStyleTarget ] = useState( null );
    const dragCounter = useRef( 0 );
    const uploadInputRef = useRef( null );

    const mergeTracks = ( newTracks ) => {
        const existingIds = new Set(
            gpx.filter( ( t ) => t.id ).map( ( t ) => t.id )
        );
        const deduped = newTracks.filter(
            ( t ) => ! t.id || ! existingIds.has( t.id )
        );
        setPage( 0 );
        onChange( [ ...gpx, ...deduped ] );
    };

    const updateProp = ( key, value ) => {
        const updated =
            styleTarget === 'all'
                ? gpx.map( ( t ) => ( { ...t, [ key ]: value } ) )
                : gpx.map( ( t, i ) =>
                      i === styleTarget ? { ...t, [ key ]: value } : t
                  );
        onChange( updated );
    };

    const openMediaLibrary = () => {
        const frame = window.wp.media( {
            title: __( 'Select GPX tracks' ),
            library: { type: 'text/xml' },
            multiple: true,
            button: { text: __( 'Select' ) },
        } );
        frame.on( 'select', () => {
            const selection = frame.state().get( 'selection' ).toJSON();
            mergeTracks(
                selection.map( ( t ) => ( {
                    id: t.id,
                    url: t.url,
                    name: t.title || t.filename || String( t.id ),
                    color: gpx[ 0 ]?.color || '#FFD700',
                    visible: true,
                    download: false,
                } ) )
            );
        } );
        frame.open();
    };

    const uploadFiles = ( files ) => {
        if ( ! files?.length ) {
            return;
        }
        uploadMedia( {
            filesList: files,
            allowedTypes: [ 'text/xml' ],
            onFileChange: ( uploaded ) => {
                const valid = uploaded.filter( ( f ) => ! f.errorCode );
                if ( ! valid.length ) {
                    return;
                }
                mergeTracks(
                    valid.map( ( t ) => ( {
                        id: t.id,
                        url: t.url,
                        name: t.title || t.filename || t.slug || String( t.id ),
                        color: gpx[ 0 ]?.color || '#FFD700',
                        visible: true,
                        download: false,
                    } ) )
                );
            },
            onError: () => {},
        } );
    };

    const handleFileChange = ( e ) => {
        uploadFiles( e.target.files );
        e.target.value = '';
    };

    const handleDragEnter = ( e ) => {
        e.preventDefault();
        dragCounter.current++;
        setIsDragging( true );
    };

    const handleDragLeave = ( e ) => {
        e.preventDefault();
        dragCounter.current--;
        if ( dragCounter.current === 0 ) {
            setIsDragging( false );
        }
    };

    const handleDrop = ( e ) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging( false );
        uploadFiles( e.dataTransfer.files );
    };

    const totalPages = Math.ceil( gpx.length / GPX_PAGE_SIZE );
    const safePage = Math.min( page, Math.max( 0, totalPages - 1 ) );
    const pageStart = safePage * GPX_PAGE_SIZE;
    const pageTracks = gpx.slice( pageStart, pageStart + GPX_PAGE_SIZE );
    const styleTrack = styleTarget === 'all' ? gpx[ 0 ] : gpx[ styleTarget ];

    return (
        <Modal
            title={
                styleTarget !== null ? __( 'GPX — Style' ) : __( 'GPX Tracks' )
            }
            onRequestClose={
                styleTarget !== null ? () => setStyleTarget( null ) : onClose
            }
            size="medium"
        >
            { styleTarget !== null ? (
                <div
                    style={ {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        padding: '8px 0',
                    } }
                >
                    <Button
                        variant="tertiary"
                        icon="arrow-left-alt2"
                        onClick={ () => setStyleTarget( null ) }
                        style={ { alignSelf: 'flex-start' } }
                    >
                        { __( 'Back to tracks' ) }
                    </Button>
                    <p style={ { margin: 0 } }>
                        { styleTarget === 'all'
                            ? gpx.map( ( t ) => t.name ).join( ', ' )
                            : styleTrack?.name }
                    </p>
                    <div>
                        <p
                            style={ {
                                margin: '0 0 8px',
                                fontWeight: 600,
                                fontSize: '13px',
                            } }
                        >
                            { __( 'Color' ) }
                        </p>
                        <ColorPalette
                            colors={ COLORS }
                            value={ styleTrack?.color || '#FFD700' }
                            onChange={ ( v ) => v && updateProp( 'color', v ) }
                            disableCustomColors={ false }
                            clearable={ false }
                        />
                    </div>
                    <ToggleControl
                        __nextHasNoMarginBottom
                        label={ __( 'Show on map' ) }
                        checked={ styleTrack?.visible !== false }
                        onChange={ ( v ) => updateProp( 'visible', v ) }
                        help={ __(
                            'Uncheck to hide this track without removing it'
                        ) }
                    />
                    <ToggleControl
                        __nextHasNoMarginBottom
                        label={ __( 'Show download button' ) }
                        checked={ !! styleTrack?.download }
                        onChange={ ( v ) => updateProp( 'download', v ) }
                        help={ __(
                            'Show a download icon in the layer control and popup'
                        ) }
                    />
                </div>
            ) : (
                <div
                    onDragEnter={ handleDragEnter }
                    onDragLeave={ handleDragLeave }
                    onDragOver={ ( e ) => e.preventDefault() }
                    onDrop={ handleDrop }
                    style={ {
                        position: 'relative',
                        outline: isDragging
                            ? '2px dashed #007cba'
                            : '2px dashed transparent',
                        borderRadius: '4px',
                        padding: '4px',
                        transition: 'outline-color 0.1s',
                    } }
                >
                    { isDragging && (
                        <div
                            style={ {
                                position: 'absolute',
                                inset: 0,
                                zIndex: 10,
                                background: 'rgba(0, 124, 186, 0.08)',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                            } }
                        >
                            <span
                                style={ {
                                    fontWeight: 600,
                                    color: '#007cba',
                                    fontSize: '14px',
                                } }
                            >
                                { __( 'Drop GPX files here' ) }
                            </span>
                        </div>
                    ) }

                    <div
                        style={ {
                            display: 'flex',
                            gap: '8px',
                            marginBottom: '16px',
                            alignItems: 'center',
                        } }
                    >
                        <Button
                            variant="primary"
                            icon={ upload }
                            onClick={ () => uploadInputRef.current?.click() }
                        >
                            { __( 'Upload' ) }
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={ openMediaLibrary }
                        >
                            { __( 'Media Library' ) }
                        </Button>
                        <input
                            ref={ uploadInputRef }
                            type="file"
                            accept=".gpx,.xml"
                            multiple
                            style={ { display: 'none' } }
                            onChange={ handleFileChange }
                        />
                        { gpx.length > 0 && (
                            <>
                                <Button
                                    icon={ brush }
                                    label={ __( 'Style all tracks' ) }
                                    onClick={ () => setStyleTarget( 'all' ) }
                                />
                                <Button
                                    icon={ trash }
                                    label={ __( 'Remove all tracks' ) }
                                    isDestructive
                                    onClick={ () => {
                                        onChange( [] );
                                        onClose();
                                    } }
                                />
                            </>
                        ) }
                    </div>

                    { gpx.length > 0 && (
                        <>
                            <table
                                style={ {
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                } }
                            >
                                <tbody>
                                    { pageTracks.map( ( track, localIdx ) => {
                                        const globalIdx = pageStart + localIdx;
                                        return (
                                            <tr
                                                key={
                                                    track.id ??
                                                    track.url ??
                                                    globalIdx
                                                }
                                                style={ {
                                                    borderBottom:
                                                        '1px solid #ddd',
                                                } }
                                            >
                                                <td
                                                    style={ {
                                                        padding:
                                                            '6px 8px 6px 0',
                                                    } }
                                                >
                                                    <div
                                                        style={ {
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            gap: '4px',
                                                        } }
                                                    >
                                                        <Button
                                                            icon={ brush }
                                                            label={ __(
                                                                'Style this track'
                                                            ) }
                                                            onClick={ () =>
                                                                setStyleTarget(
                                                                    globalIdx
                                                                )
                                                            }
                                                        />
                                                        <span
                                                            style={ {
                                                                display:
                                                                    'block',
                                                                width: '16px',
                                                                height: '16px',
                                                                borderRadius:
                                                                    '50%',
                                                                background:
                                                                    track.color ||
                                                                    '#FFD700',
                                                                flexShrink: 0,
                                                            } }
                                                        />
                                                    </div>
                                                </td>
                                                <td
                                                    style={ {
                                                        padding: '6px 4px',
                                                        width: '100%',
                                                    } }
                                                >
                                                    { track.name }
                                                </td>
                                                <td
                                                    style={ {
                                                        padding:
                                                            '6px 0 6px 8px',
                                                        width: '32px',
                                                        textAlign: 'right',
                                                    } }
                                                >
                                                    <Button
                                                        icon={ trash }
                                                        label={ __(
                                                            'Remove track'
                                                        ) }
                                                        isDestructive
                                                        onClick={ () =>
                                                            onChange(
                                                                gpx.filter(
                                                                    (
                                                                        _,
                                                                        idx
                                                                    ) =>
                                                                        idx !==
                                                                        globalIdx
                                                                )
                                                            )
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    } ) }
                                </tbody>
                            </table>
                            { totalPages > 1 && (
                                <div
                                    style={ {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginTop: '12px',
                                    } }
                                >
                                    <Button
                                        variant="secondary"
                                        disabled={ safePage === 0 }
                                        onClick={ () =>
                                            setPage( safePage - 1 )
                                        }
                                    >
                                        { __( '← Prev' ) }
                                    </Button>
                                    <span
                                        style={ {
                                            fontSize: '12px',
                                            color: '#757575',
                                        } }
                                    >
                                        { pageStart + 1 }–
                                        { Math.min(
                                            pageStart + GPX_PAGE_SIZE,
                                            gpx.length
                                        ) }{ ' ' }
                                        { __( 'of' ) } { gpx.length }
                                    </span>
                                    <Button
                                        variant="secondary"
                                        disabled={ safePage >= totalPages - 1 }
                                        onClick={ () =>
                                            setPage( safePage + 1 )
                                        }
                                    >
                                        { __( 'Next →' ) }
                                    </Button>
                                </div>
                            ) }
                        </>
                    ) }

                    { gpx.length === 0 && (
                        <p style={ { color: '#757575', margin: 0 } }>
                            { __(
                                'No GPX tracks selected. Use Library or Upload to add tracks.'
                            ) }
                        </p>
                    ) }
                </div>
            ) }
        </Modal>
    );
}
