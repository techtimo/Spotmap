# 🗺 Spotmap

[![WordPress Plugin: Version](https://img.shields.io/wordpress/plugin/v/spotmap?color=green&logo=wordpress) ![WordPress Plugin: Tested WP Version](https://img.shields.io/wordpress/plugin/tested/spotmap?color=green&logo=wordpress)](https://wordpress.org/plugins/spotmap/)

Spotmap is a WordPress plugin that turns your site into a self-hosted GPS tracking platform. It displays live and historical positions from SPOT, OsmAnd, Victron, and Teltonika devices on interactive Leaflet maps via a Gutenberg block or shortcode. It also lets you assign coordinates to any post or page — tagged posts appear on the map as clickable markers that link directly to the article, making it easy to build location-based content archives such as travel diaries and trip reports. GPX track overlays and photo EXIF locations are supported as well.

The following screenshot was taken after using the plugin for 3 months:

![screen1](https://user-images.githubusercontent.com/22075114/83943321-64eb6600-a7fb-11ea-94a6-a8a0a5823407.png)

It is possible to change the underlayed map (will be configurable in future releases).
You can interupt the line connecting all points with a time intervall. (Here it was set to 12hrs, so that the line stops if no new points were sent in 12 hours)

![screen2](https://user-images.githubusercontent.com/22075114/83943319-61f07580-a7fb-11ea-8384-0d03b361c657.png)

There is more you can do. Check the Usage section.

## User Guide

For details on features, installation, usage, and frequently asked questions, see [readme.txt](./readme.txt).

## Development

### Prerequisites

Make sure you have the following installed before starting:

- **Node.js** (v18 or later recommended) — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)
- **Docker** — required by `wp-env` to run a local WordPress instance ([docker.com](https://www.docker.com/get-started))

### First-time setup

```bash
# 1. Clone the repository
git clone https://github.com/techtimo/spotmap.git
cd spotmap

# 2. Install Node.js dependencies
npm install

# 3. Start the local WordPress environment (runs on http://localhost:8888)
npm run env:start

# 4. Start the JavaScript build watcher (hot-reload on file changes)
npm start
```

WordPress admin is available at **http://localhost:8888/wp-admin** with the default credentials `admin` / `password`.

The plugin is automatically mounted and activated in the local environment via `.wp-env.json`.

### Useful commands

| Command | Description |
| --- | --- |
| `npm run env:start` | Start the local WordPress environment (with XDebug) |
| `npm start` | Start the JS/CSS build watcher for development |
| `npm run build` | Create a production build |
| `npm run lint:js` | Lint JavaScript files |
| `npm run lint:css` | Lint CSS/SCSS files |
| `npm run format` | Auto-format files with Prettier |
| `npm run api-hook` | Manually trigger the Spot API crawler cron job |
| `npm run plugin-zip` | Package the plugin into a distributable `.zip` |

### Testing

#### JS unit tests (Jest)

```bash
npm run test:js
```

Runs standalone — no `wp-env` needed. Test files live in `src/**/__tests__/`.

#### PHP unit tests (PHPUnit)

```bash
npm run test:php
```

Requires `npm run env:start`. Runs against the tests environment (port 8889).

#### E2E — tile layer loading (Playwright)

Verifies that every map tile layer provided by `spotmapjsobj.maps` (the PHP-filtered
catalog) can be instantiated by the map engine without throwing an error.

**One-time setup:**

```bash
npx playwright install chromium

# Create your private token file — this file is gitignored
cp .env.example .env
```

Fill in `.env` with your API tokens (see `.env.example` for all keys).
Maps whose token is missing are automatically excluded by PHP and skipped by the test.

**Running:**

```bash
# wp-env must already be running
npm run build          # map engine must be built
npm run test:e2e       # runs Playwright against localhost:8889
```

The `global-setup` step activates the plugin on the tests environment, injects the
tokens into WP options, and updates post 1 with a block that lists every map key from
`config/maps.yaml`. The test then iterates over `spotmapjsobj.maps`, instantiates a
`Spotmap` for each key, and asserts that the correct Leaflet tile-layer constructor
(`L.tileLayer` or `L.tileLayer.wms`) is called without error.

### Stopping the environment

```bash
npx wp-env stop
```
