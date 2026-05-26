import type { SpotPoint } from './types';

/**
 * Single Mustache template for all popup types.
 * Renders only the fields that are present in the view — no type branching here.
 * The view object (built by buildView) is responsible for shaping data correctly.
 */
export const POPUP_TEMPLATE = `\
{{#imageUrl}}<img src="{{{imageUrl}}}" class="spotmap-popup-image" loading="lazy" alt="" /><br>
{{/imageUrl}}\
{{#linkedTitle}}<b><a href="{{{url}}}" target="_blank" rel="noopener noreferrer">{{linkedTitle}}</a></b><br>
{{/linkedTitle}}\
{{#plainTitle}}<b>{{plainTitle}}</b><br>
{{/plainTitle}}\
{{#pointType}}<b>{{pointType}}{{#feedName}} — {{feedName}}{{/feedName}}</b><br>
{{/pointType}}\
{{#time}}Time: {{time}}<br>Date: {{date}}<br>
{{/time}}\
{{^time}}{{#date}}<span class="spotmap-popup-date">{{date}}</span>{{/date}}
{{/time}}\
{{#showLocalTime}}Local Time: {{localtime}}<br>Local Date: {{localdate}}<br>
{{/showLocalTime}}\
{{#excerpt}}<span class="spotmap-popup-excerpt">{{excerpt}}</span><br>
{{/excerpt}}\
{{#message}}{{message}}<br>
{{/message}}\
{{#altitude}}Altitude: {{altitude}}m<br>
{{/altitude}}\
{{#showBattery}}Battery status is low!<br>
{{/showBattery}}\
{{#hiddenPoints}}There are {{count}} hidden points{{#radius}} within a radius of {{.}} meters{{/radius}}<br>
{{/hiddenPoints}}`;

export interface PopupView {
    // Image at the top (POST featured image)
    imageUrl?: string;
    // Title with link (POST with permalink)
    linkedTitle?: string;
    url?: string;
    // Title without link (POST without permalink)
    plainTitle?: string;
    // Header label for SPOT points (the message type, e.g. "OK", "HELP")
    pointType?: string;
    // Feed name shown inline when the map has more than one feed
    feedName?: string;
    // Date/time — SPOT points show both, POST shows only date in small text
    time?: string;
    date: string;
    showLocalTime?: boolean;
    localtime?: string;
    localdate?: string;
    // Post excerpt
    excerpt?: string;
    // Optional text message
    message?: string;
    // Altitude in meters (omitted when zero)
    altitude?: number;
    showBattery?: boolean;
    // Mustache renders count + optional radius section
    hiddenPoints?: { count: number; radius: number[] } | null;
}

export function buildView( entry: SpotPoint, feedCount = 1 ): PopupView {
    if ( entry.type === 'POST' ) {
        return {
            imageUrl: entry.image_url,
            linkedTitle: entry.url ? entry.message ?? 'Post' : undefined,
            url: entry.url,
            plainTitle: entry.url ? undefined : entry.message ?? 'Post',
            excerpt: entry.excerpt,
            date: entry.date,
        };
    }

    const showLocalTime =
        !! entry.local_timezone &&
        ! ( entry.localdate === entry.date && entry.localtime === entry.time );

    return {
        pointType: entry.type,
        feedName: feedCount > 1 ? entry.feed_name : undefined,
        time: entry.time,
        date: entry.date,
        showLocalTime,
        localtime: entry.localtime,
        localdate: entry.localdate,
        imageUrl: entry.type === 'MEDIA' ? entry.message : undefined,
        message: entry.type === 'MEDIA' ? undefined : entry.message,
        altitude: entry.altitude > 0 ? entry.altitude : undefined,
        showBattery: entry.battery_status === 'LOW',
        hiddenPoints: entry.hiddenPoints
            ? {
                  count: entry.hiddenPoints.count,
                  // Pass as one-element array so {{#radius}}{{.}}{{/radius}}
                  // renders the value, or empty array to skip the section.
                  radius:
                      entry.hiddenPoints.radius > 0
                          ? [ entry.hiddenPoints.radius ]
                          : [],
              }
            : null,
    };
}
