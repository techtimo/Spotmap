import { useState, useEffect } from '@wordpress/element';
import { Modal, Spinner } from '@wordpress/components';
import * as api from '../api';

/**
 * Returns a human-readable timestamp: relative ("5 minutes ago") within
 * `relativeThresholdDays`, absolute date+time otherwise.
 *
 * @param {number} unixTs                Unix timestamp in seconds.
 * @param {number} relativeThresholdDays Days within which to use relative format.
 */
function formatTimestamp( unixTs, relativeThresholdDays = 1 ) {
    if ( ! unixTs ) {
        return '—';
    }
    const date = new Date( unixTs * 1000 );
    const nowMs = Date.now();
    const diffMs = nowMs - date.getTime();
    const threshMs = relativeThresholdDays * 24 * 60 * 60 * 1000;

    if ( diffMs >= 0 && diffMs < threshMs ) {
        const diffSec = Math.floor( diffMs / 1000 );
        if ( diffSec < 60 ) {
            return `${ diffSec } second${ diffSec === 1 ? '' : 's' } ago`;
        }
        const diffMin = Math.floor( diffSec / 60 );
        if ( diffMin < 60 ) {
            return `${ diffMin } minute${ diffMin === 1 ? '' : 's' } ago`;
        }
        const diffH = Math.floor( diffMin / 60 );
        if ( diffH < 24 ) {
            return `${ diffH } hour${ diffH === 1 ? '' : 's' } ago`;
        }
    }

    return date.toLocaleString( 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    } );
}

/**
 * Returns a date string; relative within `relativeThresholdDays`, absolute otherwise.
 *
 * @param {string} isoDate               ISO date string (YYYY-MM-DD).
 * @param {number} relativeThresholdDays Days within which to use relative format.
 */
function formatDate( isoDate, relativeThresholdDays = 7 ) {
    if ( ! isoDate ) {
        return '—';
    }
    const date = new Date( isoDate + 'T00:00:00Z' );
    const today = new Date();
    today.setUTCHours( 0, 0, 0, 0 );
    const diffDays = Math.round(
        ( today.getTime() - date.getTime() ) / 86400000
    );

    if ( diffDays >= 0 && diffDays < relativeThresholdDays ) {
        if ( diffDays === 0 ) {
            return 'today';
        }
        if ( diffDays === 1 ) {
            return 'yesterday';
        }
        return `${ diffDays } days ago`;
    }

    return date.toLocaleDateString( 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
    } );
}

function Row( { label, value } ) {
    return (
        <tr>
            <td
                style={ {
                    paddingRight: '1.5rem',
                    color: '#555',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'top',
                } }
            >
                { label }
            </td>
            <td style={ { fontWeight: 500 } }>{ value ?? '—' }</td>
        </tr>
    );
}

export default function FeedStatsModal( { feed, onClose } ) {
    const [ stats, setStats ] = useState( null );
    const [ error, setError ] = useState( null );

    useEffect( () => {
        const fetch = feed.id
            ? api.getFeedStats( feed.id )
            : api.getDbFeedStats( feed.name );
        fetch.then( setStats ).catch( ( err ) => setError( err.message ) );
    }, [ feed.id, feed.name ] );

    return (
        <Modal
            title={ `Statistics: ${ feed.name }` }
            onRequestClose={ onClose }
            size="medium"
        >
            { error && <p style={ { color: '#cc1818' } }>Error: { error }</p> }
            { ! error && ! stats && <Spinner /> }
            { stats && (
                <table style={ { borderCollapse: 'collapse', width: '100%' } }>
                    <tbody>
                        <Row
                            label="Total points"
                            value={ stats.point_count.toLocaleString( 'en' ) }
                        />
                        <Row
                            label="First point"
                            value={ formatTimestamp( stats.first_point, 7 ) }
                        />
                        <Row
                            label="Last point"
                            value={ formatTimestamp( stats.last_point, 1 ) }
                        />
                        { stats.busiest_day_count > 1 && (
                            <Row
                                label="Busiest day"
                                value={ `${ formatDate(
                                    stats.busiest_day_date
                                ) } (${ stats.busiest_day_count } points)` }
                            />
                        ) }
                        <Row
                            label="Longest distance day"
                            value={
                                stats.max_distance_day_date
                                    ? `${ formatDate(
                                          stats.max_distance_day_date
                                      ) } (${ stats.max_distance_day_km } km)`
                                    : null
                            }
                        />
                        { stats.avg_altitude !== null && (
                            <Row
                                label="Avg. altitude"
                                value={ `${ stats.avg_altitude.toLocaleString(
                                    'en'
                                ) } m` }
                            />
                        ) }
                        { stats.created_at && (
                            <Row
                                label="Feed configured"
                                value={ formatTimestamp( stats.created_at, 0 ) }
                            />
                        ) }
                        { stats.updated_at && (
                            <Row
                                label="Last edited"
                                value={ formatTimestamp( stats.updated_at, 1 ) }
                            />
                        ) }
                    </tbody>
                </table>
            ) }
        </Modal>
    );
}
