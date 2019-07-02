# Spotmap
Spotmap is a Wordpress plugin that can show an embedded map with all the recent positions of a Spot beacon 
([findmespot.com](http://findmespot.com)).

The map uses [Leaflet](https://leafletjs.com/) and shows the  [OpenTopoMap](https://opentopomap.org/about)
This way it is much more useful compared the limited options Spot is [offering for this](https://faq.findmespot.com/index.php?action=showEntry&data=71).
It uses [wp cron](https://codex.wordpress.org/Function_Reference/wp_cron) to regular check the Spot API for new points.
Furthermore it uses [Leaflet.fullscreen](https://github.com/Leaflet/Leaflet.fullscreen)

Currently the Plugin will show all positions since configuring the plugin. The following screenshot was taken after using the plugin for 3 months:

![Screenshot of a configured spotmap](https://i.ibb.co/tXz0Db8/spotmap.png)

## Installation 
Download the [current version](https://github.com/techtimo/spotmap/archive/master.zip) of Spotmap. 
Go to your `Dasboard > Plugins > Add New` and click the button `Upload Plugin`. Choose the downloaded Zip file and press "Install Now"
After installing the plugin you can head over to `Settings > Spotmap` and enter your Feed ID of your Spot Feed.

## Usage
Use the following Shortcode to display the map:
```
[spotmap mapcenter="last" height="500"]
```
With `mapcenter` you can configure if the map centers all points (`all`) or zooms in to the latest known position (`last`). Default value: `all`

With `height` you set the height of the map in pixels. Default `400`.

 
## FAQ
### How do I get my Feed ID
First of all you need to create a Shared Page in your Spot account the link to this page looks similar to the following link
http://share.findmespot.com/shared/faces/viewspots.jsp?glId=0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB 
