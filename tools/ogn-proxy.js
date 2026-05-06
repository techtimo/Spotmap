#!/usr/bin/env node
/**
 * Local OGN APRS → Spotmap proxy for development/testing.
 *
 * Connects to aprs.glidernet.org:14580, subscribes to one FLARM device,
 * parses incoming APRS position packets, and POSTs each point to the local
 * WordPress ingest endpoint.
 *
 * Usage:
 *   node tools/ogn-proxy.js --key <feed-key> [--flarm-id <id>] [--wp-url <url>]
 *
 * Defaults:
 *   --flarm-id  4B51BF
 *   --wp-url    http://localhost:8888
 *
 * The feed key is the pre-shared key auto-generated when you create an OGN
 * feed in the Spotmap admin. Find it in Settings → Spotmap → Feeds.
 */

'use strict';

const net  = require('net');
const http = require('http');
const url  = require('url');

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name, fallback) {
    const idx = args.indexOf('--' + name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const FLARM_ID = arg('flarm-id', '4B51BF').toUpperCase();
const WP_URL   = arg('wp-url', 'http://localhost:8888');
const FEED_KEY = arg('key', '');

if (!FEED_KEY) {
    console.error('Error: --key <feed-key> is required.');
    console.error('Create an OGN feed in the Spotmap admin to get a key.');
    process.exit(1);
}

const INGEST_PATH = `/wp-json/spotmap/v1/ingest/ogn?key=${encodeURIComponent(FEED_KEY)}`;
const OGN_HOST    = 'aprs.glidernet.org';
const OGN_PORT    = 14580;
const CALLSIGN    = `FLR${FLARM_ID}`;

console.log(`OGN proxy starting`);
console.log(`  FLARM ID  : ${FLARM_ID}  (APRS callsign: ${CALLSIGN})`);
console.log(`  Ingest URL: ${WP_URL}${INGEST_PATH}`);
console.log('');

// ── APRS parser ──────────────────────────────────────────────────────────────

/**
 * Parses an uncompressed APRS position packet with timestamp.
 *
 * Expected body format (after the ':'):
 *   /HHMMSSh{DD}{MM.mm}{N|S}/{DDD}{MM.mm}{E|W}{sym}{CCC}/{SSS}/A={AAAAAA}
 *
 * Example:
 *   /195430h4750.25N/01245.36E'180/050/A=004921 id224B51BF +100fpm ...
 *
 * Returns null if the packet does not match.
 */
function parseAprs(line) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;

    const callsign = line.substring(0, line.indexOf('>'));
    const body     = line.substring(colonIdx + 1);

    // Uncompressed position with HHMMSS timestamp (h = UTC)
    const m = body.match(
        /^[@\/](\d{2})(\d{2})(\d{2})[hz](\d{2})(\d{2}\.\d{2})([NS])[\/\\](\d{3})(\d{2}\.\d{2})([EW]).(\d{3})\/(\d{3})(?:\/A=(\d+))?/
    );
    if (!m) return null;

    const [, hh, mm, ss, latDeg, latMin, latDir, lonDeg, lonMin, lonDir, course, speed, altFt] = m;

    let lat = parseInt(latDeg, 10) + parseFloat(latMin) / 60;
    if (latDir === 'S') lat = -lat;

    let lon = parseInt(lonDeg, 10) + parseFloat(lonMin) / 60;
    if (lonDir === 'W') lon = -lon;

    // Reconstruct UTC timestamp from packet HHMMSS + today's date.
    const now = new Date();
    const ts  = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10)
    ));
    // If the reconstructed time is in the future, the packet is from yesterday.
    if (ts > now) ts.setUTCDate(ts.getUTCDate() - 1);

    return {
        callsign,
        lat:       parseFloat(lat.toFixed(6)),
        lon:       parseFloat(lon.toFixed(6)),
        timestamp: Math.floor(ts.getTime() / 1000),
        course:    parseInt(course, 10),
        speedKmh:  Math.round(parseInt(speed, 10) * 1.852),   // knots → km/h
        altM:      altFt != null ? Math.round(parseInt(altFt, 10) * 0.3048) : null,
    };
}

// ── HTTP POST to WordPress ────────────────────────────────────────────────────

function postToWordPress(point) {
    const payload = JSON.stringify({
        lat:       point.lat,
        lon:       point.lon,
        timestamp: point.timestamp,
        altitude:  point.altM,
        speed:     point.speedKmh,
        course:    point.course,
        flarm_id:  FLARM_ID,
    });

    const parsed  = url.parse(WP_URL);
    const options = {
        hostname: parsed.hostname,
        port:     parsed.port || 80,
        path:     INGEST_PATH,
        method:   'POST',
        headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log(`[${new Date().toISOString()}] stored  lat=${point.lat} lon=${point.lon} alt=${point.altM}m spd=${point.speedKmh}km/h`);
            } else {
                console.error(`[${new Date().toISOString()}] WP error HTTP ${res.statusCode}: ${body.trim()}`);
            }
        });
    });

    req.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] HTTP error: ${err.message}`);
    });

    req.write(payload);
    req.end();
}

// ── OGN APRS TCP connection ───────────────────────────────────────────────────

let buffer = '';

function connect() {
    console.log(`Connecting to ${OGN_HOST}:${OGN_PORT} …`);
    const sock = net.createConnection(OGN_PORT, OGN_HOST);

    sock.setEncoding('utf8');
    sock.setTimeout(90000); // OGN sends keepalive comments every ~20 s

    sock.on('connect', () => {
        console.log('Connected. Logging in …');
        // Receive-only login (passcode -1 works for filter-level access)
        sock.write(`user NOCALL pass -1 vers SpotmapProxy 0.1\r\n`);
    });

    sock.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;

            // Server comment / keepalive
            if (line.startsWith('#')) {
                console.log(`[OGN] ${line}`);

                // After the login response, send the FLARM-ID filter
                if (line.includes('logresp')) {
                    console.log(`Setting filter for callsign ${CALLSIGN} …`);
                    sock.write(`#filter p/${CALLSIGN}\r\n`);
                    console.log('Waiting for packets … (the glider must be flying and in OGN receiver range)');
                }
                continue;
            }

            // Only process packets from our target device
            if (!line.startsWith(CALLSIGN + '>')) continue;

            const point = parseAprs(line);
            if (!point) {
                console.warn(`[skip] could not parse: ${line}`);
                continue;
            }

            console.log(`[aprs] ${line}`);
            postToWordPress(point);
        }
    });

    sock.on('timeout', () => {
        console.warn('Socket timeout — no data in 90 s. Reconnecting …');
        sock.destroy();
    });

    sock.on('close', () => {
        console.warn('Connection closed. Reconnecting in 10 s …');
        buffer = '';
        setTimeout(connect, 10000);
    });

    sock.on('error', (err) => {
        console.error(`Socket error: ${err.message}`);
    });
}

connect();
