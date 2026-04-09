# Spotmap

Contributors: techtimo  
Donate link: paypal.me/ebaytimo  
Tags: gps, tracking, map, leaflet, gpx, live tracking, osmand, teltonika, spot, gps tracker
License: GPL2  
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 6.5
Tested up to: 6.9  
Stable tag: 1.0.0  

Live GPS tracking for WordPress — display positions from SPOT, OsmAnd, and Teltonika devices on interactive maps. Self-hosted, privacy-friendly. 🗺

## Description

Spotmap turns your WordPress site into a self-hosted GPS tracking platform. Connect your devices, and Spotmap stores every position in your own database — no third-party cloud required.

### Supported devices

* **SPOT** (FindMeSPOT) — automatic feed polling via XML API
* **OsmAnd** — receives positions via HTTP from the OsmAnd smartphone app
* **Teltonika** — direct integration for Teltonika GPS routers and trackers
* **WordPress Media Library** — photos with GPS EXIF data appear as points on the map under the feed name `media`
* **Zoleo** — planned

### Map & visualization

* Interactive Leaflet map with full **Gutenberg block** support — type `/spotmap` in the editor
* Wide range of tile providers: OpenStreetMap, Mapbox, Thunderforest, LINZ (NZ), IGN France, UK Ordnance Survey, USGS, OpenSeaMap, ESRI Ocean, and any custom XYZ tile URL
* GPX track overlay via the built-in **GPX manager** — upload and manage GPX files for planned routes, waypoints, and recorded tracks
* Photo EXIF GPS display — images from your media library with location data appear on the map
* Configurable line breaks when no positions arrive within a set time interval
* Multiple feeds and devices on a single map, each with its own color
* Configurable marker styles and icons

### Filtering & interaction

* Rich **time filtering** including relative ranges like "last 24 hours" or "last 7 days", and absolute date ranges
* Interactive **data table** linked to the map — click a check-in to zoom to that position
* Initial map state options: show all points, zoom to last position, or zoom to last trip
* Auto-refresh without full page reload

### Data management

* **Long-term position storage** — your data stays in your WordPress database for as long as you want
* Convert tracked positions to **GPX export**
* Manage, move, and delete points from the WordPress dashboard
* Upload and organize GPX files through the GPX manager

### Performance

* Rewritten map engine in TypeScript for better reliability
* Significantly faster rendering with large numbers of points compared to 0.11.x

### Why Spotmap?

Most GPS tracking solutions lock your data into a vendor cloud. SPOT's own platform doesn't even offer free long-term storage. Spotmap keeps everything on your server — whether you're documenting a sailing trip, sharing a bike tour with friends and family, or tracking vehicles. Your data, your rules.

## Installation

1. Install from the WordPress plugin directory or upload the `spotmap` folder to `/wp-content/plugins/`
2. Activate the plugin through the **Plugins** menu
3. Go to **Settings > Spotmap** and add your first feed
4. In the block editor, type `/spotmap` to insert a map into any post or page

### Connecting devices

**SPOT:** Create an XML Feed in your SPOT account ([instructions](https://www.findmespot.com/en-us/support/spot-gen4/get-help/general/public-api-and-xml-feed)). Enter the Feed ID in Spotmap settings. Positions are polled automatically. Your Feed ID looks like: `0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`

**OsmAnd:** Configure OsmAnd's online tracking to send positions to the REST endpoint shown in Spotmap settings.

**Teltonika:** Point your Teltonika device's data sending configuration to the endpoint shown in Spotmap settings.

**Photos:** Upload geotagged images to your WordPress media library. Spotmap reads the EXIF GPS data and displays them under the feed name `media`.

## Security

### Message content and phone numbers

SPOT devices can include a phone number or personal message in their transmission data. This information is stored in the database and may appear in marker popups on your map.
To overwrite this content, use the **Marker** section in `Settings > Spotmap`.
Setting a feed password in your SPOT account (and entering it in the plugin settings) ensures that the message content is not stored in the WordPress database and thus not accessible by the public.

### Live location privacy

The plugin offers a cosmetic filter to hide points newer than a configurable threshold (e.g. 30 minutes, 2 hours, or 1 day). This prevents the most recent positions from appearing on the public map.

**Important:** this filter is display-only. The REST API endpoint exposed by the plugin can return all points stored in the database, regardless of the block filter setting. There is currently no way to fully hide the latest positions from a technically capable visitor. If hiding live locations from the API is a requirement, you should restrict access to the REST API endpoint at the server or WordPress level.

### Map tokens

API tokens for tile layer providers (Mapbox, Thunderforest, LINZ, IGN France, OS UK, etc.) are stored in WordPress settings and embedded in the page HTML at render time. Any visitor who views the page source can read your token.

To reduce the risk of token abuse, **restrict each token to your domain using the provider's referrer/HTTP origin restrictions** (e.g. `https://yoursite.com/*`).

### SQL injection prevention

All database queries use prepared statements as of version 1.0.

## Frequently Asked Questions

### Which GPS devices are supported?

SPOT satellite communicators (via FindMeSPOT XML feed), OsmAnd (via HTTP), and Teltonika GPS routers and trackers (direct integration). You can also display GPS coordinates from geotagged photos in your WordPress media library. Zoleo support is planned.

### Can I show multiple devices on one map?

Yes. Configure multiple feeds and display them on a single map, each with its own color.

### Does Spotmap work with the block editor?

Yes. Spotmap includes a full Gutenberg block with live preview. Type `/spotmap` in the editor and configure all options in the block sidebar.

### Can I filter the map to show only recent positions?

Yes. Spotmap supports rich time filtering including relative ranges like "last 12 hours" or "last 3 days", as well as absolute date ranges.

### Can I display photo locations on the map?

Yes. Upload geotagged photos to your WordPress media library. Spotmap reads the GPS EXIF data and shows them on the map under the feed name `media`.

### Can I export my tracking data?

Yes. You can convert tracked positions to GPX files directly from the plugin.

### Can I add GPX tracks to show a planned route?

Yes. Use the built-in GPX manager to upload and organize GPX files. Tracks, routes, and waypoints are displayed as overlays on the map.

### What map styles are available?

Spotmap uses Leaflet and supports any XYZ tile provider. OpenStreetMap is included by default. Optional providers include Mapbox, Thunderforest, LINZ (New Zealand topos), IGN France, UK Ordnance Survey, USGS, OpenSeaMap, and ESRI Ocean layers. You can also add any custom tile URL. Browse available maps at [leaflet-providers](https://leaflet-extras.github.io/leaflet-providers/preview/) and [OpenStreetMap wiki](https://wiki.openstreetmap.org/wiki/Tiles).

### Is Spotmap suitable for shared hosting?

Yes, for SPOT, OsmAnd, and photo EXIF. All three use HTTP-based data transfer. Teltonika integration may require additional configuration depending on your device model and hosting.

### Which third-party services does the plugin use?

1. [SPOT LLC](http://findmespot.com) — [Public API](https://www.findmespot.com/en-us/support/spot-gen4/get-help/general/public-api-and-xml-feed) for position data
2. (optional) [TimeZoneDB.com](https://timezonedb.com) — local time calculation for positions. [Create an account](https://timezonedb.com/register) and add the key in settings.
3. (optional) [Mapbox](https://mapbox.com) — satellite imagery and map styles. [Get an API token](https://account.mapbox.com/access-tokens/). Restrict the token to your domain.
4. (optional) [Thunderforest](https://thunderforest.com) — additional map styles. [Sign up](https://manage.thunderforest.com/users/sign_up?plan_id=5).
5. (optional) [LINZ](https://www.linz.govt.nz) — official New Zealand topo maps. [Create an API key](https://www.linz.govt.nz/data/linz-data-service/guides-and-documentation/creating-an-api-key).
6. (optional) [Géoportail France](https://geoservices.ign.fr/) — official IGN France maps. [Register](https://geoservices.ign.fr/user/register).
7. (optional) [UK Ordnance Survey](https://osdatahub.os.uk) — official UK OS maps. [Create a free plan](https://osdatahub.os.uk/plans) and [set up a project](https://osdatahub.os.uk/docs/wmts/gettingStarted).

### How does Spotmap compare to other GPS tracking plugins?

Spotmap fills a unique niche in the WordPress plugin ecosystem:

**vs. Trackserver** — Trackserver is the closest alternative and supports a wide range of phone tracking apps (TrackMe, OruxMaps, µLogger, GPSLogger, and others). If your primary use case is recording tracks from a smartphone app, Trackserver covers more protocols. However, Spotmap offers several things Trackserver does not:

* **Satellite communicator support** — Spotmap works with SPOT devices (and Zoleo is planned), which matters for off-grid adventures where your phone has no signal. Trackserver only supports phone-based tracking apps.
* **Teltonika device support** — direct integration for GPS routers and vehicle trackers.
* **Modern editor experience** — Spotmap has a full Gutenberg block with live preview and sidebar settings. Trackserver is shortcode-only with 20+ attributes to configure manually.
* **Built-in GPX manager** — upload and organize GPX files from the dashboard instead of referencing URLs in shortcodes.
* **Photo EXIF integration** — geotagged images from the media library appear on the map automatically.
* **Rich time filtering UI** — relative ranges like "last 24 hours" with a visual interface instead of shortcode parameters.
* **Interactive data table** — click a position to zoom to it on the map.

**vs. GPS Plotter** — Android-phone-only, Google Maps dependent, no GPX support, no satellite devices.

**In short:** if you track with a satellite communicator, a Teltonika device, or want a modern block-editor experience with visual filtering and data management, Spotmap is the better fit. If you need protocol support for niche phone tracking apps (TrackMe, µLogger, OwnTracks), check out Trackserver.

### I have a question, an idea, or found a bug

Head over to the [support forum](https://wordpress.org/support/plugin/spotmap/) or open an issue on [GitHub](https://github.com/techtimo/Spotmap).

## Screenshots

1. Three months of tracking data with colored track lines and GPX overlays
2. Click any position to see details — marker popups with timestamp and message
3. The Gutenberg block with live map preview
4. Time filtering with relative ranges and the interactive data table
5. The GPX manager
6. Multiple devices on a single map with different colors

## Changelog

### 1.0.0

* New: **OsmAnd** device support — receive positions via HTTP
* New: **Teltonika** device support — direct integration
* New: **Photo EXIF GPS** — images with GPS data from the media library can appear on the map if configured
* New: Built-in **GPX manager** — upload and manage GPX files
* New: Rich **time filtering** with relative ranges (last X hours/days) and absolute date ranges
* New: Interactive **data table** linked to map — click a row to zoom to that position
* New: **GPX export** — convert tracked positions to GPX files
* Improved: Full **Gutenberg block** with live preview and block sidebar settings
* Improved: Map engine rewritten to support **faster map rendering** with large numbers of points
* Fix: `id` column gains `AUTO_INCREMENT` (was missing in 0.11.2); migration runs automatically on update

## Upgrade Notice

### 1.0.0

Major update with multi-device support (OsmAnd, Teltonika), GPX manager, time filtering, data table, photo EXIF display, and significant performance improvements. The database is migrated automatically — no manual SQL required. Your existing GPS data is preserved.
