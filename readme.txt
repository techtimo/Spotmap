=== Spotmap ===
Contributors: techtimo
Donate link:
Tags: findmespot, spot gen 3, spot3, spot, spotbeacon, liveposition, gpx, gps, tracking, spottrace, saved by spot, spotwalla
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 5
Tested up to: 5.4
Stable tag: trunk

See your Spot device movements on an embedded map inside your Blog! 🗺 Add GPX tracks, routes and waypoints to see a planned route.

== Description ==

Spot does not offer a history of sent positions for more than 7 days. That's where Spotmap comes into the game:
Your Wordpress Site will store all positions ever sent. It checks for new positions every 2.5 minutes.
It supports different devices (They can even belong to different accounts).

With a shortcode you can add an embedded map to your post or page. By default it will show all positions ever sent.
If needed the map can show a subset of the data. i.e. the last weekend getaway.

Next planned features: 
- Translatable version of the plugin
- Full support of the Spotmap block for Gutenberg.

If you feel like this plugin is missing importants part, let me know. Maybe I have some free time to change it. 😉


== Installation ==

After installing the plugin, head over to your Dashboard  `Settings > Spotmap`. Add a feed by selecting `findmespot` from the dropdown and hit "Add Feed".

Now you can enter your XML Feed Id, a name for the feed and a password if you have one.  Press "Save". A few minutes later Wordpress will download the points that are present in the XML Feed.

In the mean time we can create an empty map with the Shortcode: 
`[spotmap]`

🎉 Congrats! You just created your first Spotmap. 🎉

To fine tune the map, there are some attributes we can pass with the shortcode:
`maps=OpenTopoMap` will show only the OpenTopoMap as map. Default `"OpenStreetMap,OpenTopoMap"`
If you create a mapbox API Key and store it in the settings page. You can choose other map types as well: `Outdoors,Streets,Satelite` 
Use it like this: `maps="Satelite,Streets,OpenStreetMap"` This will show a satelite image as the selected map, but it can be changed to the other two maps (Streets, OpenStreetMap).
`height=600` can define the height of the map in pixels. Default is `400`.
`width=full` if you add this the map will appear in full width. Default is `normal`
`mapcenter=last` can be used to zoom into the last known position. Default `all`. Can be set to `'gpx'` to center all GPX files (see below for configurations)
`splitlines=8` will split the lines between points if two points are sent with a difference greater than X hours. Default 12. Set to 0 if you don't like to see any line.
`date-range-from=2021-01-01` can be used to show all points starting from date and time X. (Can lie in the future)
`date-range-to=2022-01-01 19:00` can be used to show all points until date and time X.

The following attributes can be used to show GPX tracks:
`gpx-name="Track 1,Track 2"` give the tracks a nice name
`gpx-url="wordpress.com/gpx/track1.gpx,wordpress.com/gpx/track2.gpx" specify the URL of the GPX files.
`gpx-color="green,#347F33"` give your tracks some color. (It can be any color you can think of, or some hex values)

If there are areas where tracks overlap each other, the track named first will be on top of the other.


Note: `feeds` must always match your feed name.
This will show a bigger map and the points are all in yellow:
```
[spotmap height=600 width=full feeds=spot colors=yellow]
```


This will show a map where we zoom into the last known position, and we only show data from the the first of May:
```
[spotmap mapcenter=last feeds=spot colors=red date-range-from="2020-05-01"]
```


We can also show multiple feeds in different colors on a same day:
```
[spotmap mapcenter=last feeds=spot,spot2 colors=gray,green date="2020-06-01"]
``` 
= GPX =
test

== Frequently Asked Questions ==

= How do I get my Feed ID? =
You need to create an XML Feed in your spot account. ([See here](https://github.com/techtimo/spotmap/issues/4#issuecomment-638001718) for more details)
Unless you like to group devices under one name, it's good to create one feed per device, so you can manage the devices independently. 
Your XML Feed id should look similar to this: `0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`

= Which 3rd Party Services are getting used? =
The plugin uses the following thrid party services:
1.  From [SPOT LLC](http://findmespot.com) it uses the [Public API](https://www.findmespot.com/en-us/support/spot-x/get-help/general/spot-api-support) to get the points.
2. (OPTIONALLY) [Mapbox, Inc.](mapbox.com) To get satelite images and nice looking maps, you can sing up for a [Mapbox API Token](https://account.mapbox.com/access-tokens/). Make sure to restrict the token usage to your domain only!


= Can I use/add other maps? =
Have you created your mapbox API key yet? If not this is a good way to get awesome looking maps.
If you still search for another map [here](https://wiki.openstreetmap.org/wiki/Tiles).
If you have found a map, create a new post in the [support forum](https://wordpress.org/support/plugin/spotmap/).

= I have a question, an idea, ... =
Head over to the wordpress.org [support forum](https://wordpress.org/support/plugin/spotmap/), and ask your question there. I am happy to assist you.
If you found a bug, you can open an issue on my [GitHub Repo](https://github.com/techtimo/spotmap). (But you can also mentioned it in the forum 😉).

== Screenshots ==
 
1. This screenshot was taken after using the plugin for 3 months.
2. You can click on every sent positions to get more information. Points sent from a 'normal' Tracking will appear as small dots.

== Changelog ==
= 0.9 =
- new shortcode to show table of messages
- add gpx overlays
- new maps available
= 0.7 =
- added support for multiple feeds
- filter for certain date ranges
- added a Gutenberg Block (still experimental!)

If you upgrade to this version from a previous one please deactivate and activate the plugin.
If you wish to keep the points from the db, you have to run the following SQL snippet:
```
ALTER TABLE {$PREFIX}spotmap_points` 
ADD COLUMN `device` VARCHAR(100) NULL AFTER `custom_message`;
UPDATE {$PREFIX}spotmap_points SET device = '{$new_feedname}' where 1;
```

= 0.3 =
- First working draft

== Upgrade Notice ==
 
= 0.9 =
If you upgrade to this version from a previous, please uninstall the plugin first.
If you have data in the db you don't want to loose, please create a post in the support forum.

Adding Gpx support to show a planned route. Adding different maps.
Adding a table to quickly see the last sent messages.

= 0.7 =
redoing the whole frontend part. Now it looks much better!
 
= 0.3 =
This version fixes a security related bug.  Upgrade immediately.