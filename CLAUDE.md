# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Spotmap is a WordPress plugin that displays GPS tracking data from SPOT devices on interactive Leaflet maps. It provides a Gutenberg block and shortcodes for embedding maps in posts/pages.

## wp-env / Docker

**Never run `npm run env:start` or assume the containers are stopped.** The wp-env Docker containers are kept running during development — if a `wp-env run cli` command fails, diagnose the command, not the container state. The DB is MariaDB; use `docker exec` to run queries directly:

```bash
docker exec <hash>-mysql-1 mariadb -u root -ppassword wordpress -e "SELECT ..."
```

Find the container name with `docker ps`.

## Editing conventions

- This project uses **4 spaces** for indentation throughout — never tabs.
- When using the Edit tool, use 4-space indentation in `old_string`/`new_string`.
- Run `npm run format` (JS/TS/CSS) and `npm run format:php` (PHP) to auto-format code.


## Build Commands

```bash
# Development
npm run start

# Production build
npm run build

# WordPress environment (Docker)
npm run env:start
npm run env:stop

# After env:destroy + env:start, create the test DB once:
npm run wp-env -- run cli bash -- -c "mysql -h mysql -u root -ppassword -e 'CREATE DATABASE IF NOT EXISTS wordpress_test'"

# Tests (run inside the wp-env Docker container)
npm run test:js                      # Jest unit tests (TypeScript/JS)
npm run test:php                     # PHP unit tests (~31 s)
npm run composer -- run test:coverage  # PHP coverage report

# Lint
npm run lint:js
npm run lint:css
npm run lint:php

# Format
npm run format        # JS/TS/CSS (Prettier via wp-scripts)
npm run format:php    # PHP (php-cs-fixer via wp-env; requires env:start + composer install)

# Package plugin zip
npm run plugin-zip
```

`npm run build` runs `copy-deps:prod` (strips source maps) then `wp-scripts build`.
`npm run start` runs `copy-deps` (preserves source maps) then `wp-scripts start`.

PHP tests live in `tests/` and run against a real WordPress environment (requires `npm run env:start`). JS tests in `src/**/__tests__/` run standalone via Jest.

## Architecture Overview

### PHP Backend (`includes/`, `admin/`, `public/`)

| File | Role |
|------|------|
| `spotmap.php` | Entry point — instantiates `Spotmap` class |
| `includes/class-spotmap.php` | Orchestrator — loads dependencies, registers hooks via `Spotmap_Loader` |
| `includes/class-spotmap-options.php` | Admin options and marker defaults |
| `includes/class-spotmap-database.php` | DB layer — table `wp_spotmap_points` |
| `includes/class-spotmap-api-crawler.php` | Fetches data from SPOT API |
| `admin/class-spotmap-admin.php` | Admin settings page |
| `public/class-spotmap-public.php` | Enqueues scripts, registers shortcodes |
| `public/render-block.php` | Server-side renderer for the Gutenberg dynamic block |

Composer dependency `symfony/yaml` is vendor-prefixed under the `Spotmap\` namespace via Strauss.

### Frontend Build (`src/`)

Two webpack entry points (configured in `webpack.config.js`):

1. **`src/spotmap/`** — Gutenberg block (React/JSX)
   - `block.json` — block definition, 17 attributes, API v3, dynamic block (save returns null)
   - `edit.jsx` — ~33KB React editor component with live preview
   - Block is registered via `build/spotmap/` by `register_block_type()`

2. **`src/map-engine/`** — TypeScript map engine compiled to `build/spotmap-map/index.js`
   - `index.ts` — exposes `window.Spotmap`
   - `Spotmap.ts` — main class, `initMap()` entry point
   - `DataFetcher.ts`, `LayerManager.ts`, `MarkerManager.ts`, `LineManager.ts`, `BoundsManager.ts`, `ButtonManager.ts`, `TableRenderer.ts`
   - `types.ts` — all TypeScript interfaces (`SpotmapOptions`, `SpotPoint`, `FeedStyle`, `GpxTrackConfig`, etc.)

### Runtime Flow

`render-block.php` outputs a `<div>` with an inline `<script>` that calls `new Spotmap(options).initMap()`. Options are JSON-encoded block attributes. The map engine fetches GPS points via AJAX (`wp_ajax_spotmap`).

The editor (`edit.jsx`) calls `window.Spotmap` directly for the live preview, using `spotmapjsobj` (localized via `wp_localize_script`) which contains `ajaxUrl`, `maps`, `overlays`, `feeds`, `defaultValues`, and marker config.

### Frontend Dependencies (`public/`)

`scripts/copy-deps.js` copies npm packages (Leaflet, Leaflet plugins, Font Awesome) from `node_modules/` into `public/`. The `public/` directory is generated — do not edit files there directly.

Key deps: `leaflet`, `leaflet-fullscreen`, `leaflet-gpx`, `leaflet-easybutton`, `leaflet-textpath`, `leaflet.tilelayer.swiss`, `beautifymarker`, `@fortawesome/fontawesome-free`.

### Database Schema

Table `wp_spotmap_points`:
`id, type, time, latitude, longitude, altitude, battery_status, message, custom_message, feed_name, feed_id, model, device_name, local_timezone`

### Tile Layer Config

`config/maps.yaml` defines 25+ tile layer providers. Loaded server-side, passed to the block editor and frontend via `spotmapjsobj`.

## Known TODOs
- **`latestUnixtimeByFeed` redundant state** (`Spotmap.ts`): The `Map<string, number>` tracking the latest unixtime per feed duplicates `feed.points.at(-1)?.unixtime`, since `MarkerManager.addPoint()` already pushes to `feed.points`. Refactor the auto-reload polling loop to read `feed.points` directly and remove the Map.
- **Duplicated polling pattern**: `Spotmap.ts` and `TableRenderer.ts` share ~70 lines of identical timeout/visibility-change polling logic. Consider extracting a `VisibilityAwarePoller` utility class into `utils.ts`.
- **Feed style defaults should move to the map engine**: `render-block.php` and the shortcode both pre-populate per-feed `styles` (color, splitLines) from WP admin defaults in PHP. Ideally `LayerManager.getFeedColor()` and `getFeedSplitLines()` would fall back to `spotmapjsobj.defaultValues` (already available at runtime) and cycle colors by feed index from `options.feeds`, allowing both renderers to pass a sparse/empty `styles`. The PHP pre-population in `render-block.php` was added to match shortcode behaviour for now.
- move maps.yaml into wp_options table? and potentially make it so that the user can modify/add via GUI?
- the ajax call to retrieve points should be prefixed with spotmap_
- ~~feat: use blog metadata to store lat/lng / inject in every post a small map where the user can select the location of this post.~~ **Done** — `_spotmap_latitude`/`_spotmap_longitude` post meta, "Post Location" Gutenberg sidebar panel (`src/post-location/`), virtual `posts` provider type in the feed admin, `get_post_feed_points()` in `class-spotmap-public.php`.
- **[perf T1] Insertion-time deduplication for stationary trackers**: In `insert_row()`, before inserting check if the new point is within ~25 m of the last stored point for the same feed AND < 10 min apart → skip insert (or update the existing point's `time`). Mirrors the existing client-side `removeClosePoints()` logic in `DataFetcher.ts`. Handles Teltonika/OsmAnd parked-vehicle flooding.
- **[perf T1] Server-side point decimation**: When the queried range returns too many rows, reduce to a target (e.g. 5,000 pts) before sending JSON. Simple approaches (MOD timestamp, N-th row, time-bucket) all have flaws for GPS tracks with irregular density — they can drop geometrically significant points on sparse stretches. **Douglas-Peucker** (simplify by perpendicular deviation, ε configurable) is the right algorithm: it preserves shape-defining points regardless of time distribution. Needs PHP implementation since MySQL has no native DP. Consider running DP per feed per query, or as a pre-simplification pass stored back to DB.
- **[perf T2] Block-level `maxPoints` attribute**: Add a `maxPoints` block attribute (default e.g. 5000). The server decimates to that count using time-based sampling before responding. Let editors tune the trade-off between detail and load time per map.
- **[perf T2] Admin: DB pruning action**: Add an admin button that previews how many points would be removed per feed by a Douglas-Peucker simplification pass (ε configurable), then executes the prune on confirmation. Run against points older than N days to preserve recent full-resolution data.
- add phpunit test with sample data to rename a feed - what happens if the feedname already exists? (this might wanted but on the UI we should get a warning that must be accepted)

## Key Conventions

- **Dynamic block**: `save()` returns `null`; all rendering is in `render-block.php`.
- **Marker shape/icon config** belongs in WP admin (Options), not the block editor UI.
- **`public/` is generated** — edit source files in `src/` and `node_modules/` and rebuild.
- **No `"type": "commonjs"`** in `package.json` — this is intentional.
- **Vendor prefix**: Composer packages live under `Spotmap\` namespace via Strauss; regenerate with `composer install` then `composer exec strauss`.
