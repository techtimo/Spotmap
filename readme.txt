# Spotmap
Contributors: techtimo
Donate link: paypal.me/ebaytimo
Tags: findmespot, spot gen 3, spot3, spot, spotbeacon, liveposition, gpx, gps, tracking, tracker, spottrace, saved by spot, spotwalla
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 5.3
Tested up to: 5.5

See your Spot device movements on an embedded map inside your Blog! 🗺 Add GPX tracks, routes and waypoints to see a planned route.

## Description

Spot does not offer a history of sent positions for more than 7 days. That's where Spotmap comes into the game:
Your Wordpress Site will store all positions ever sent. It checks for new positions every 2.5 minutes.
It supports different devices (They can even belong to different accounts).

With a shortcode you can add an embedded map to your post or page. By default it will show all positions ever sent.
If needed the map can show a subset of the data. i.e. the last weekend getaway.

Next planned features (Not necessarily in right order): 

- grouping of points

- support of other tracking devices (Garmin InReach, ...)

- Translatable version of the plugin

- Full support of the Spotmap block for Gutenberg

- delete/move points from the Dashboard

- export to gpx files 

👉 If you feel like this plugin is missing importants part, let me know. Maybe I have some free time to change this fact. 😉


## Installation

After installing the plugin, head over to your Dashboard  `Settings > Spotmap`. Add a feed by selecting `findmespot` from the dropdown and hit "Add Feed".

Now you can enter your XML Feed Id, a name for the feed and a password if you have one.  Press "Save". A few minutes later Wordpress will download the points that are present in the XML Feed.

In the mean time we can create an empty map with the Shortcode: 
`[spotmap]`

🎉 Congrats! You just created your first Spotmap. 🎉

👉 If you need help to configure your map, post a question in the [support forum](https://wordpress.org/support/plugin/spotmap/). 👈
### Additional attributes

To fine tune the map, there are some attributes we can pass with the shortcode:

_Note:_ all the Default values of the attributes can be changed in the settings in Dashboard. This comes in handy, if you use several maps on the blog, and you like to configure them all in one place. Of course you can still use the attributes to overide the default values.

#### Map

- `maps=opentopomap` will show only the opentopomap as map. Default `"openstreetmap,opentopomap"`.
  If you create a mapbox API Key and store it in the settings page. You can choose other map types as well: `mb-outdoors,mb-streets,mb-satelite` 
  Use it like this: `maps="mb-satelite,mb-streets,openstreetmap"` This will show a satelite image as the selected map, but it can be changed to the other two maps (mb-streets, openstreetmap).

- `map-overlays=openseamap` can be added to see the openseamap overlay in the map. (You need to zoom in quite a bit).

- `height=600` can define the height of the map in pixels. 

- `width=full` if you add this the map will appear in full width. Default is `normal`.

- `mapcenter=last` can be used to zoom into the last known position. Default `all`. Can be set to `'gpx'` to center all GPX files (see below for configurations).

### Feeds

- `splitlines=8` will split the lines between points if two points are sent with a difference greater than X hours. Default 12. Set to 0 if you don't like to see any line.

- `date-range-from=2021-01-01` can be used to show all points starting from date and time X. (Can lie in the future).

- `date-range-to=2022-01-01 19:00` can be used to show all points until date and time X.

- `auto-reload=1` will auto update the map without the need to reload the page.

- `tiny-types=UNLIMITED-TRACK,STOP` can be used to configure if a point is shown with a big marker on the map or not

- `feeds` can be set, if multiple feeds get used. (See example below)

#### GPX
**The following attributes can be used to show GPX tracks:**

- `gpx-name="Track 1,Track 2"` give the tracks a nice name. (Spaces can be used)

- `gpx-url="yourwordpress.com/wp-content/track1.gpx,yourwordpress.com/wp-content/track2.gpx"` specify the URL of the GPX files. (You can upload GPX files to your blog like an image)

- `gpx-color="green,#347F33"` give your tracks some color. (It can be any color you can think of, or some hex values)

If there are areas where tracks overlap each other, the track named first will be on top of the others.

_Note:_ `feeds` must always match your feed name.
This will show a bigger map and the points are all in yellow:

`[spotmap height=600 width=full feeds="My Spot Feed" colors=yellow]`

This will show a map where we zoom into the last known position, and we only show data from the the first of May:

`[spotmap mapcenter=last feeds="My Spot" colors=red date-range-from="2020-05-01"]`


We can also show multiple feeds in different colors on a same day:

`[spotmap mapcenter=last feeds="My first spot,My other Device" colors="gray,green" date="2020-06-01"]` 


## Frequently Asked Questions

### How do I get my Feed ID?
You need to create an XML Feed in your spot account. ([See here](https://github.com/techtimo/spotmap/issues/4#issuecomment-638001718) for more details)
Unless you like to group devices under one name, it's good to create one feed per device, so you can manage the devices independently. 
Your XML Feed id should look similar to this: `0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`

### Which 3rd Party Services are getting used?
The plugin uses the following thrid party services:
1.  From [SPOT LLC](http://findmespot.com) it uses the [Public API](https://www.findmespot.com/en-us/support/spot-x/get-help/general/spot-api-support) to get the points.
2. (optionally) [Mapbox, Inc.](mapbox.com) To get satelite images and nice looking maps, you can sign up for a [Mapbox API Token](https://account.mapbox.com/access-tokens/). I recommend to restrict the token usage to your domain only.
3. (optionally) [Thunderforest](thunderforest.com) To get another set of maps. Create an account [here](https://manage.thunderforest.com/users/sign_up?plan_id=5). Paste the key in the settings page.
4. (optionally) [TimeZoneDB.com](TimeZoneDB.com)  To calculate the localtime of sent positions. Create an account [here](https://timezonedb.com/register). Paste the key in the settings page.


### Can I use/add other maps?
Have you created your mapbox/thunderforest API key yet? If not this is a good way to start and get other map styles.
If you still search for another map search [here](https://leaflet-extras.github.io/leaflet-providers/preview/) and also [here](https://wiki.openstreetmap.org/wiki/Tiles).
If you have found a map, create a new post in the [support forum](https://wordpress.org/support/plugin/spotmap/).

### I have a question, an idea, ... 
Head over to the wordpress.org [support forum](https://wordpress.org/support/plugin/spotmap/), and ask your question there. I am happy to assist you.
If you found a bug, you can open an issue on the [GitHub Repo](https://github.com/techtimo/spotmap). (But you can also mentioned it in the forum 😉).

## Screenshots
 
1. This screenshot was taken after using the plugin for 3 months.
2. You can click on every sent positions to get more information. Points sent from a 'normal' Tracking will appear as small dots.

## Changelog
= 0.9 =

If you upgrade to this version from a previous one please delete and reinstall the plugin.
WARNING: all data will be lost. if you like to upgrade please post in the support forum.

- new shortcode to show table of messages
- add gpx overlays
- new maps available (mapbox, thunderforest, swisstopo)

= 0.7 =
- added support for multiple feeds
- filter for certain date ranges
- added a Gutenberg Block (still experimental!)


= 0.3 =
- First working draft

## Upgrade Notice
 
= 0.9 =
If you upgrade to this version from a previous, please uninstall the plugin first.
If you have data in the db you don't want to loose, please create a post in the support forum.

Adding Gpx support to show a planned route. Adding different maps.
Adding a table to quickly see the last sent messages. ([spotmessages])

= 0.7 =
redoing the whole frontend part. Now it looks much better!
 
= 0.3 =
This version fixes a security related bug.  Upgrade immediately.
