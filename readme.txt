# Spotmap

Contributors: techtimo
Donate link: paypal.me/ebaytimo
Tags: findmespot, find me spot, saved by spot, spot gps, spot tracker, spotbeacon, liveposition, gpx, gps tracking, gps tracker, spottrace, spotwalla
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 5.3
Tested up to: 6.9

See your Spot device movements on an embedded map inside your Blog! 🗺 Add GPX tracks, routes and waypoints to see a planned route.

## Description

Spot does not offer the storage of points free of charge for long term. That's where Spotmap comes into the game:
Your Wordpress Blog will store all positions ever sent. It checks for new positions every 2.5 minutes.
It supports different devices (They can even belong to different accounts).

Next planned features (Not necessarily in right order):

- grouping of points (partially implemented)
- support of other tracking devices (Garmin InReach, ...)
- Translatable version of the plugin
- delete/move points from the Dashboard
- export to gpx files 

## Installation

After installing the plugin, head over to your Dashboard  `Settings > Spotmap`. Add a feed by selecting `findmespot` from the dropdown and hit "Add Feed".

Now you can enter your XML Feed Id, a name for the feed and a password if you have one.  Press "Save". A few minutes later Wordpress will download the points that are present in the XML Feed.

In the mean time you can create an empty map in the editor with `/spotmap`

🎉 Congrats! You just created your first Spotmap.


👉 If you need help to configure your map, post a question in the [support forum](https://wordpress.org/support/plugin/spotmap/). 👈


### GPX

**The following attributes can be used to show GPX tracks:**

- `gpx-name="Track 1,Track 2"` give the tracks a nice name. (Spaces can be used)

- `gpx-url="yourwordpress.com/wp-content/track1.gpx,yourwordpress.com/wp-content/track2.gpx"` specify the URL of the GPX files. (You can upload GPX files to your media library. Make sure to not use 'http://'!)

- `gpx-color="green,#347F33"` give your tracks some color. (It can be any color you can think of, or some hex values)

If there are areas where tracks overlap each other, the track named first will be on top of the others.

_Note:_ `feeds` must always match your feed name.
This will show a bigger map and the points are all in yellow:

`[spotmap height=600 width=full feeds="My Spot Feed" colors=yellow]`

This will show a map where we zoom into the last known position, and we only show data from the the first of May:

`[spotmap mapcenter=last feeds="My Spot" colors=red date-range-from="2020-05-01"]`

We can also show multiple feeds in different colors on a same day (from 0:00:00 to 23:59:59):

`[spotmap mapcenter=last feeds="My first spot,My other Device" colors="gray,green" date="2020-06-01"]` 


## Frequently Asked Questions

### How do I get my Feed ID?

You need to create an XML Feed in your spot account. ([See here](https://www.findmespot.com/en-us/support/spot-gen4/get-help/general/public-api-and-xml-feed) for more details)
Unless you like to group devices under one name, it's good to create one feed per device, so you can manage the devices independently. 
Your XML Feed id should look similar to this: `0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`

### Which 3rd Party Services are getting used?

The plugin uses the following thrid party services:

1. From [SPOT LLC](http://findmespot.com) it uses the [Public API](https://www.findmespot.com/en-us/support/spot-gen4/get-help/general/public-api-and-xml-feed) to get the points.
2. (optionally) [TimeZoneDB.com](TimeZoneDB.com)  To calculate the localtime of sent positions. Create an account [here](https://timezonedb.com/register). Paste the key in the settings page.
3. (optionally) [Mapbox, Inc.](mapbox.com) To get satelite images and nice looking maps, you can sign up for a [Mapbox API Token](https://account.mapbox.com/access-tokens/). I recommend to restrict the token usage to your domain only.
4. (optionally) [Thunderforest](thunderforest.com) To get another set of maps. Create an account [here](https://manage.thunderforest.com/users/sign_up?plan_id=5). Paste the key in the settings page.
5. (optionally) [Land Information New Zealand (LINZ)](https://www.linz.govt.nz) To get the official Topo Maps of NZ create an account [here](https://www.linz.govt.nz/data/linz-data-service/guides-and-documentation/creating-an-api-key). Paste the key in the settings page.
6. (optionally) [Géoportail France](https://geoservices.ign.fr/) To get the official Topo Maps of IGN France. Create an account [here](https://geoservices.ign.fr/user/register) (french only). Paste the key in the settings page.
7. (optionally) [UK Ordnance Survey](https://osdatahub.os.uk) To get the official UK OS maps. Create a free plan [here](https://osdatahub.os.uk/plans). And follow this guide on how to [create a project](https://osdatahub.os.uk/docs/wmts/gettingStarted).


### Can I use/add other maps?

Have you created your mapbox/thunderforest API key yet? If not this is a good way to start and get other map styles. See the question 'Which 3rd Party Services are getting used?' for details
If you still search for another map: Start a search [here](https://leaflet-extras.github.io/leaflet-providers/preview/) and also [here](https://wiki.openstreetmap.org/wiki/Tiles).
If you have found a map, create a new post in the [support forum](https://wordpress.org/support/plugin/spotmap/).

### I have a question, an idea, found a bug, etc

Head over to the wordpress.org [support forum](https://wordpress.org/support/plugin/spotmap/), and ask your question there. I'm happy to assist you! 😊

## Screenshots

1. This screenshot was taken after using the plugin for 3 months.
2. You can click on every sent positions to get more information. Points sent from a 'normal' Tracking will appear as small dots.

## Changelog

### 1.0

- Gutenberg block — add a Spotmap map directly from the block editor with live preview
- Rewritten map engine in TypeScript for better reliability and maintainability
- 
- Support for media uploads shown in the map: images uploaded to WordPress with GPS EXIF data appear as map points under the feed name `media`
- Security: all database queries use prepared statements to prevent SQL injection
- `id` column gains `AUTO_INCREMENT` (was missing in 0.11.2); migration runs automatically on first load after update
- tested with WP 6.9

### 0.11.2

- new marker styles and options how to configure them. Changeable icons
- maps with many points will load faster
- tested with WP 5.8
- Thirdparty API options page includes many comments to better understand what each service is for.
- new initial map state added: 'last-trip'. Zooms to the last line on the map (In the feed settings splitlines must be activated to work)

### 0.10.3

- added UK  Ordnance Survey
- added US Geological Survey maps
- possability to hide nearby points of the same type

### 0.10.2

- tested Wordpress 5.7
- add last-point option to show the latest position as a big marker. (Requested by Elia)
- fix reload issue of the map inside Gutenberg if no changes were made

## Upgrade Notice

### 1.0

The database table is migrated automatically when the plugin loads after the update — no manual SQL required. Your existing GPS data is preserved.

