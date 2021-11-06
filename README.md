# 🗺 Spotmap 
[![WordPress Plugin: Version](https://img.shields.io/wordpress/plugin/v/spotmap?color=green&logo=wordpress) ![WordPress Plugin: Tested WP Version](https://img.shields.io/wordpress/plugin/tested/spotmap?color=green&logo=wordpress)](https://wordpress.org/plugins/spotmap/)

Spotmap is a Wordpress plugin that can show an embedded map  with all the recent positions of a Spot beacon 
([findmespot.com](http://findmespot.com)). In addition it can display GPX tracks to show where you intend to go.



The following screenshot was taken after using the plugin for 3 months:

![screen1](https://user-images.githubusercontent.com/22075114/83943321-64eb6600-a7fb-11ea-94a6-a8a0a5823407.png)

It is possible to change the underlayed map (will be configurable in future releases).
You can interupt the line connecting all points with a time intervall. (Here it was set to 12hrs, so that the line stops if no new points were sent in 12 hours)

![screen2](https://user-images.githubusercontent.com/22075114/83943319-61f07580-a7fb-11ea-8384-0d03b361c657.png)

There is more you can do. Check the Usage section.

## Installation 
Just login to your Wordpress Dashboard and go to `Dasboard > Plugins > Add New`.
Search for "Spotmap" and install the first search result.
After installing the plugin you can head over to `Settings > Spotmap` and enter your Feed ID of your Spot Feed.

If you like to test out the newest Developement Version download the current master branch [here](https://github.com/techtimo/spotmap/archive/master.zip).

## Usage
After installing the plugin, head over to your Dashboard  `Settings > Spotmap`. Add a feed by selecting `findmespot` from the dropdown and hit Save.

Now you can enter your XML Feed Id here and give it a nice name. Soon Wordpress will download the points that are present in the XML Feed.

If you use Gutenberg type /spotmap to create a new Spotmap block.

If you prefer shortcodes tpye `[Spotmap]`

Congrats 🎉 You just created your own Spotmap. 

There are some attributes we can parse with the Shortcode:

Note: `feeds` must always match your configured feed name.

This will show a bigger map and the points are all in yellow:
```
[spotmap height=600 width=full feeds=spot colors=yellow]
```

This will show a map where we zoom into the last known position, and we only show data from the the first of May:
```
[spotmap mapcenter=last feeds=spot colors=red date-range-from="2020-05-01"]
```

We can also show multiple tracks in different colors on a same day:
```
[spotmap mapcenter=last feeds=spot,spot2 colors=gray,green date="2020-06-01"]
```

 
## FAQ
### How do I get my Feed ID
You need to create an XML Feed in your spot account. ([See here](https://github.com/techtimo/spotmap/issues/4#issuecomment-638001718) for more details)
Unless you like to group devices under one name, it's good to create one feed per device, so you can manage the devices independently. 
Your XML Feed id should look similar to this: `0Wl3diTJcqqvncI6NNsoqJV5ygrFtQfBB`
### Can I use/add other maps?
Have you created your mapbox/thunderforest API key yet? If not this is a good way to start and get other map styles.
If you still search for another map search [here](https://leaflet-extras.github.io/leaflet-providers/preview/) and also [here](https://wiki.openstreetmap.org/wiki/Tiles).
If you have found a map, create a new post in the [support forum](https://wordpress.org/support/plugin/spotmap/).

