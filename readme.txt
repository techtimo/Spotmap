=== Spotmap ===
Contributors: techtimo
Donate link: paypal.me/ebaytimo
Tags: findmespot, find me spot, saved by spot, spot gps, spot tracker, spotbeacon, liveposition, gpx, gps tracking, gps tracker, spottrace, spotwalla
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 5.3
Tested up to: 5.8

See your Spot device movements on an embedded map inside your Blog! 🗺 Add GPX tracks, routes and waypoints to see a planned route.

## Description

Spot does not offer the storage of points free of charge for long term. That's where Spotmap comes into the game:
Your Wordpress Site will store all positions ever sent. It checks for new positions every 2.5 minutes.
It supports different devices (They can even belong to different accounts).

The map can fetch new points autmatically without relaoding the entire Post.



🆕 Support of Gutenberg block editor. Just type `/spotmap` and open the settings on the right.

Currently only the GPX colors cannot be cahnged individually inside the block settings.

With a shortcode you can add an embedded map to your post or page. By default it will show all positions ever sent.
If needed the map can show a subset of the data. i.e. the last weekend getaway.

Next planned features (Not necessarily in right order): 

- grouping of points (partially implemented)

- support of other tracking devices (Garmin InReach, ...)

- Translatable version of the plugin

- Full support of the Spotmap block for Gutenberg

- delete/move points from the Dashboard

- export to gpx files 

👉 If you feel like this plugin is missing importants part, let me know. Maybe I have some free time to change this fact. 😉


## Installation

After installing the plugin, head over to your Dashboard  `Settings > Spotmap`. Add a feed by selecting `findmespot` from the dropdown and hit "Add Feed".

Now you can enter your XML Feed Id, a name for the feed and a password if you have one.  Press "Save". A few minutes later Wordpress will download the points that are present in the XML Feed.

In the mean time you can create an empty map with the Shortcode: 
`[spotmap]`

If you use the block editor Gutenberg, you can search for a block named 'Spotmap'.

🎉 Congrats! You just created your first Spotmap. 🎉

If you use the Block editor make sure to select the map and click on the settings icon in the top right corner, in order to see all settings related to the map.

If you use the shortcode,check the Additional attributes section.
👉 If you need help to configure your map, post a question in the [support forum](https://wordpress.org/support/plugin/spotmap/). 👈
### Additional attributes

If you add new maps, check the FAQ

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

- `auto-reload` will auto update the map without the need to reload the page. (This hasn't been tested much...)

- `last-point` will show the last sent point as big marker, to be easily found. Can also be used with a limited range of colors (yellow,red,green,black,gray,blue) like `last-point=red`

- `feeds` can be set, if multiple feeds get used. (See example below, if you have only one spot this is not needed)

#### GPX
**The following attributes can be used to show GPX tracks:**

- `gpx-name="Track 1,Track 2"` give the tracks a nice name. (Spaces can be used)

- `gpx-url="yourwordpress.com/wp-content/track1.gpx,yourwordpress.com/wp-content/track2.gpx"` specify the URL of the GPX files. (You can upload GPX files to your media library)

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
You need to create an XML Feed in your spot account. ([See here](https://www.findmespot.com/en-us/support/spot-x/get-help/general/spot-api-support) for more details)
Unless you like to group devices under one name, it's good to create one feed per device, so you can manage the devices independently. 
Your XML Feed id should look similar to this: `0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`

### Which 3rd Party Services are getting used?
The plugin uses the following thrid party services:
1.  From [SPOT LLC](http://findmespot.com) it uses the [Public API](https://www.findmespot.com/en-us/support/spot-x/get-help/general/spot-api-support) to get the points.
2. (optionally) [TimeZoneDB.com](TimeZoneDB.com)  To calculate the localtime of sent positions. Create an account [here](https://timezonedb.com/register). Paste the key in the settings page.
3. (optionally) [Mapbox, Inc.](mapbox.com) To get satelite images and nice looking maps, you can sign up for a [Mapbox API Token](https://account.mapbox.com/access-tokens/). I recommend to restrict the token usage to your domain only.
4. (optionally) [Thunderforest](thunderforest.com) To get another set of maps. Create an account [here](https://manage.thunderforest.com/users/sign_up?plan_id=5). Paste the key in the settings page.
5. (optionally) [Land Information New Zealand (LINZ)](https://www.linz.govt.nz) To get the official Topo Maps of NZ create an account [here](https://www.linz.govt.nz/data/linz-data-service/guides-and-documentation/creating-an-api-key). Paste the key in the settings page.
6. (optionally) [Géoportail France](https://geoservices.ign.fr/documentation/diffusion/formulaire-de-commande-geoservices.html) To get the official Topo Maps of IGN France. Create an account [here](https://www.sphinxonline.com/surveyserver/s/etudesmk/Geoservices_2021/questionnaire.htm) (french only). Paste the key in the settings page.
7. (optionally) [UK Ordnance Survey](https://osdatahub.os.uk) To get the official UK OS maps. Create a free plan [here](https://osdatahub.os.uk/plans). And follow this guide on how to [create a project](https://osdatahub.os.uk/docs/wmts/gettingStarted).


### Can I use/add other maps?
Have you created your mapbox/thunderforest API key yet? If not this is a good way to start and get other map styles. See the question 'Which 3rd Party Services are getting used?' for details
If you still search for another map: Start a search [here](https://leaflet-extras.github.io/leaflet-providers/preview/) and also [here](https://wiki.openstreetmap.org/wiki/Tiles).
If you have found a map, create a new post in the [support forum](https://wordpress.org/support/plugin/spotmap/).

### I have a question, an idea, found a bug... 
Head over to the wordpress.org [support forum](https://wordpress.org/support/plugin/spotmap/), and ask your question there. I'm happy to assist you! 😊

## Screenshots
 
1. This screenshot was taken after using the plugin for 3 months.
2. You can click on every sent positions to get more information. Points sent from a 'normal' Tracking will appear as small dots.

## Changelog
= 0.11.2 =
- new marker styles and options how to configure them. Changeable icons
- maps with many points will load faster
- tested with WP 5.8
- Thirdparty API options page includes many comments to better understand what each service is for.
- new initial map state added: 'last-trip'. Zooms to the last line on the map (In the feed settings splitlines must be activated to work)

= 0.10.3 =
- added UK  Ordnance Survey
- added US Geological Survey maps
- possability to hide nearby points of the same type

= 0.10.2 =
- tested Wordpress 5.7 
- add last-point option to show the latest position as a big marker. (Requested by Elia)
- fix reload issue of the map inside Gutenberg if no changes were made

= 0.10.1 =
Full Gutenberg Block support
added NZtopomap
added France IGN Topo map token

= 0.9 =
- new shortcode to show table of messages
- add gpx overlays
- new maps available (mapbox, thunderforest, swisstopo)

= 0.7 =
- added support for multiple feeds
- filter for certain date ranges
- added a Gutenberg Block (still experimental!)


## Upgrade Notice
 
= 0.9 =
If you upgrade to this version from a previous, please uninstall the plugin first.
If you have data in the db you don't want to loose, please create a post in the support forum.

Adding Gpx support to show a planned route. Adding different maps.
Adding a table to quickly see the last sent messages. ([spotmessages])

