=== Spotmap ===
Contributors: techtimo
Donate link:
Tags: findmespot, spotgen3, spotbeacon, topomap, liveposition
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 4.7
Tested up to: 5.3
Stable tag: 0.1

See your Spot device movements on a topographic map inside your Blog! 🗺

== Description ==

⚠ In order to use this plugin you will need a spot emergency beacon from [SPOT LLC](http://findmespot.com) and an active subscription.

This plugin will show an embedded map with all the sent positions of one or more spot devices.
If needed the map can show a subset of the data. i.e. the last weekend getaway.

If you feel like this plugin is missing importants part, let me know. Maybe I have some free time to change it.


== Installation ==

After installing the plugin, head over to your Dashboard  `Settings > Spotmap`. Add a feed by selecting `findmespot` from the dropdown and hit Save.

Now you can enter your XML Feed Id here and give it a nice name. Soon Wordpress will download the points that are present in the XML Feed.

In the mean time we can create an empty map with the Shortcode: `[Spotmap]`

Congrats, you just created your own Spotmap.

There are some attributes we can parse with the Shortcode:

Note: `devices` must always match your feed name.

This will show a slighlty larger map and the points are all in yellow.
```
[spotmap height=600 devices=spot colors=yellow]
```
This will show a map where we zoom into the last known position, and we only show data from the the first of May.
```
[spotmap mapcenter=last devices=spot colors=red date-range-from="2020-05-01"]
```
We can also show multiple tracks in different colors on a same day.
```
[spotmap mapcenter=last devices=spot,spot2 colors=gray,green date="2020-06-01"]
```
== Frequently Asked Questions ==

= How do I get my Feed ID? =
First of all you need to create a XML Feed in your Spot account. If you have multiple devices, select only one.
The link to the newly created feed looks similar to the following link: `http://share.findmespot.com/shared/faces/viewspots.jsp?glId=0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`
Everthing after the `=` is your feed id:
`0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`


== Screenshots ==

[https://i.ibb.co/tXz0Db8/spotmap.png Screenshot of a configured spotmap using for 3 months]

== Changelog ==
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
