=== Spotmap ===
Contributors: techtimo
Donate link:
Tags: findmespot, spotgen3, spotbeacon, topomap, liveposition
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 3.5
Tested up to: 5.3
Stable tag: 0.1

The plugin will show sent positions of a findmespot device on a topographic embedded map 🗺

== Description ==

⚠ In order to use this plugin you will need a spot emergency beacon from ([SPOT LLC](http://findmespot.com)) and an active subscription.

Use the following Shortcode to display the map in a post or page:
```
[spotmap mapcenter="last" height="500"]
```
With `mapcenter` you can configure if the map centers all points (`all`) or zooms in to the latest known position (`last`). Default value: `all`

With `height` you set the height of the map in pixels. Default `400`.


== Installation ==

After installing the plugin, head over to your Dashboard  `Settings > Spotmap` and enter your Feed ID of your Spot Feed.


== Frequently Asked Questions ==

= How do I get my Feed ID? =
First of all you need to create a Shared Page in your Spot account the link to this page looks similar to the following link
http://share.findmespot.com/shared/faces/viewspots.jsp?glId=0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB 
Everthing after the `glId=` is your feed id:
```
0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB
```

== Screenshots ==

[https://i.ibb.co/tXz0Db8/spotmap.png Screenshot of a configured spotmap using for 3 months]

== Changelog ==

= 0.1 =
- Initial Revision
