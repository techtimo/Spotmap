# Spotmap Shortcode Reference

Two shortcodes are available:

- `[spotmap]` — embeds an interactive Leaflet map
- `[spotmessages]` — embeds a table of SPOT messages/events

---

## `[spotmap]`

### Map Content

| Attribute | Type | Default | Possible values / notes |
| --- | --- | --- | --- |
| `feeds` | comma-separated strings | all feeds | Feed names as configured in Spotmap admin, e.g. `feeds="alice,bob"` |
| `date` | `YYYY-MM-DD` | — | Show only points from a single day. Expands internally to a full-day range. Cannot be combined with `date-range-from`/`to`. |
| `date-range-from` | string | — | Start of date/time filter. Accepts an absolute datetime (`2024-07-01 08:00:00`) or a relative value (`last-7-days`, `last-2-hours`, `last-30-minutes`). See [Relative time values](#relative-time-values). |
| `date-range-to` | string | — | End of date/time filter. Same formats as `date-range-from`. Use a relative value here to exclude the most recent points, e.g. `date-range-to="last-30-minutes"` hides the live position. |
| `filter-points` | integer (metres) | `5` (admin default) | Removes GPS noise: skips points closer than this distance to the previous point |

### Map Style / Appearance

| Attribute | Type | Default | Possible values / notes |
| --- | --- | --- | --- |
| `height` | integer (px) | `500` | Height of the map container in pixels |
| `width` | string | `"normal"` | `"normal"` · `"full"` (100% container width) |
| `mapcenter` | string | `"all"` | See [mapcenter values](#mapcenter-values) below |
| `maps` | comma-separated strings | `"openstreetmap,opentopomap"` | Tile layer IDs from `config/maps.yaml`, e.g. `maps="openstreetmap,satellite"`. First entry is the initial layer; additional entries appear in the layer switcher. |
| `map-overlays` | comma-separated strings | — | Overlay tile layer IDs from `config/maps.yaml` to enable on top of the base layer |
| `colors` | comma-separated strings | `"blue,red"` | Line/marker color per feed. Named colors (`blue`, `red`, `green`, `gold`, `orange`, `yellow`, `violet`, `black`, `white`) or hex values. Cycles if fewer values than feeds. |
| `splitlines` | comma-separated integers (hours) | `"12"` | Hours gap that splits a GPS track into separate polyline segments, per feed. Use `0` to disable splitting. Cycles if fewer values than feeds. |

### GPX Tracks

| Attribute | Type | Default | Possible values / notes |
| --- | --- | --- | --- |
| `gpx-url` | comma-separated URLs | — | One or more GPX file URLs to overlay on the map |
| `gpx-name` | comma-separated strings | `"GPX"` | Display label per GPX track. Cycles if fewer than URLs. |
| `gpx-color` | comma-separated strings | `"blue,gold,red,green,orange,yellow,violet"` | Color per GPX track. Cycles if fewer than URLs. |

### Map Controls & Interaction

| Attribute | Type | Default | Possible values / notes |
| --- | --- | --- | --- |
| `fullscreen-button` | boolean | `true` | `true` · `false` — show a fullscreen toggle button |
| `locate-button` | boolean | `false` | `true` · `false` — show a "locate me" button (jumps to the user's GPS position) |
| `navigation-buttons` | boolean | `true` | `true` · `false` — show the zoom-to cycling button (see [Navigation buttons](#navigation-buttons) below) |
| `scroll-wheel-zoom` | boolean | `true` | `true` · `false` — enable mouse-wheel zoom. Set to `false` to prevent the map from consuming scroll events on long pages. |
| `enable-panning` | boolean | `true` | `true` · `false` — enable drag-to-pan. Set to `false` for a static, non-interactive map. |
| `last-point` | flag (no value) | `false` | Add attribute to highlight the latest GPS point of every feed with a large circle marker |
| `auto-reload` | flag (no value) | `false` | Add attribute to auto-refresh map data periodically |

### Debug

| Attribute | Type | Default | Possible values / notes |
| --- | --- | --- | --- |
| `debug` | flag (no value) | `false` | Add attribute to enable verbose debug output in the browser console |

---

### Relative time values

`date-range-from` and `date-range-to` accept relative values using the format `last-{n}-{unit}`, where unit is any value PHP's `strtotime` understands (hyphens replace spaces).

| Example | Meaning |
| --- | --- |
| `last-30-minutes` | 30 minutes ago |
| `last-2-hours` | 2 hours ago |
| `last-7-days` | 7 days ago |
| `last-1-month` | 1 month ago |

**Common patterns:**

```
// Show only the last 24 hours of track data
[spotmap date-range-from="last-24-hours"]

// Show last 7 days but hide the live position (last 30 minutes)
[spotmap date-range-from="last-7-days" date-range-to="last-30-minutes"]

// Show a fixed window in the past — absolute datetimes still work too
[spotmap date-range-from="2024-07-01 00:00:00" date-range-to="2024-07-31 23:59:59"]
```

---

### `mapcenter` values

Controls which area the map initially fits/zooms to after data loads.

| Value | Behaviour |
| --- | --- |
| `all` | Fit all GPS points **and** GPX tracks (default) |
| `feeds` | Fit GPS feed points only (ignores GPX tracks) |
| `gpx` | Fit GPX tracks only (ignores feed points) |
| `last` | Zoom to the single latest GPS point across all feeds |
| `last-trip` | Fit the last polyline segment of each feed (points since the last split) |
| `lat,lng` | Center on exact coordinates, e.g. `mapcenter="47.3769,8.5417"` — no auto-zoom |

---

### Navigation buttons

When `navigation-buttons="true"` (default), a cycling zoom-to button appears on the map. Each click cycles through the enabled targets:

| Target | Behaviour |
| --- | --- |
| All points | `fitBounds` to all GPS points + GPX tracks |
| Latest point | `fitBounds` to the most recent GPS point |
| GPX tracks | `fitBounds` to GPX track extent (only shown if GPX tracks are present) |

---

### Examples

```
[spotmap]

[spotmap feeds="alice" height="400" mapcenter="last"]

[spotmap feeds="alice,bob" colors="blue,red" splitlines="6,6" date="2024-07-15"]

[spotmap date-range-from="2024-07-01 00:00:00" date-range-to="2024-07-31 23:59:59" maps="openstreetmap,satellite"]

[spotmap gpx-url="https://example.com/track.gpx" gpx-name="My Hike" gpx-color="green" mapcenter="gpx"]

[spotmap scroll-wheel-zoom="false" enable-panning="false"]

[spotmap auto-reload last-point debug]
```

---

## `[spotmessages]`

Renders a table of SPOT message events (OK check-ins, HELP alerts, custom messages, etc.).

| Attribute | Type | Default | Possible values / notes |
| --- | --- | --- | --- |
| `feeds` | comma-separated strings | all feeds | Feed names to include |
| `count` | integer | `10` | Maximum number of rows to display |
| `types` | comma-separated strings | `"HELP,HELP-CANCEL,OK,CUSTOM"` | Message types to filter: `HELP` · `HELP-CANCEL` · `OK` · `CUSTOM` · `UNLIMITED-TRACK` · `TRACK` · `NEWMOVEMENT` |
| `group` | comma-separated strings | `"type,feed_name"` | Column(s) to group by. Allowed values: any DB column name (`type`, `feed_name`, `time`, etc.). Set to empty string to disable grouping. |
| `date` | `YYYY-MM-DD` | — | Show only messages from a single day |
| `date-range-from` | string | — | Start of date/time filter. Accepts absolute (`2024-07-01 08:00:00`) or relative (`last-7-days`, `last-2-hours`) values. |
| `date-range-to` | string | — | End of date/time filter. Same formats as `date-range-from`. |
| `filter-points` | integer (metres) | admin default | Minimum distance filter passed through to the query |
| `auto-reload` | flag (no value) | `false` | Add attribute to auto-refresh the table periodically |

### Examples

```
[spotmessages]

[spotmessages count="5" types="HELP,OK" feeds="alice"]

[spotmessages date-range-from="2024-07-01 00:00:00" date-range-to="2024-07-31 23:59:59" auto-reload]
```

---

## Notes

- **Flag attributes** (`auto-reload`, `last-point`, `debug`) activate when the attribute name is present with no value: `[spotmap auto-reload]`. Providing a truthy value also works: `auto-reload="1"`.
- **Comma-separated lists** (`feeds`, `colors`, `splitlines`, `maps`, `gpx-url`, etc.) are split on `,`; empty entries are stripped.
- **`colors` and `splitlines`** are padded to match the number of feeds by repeating the first value if too few entries are supplied.
- **Admin defaults** for `height`, `width`, `mapcenter`, `maps`, `color`, `splitlines`, and `filter-points` come from *Spotmap → Settings* and can be overridden per-shortcode instance.
