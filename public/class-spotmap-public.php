<?php
class Spotmap_Public{

	private const SHORTCODE_TAGS = [
		'show_spotmap'        => [ 'spotmap', 'Spotmap' ],
		'show_point_overview' => [ 'spotmessages', 'Spotmessages' ],
	];

	public $db;
	public $admin;
	private ?bool $enqueue_cache = null;

	function __construct( $admin = null ) {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-options.php';
		$this->db    = new Spotmap_Database();
		$this->admin = $admin ?? new Spotmap_Admin();
    }

	private function should_enqueue(): bool {
		if ( $this->enqueue_cache !== null ) {
			return $this->enqueue_cache;
		}
		global $post;
		if ( ! is_a( $post, 'WP_Post' ) ) {
			return $this->enqueue_cache = false;
		}
		if ( has_block( 'spotmap/spotmap', $post ) || has_block( 'spotmap/spotmessages', $post ) ) {
			return $this->enqueue_cache = true;
		}
		foreach ( self::SHORTCODE_TAGS as $tags ) {
			foreach ( $tags as $tag ) {
				if ( has_shortcode( $post->post_content, $tag ) ) {
					return $this->enqueue_cache = true;
				}
			}
		}
		return $this->enqueue_cache = false;
	}

	public function enqueue_styles() {
		if ( ! $this->should_enqueue() ) {
			return;
		}
		$map_asset_file = plugin_dir_path( dirname( __FILE__ ) ) . 'build/spotmap-map.asset.php';
		$map_asset = file_exists( $map_asset_file ) ? include $map_asset_file : [ 'dependencies' => [], 'version' => false ];
		wp_enqueue_style(
			'spotmap-map',
			plugin_dir_url( dirname( __FILE__ ) ) . 'build/spotmap-map.css',
			[],
			$map_asset['version']
		);
    }

	public function register_post_meta(): void {
		foreach ( [ 'post', 'page' ] as $post_type ) {
			foreach ( [ '_spotmap_latitude', '_spotmap_longitude' ] as $key ) {
				register_post_meta( $post_type, $key, [
					'show_in_rest'  => true,
					'single'        => true,
					'type'          => 'string',
					'default'       => '',
					'auth_callback' => function() {
						return current_user_can( 'edit_posts' );
					},
				] );
			}
		}
	}

	public function register_block(){
		$block_path = plugin_dir_path( dirname( __FILE__ ) ) . 'build/spotmap';
		register_block_type( $block_path );
		$messages_block_path = plugin_dir_path( dirname( __FILE__ ) ) . 'build/spotmessages';
		if ( is_dir( $messages_block_path ) ) {
			register_block_type( $messages_block_path );
		} else {
			error_log( 'Spotmap: build/spotmessages/ is missing — run npm run build.' );
		}
	}

	public function enqueue_block_editor_assets(){
		// Always enqueue map-engine scripts in the editor regardless of whether
		// the block is already saved in the post — new blocks need them too.
		$map_asset_file = plugin_dir_path( dirname( __FILE__ ) ) . 'build/spotmap-map.asset.php';
		$map_asset = file_exists( $map_asset_file ) ? include $map_asset_file : [ 'dependencies' => [], 'version' => false ];
		wp_enqueue_script(
			'spotmap-handler',
			plugin_dir_url( dirname( __FILE__ ) ) . 'build/spotmap-map.js',
			array_merge( $map_asset['dependencies'], [ 'jquery' ] ),
			$map_asset['version'],
			true
		);
		$this->localize_js_script( 'spotmap-handler' );
		// Always load the map CSS in the editor — should_enqueue() would skip it
		// for new posts that don't yet have a Spotmap block, but the post-location
		// sidebar map picker needs Leaflet CSS on every post.
		wp_enqueue_style(
			'spotmap-map',
			plugin_dir_url( dirname( __FILE__ ) ) . 'build/spotmap-map.css',
			[],
			$map_asset['version']
		);
		$this->localize_js_script( 'spotmap-spotmap-editor-script' );
		$this->localize_js_script( 'spotmap-spotmessages-editor-script' );

		// Post location sidebar — Gutenberg plugin that adds a map picker to the
		// Document sidebar. Only functional when "posts" is a configured feed.
		$post_location_asset_file = plugin_dir_path( dirname( __FILE__ ) ) . 'build/post-location.asset.php';
		$post_location_asset = file_exists( $post_location_asset_file )
			? include $post_location_asset_file
			: [ 'dependencies' => [], 'version' => false ];
		wp_enqueue_script(
			'spotmap-post-location',
			plugin_dir_url( dirname( __FILE__ ) ) . 'build/post-location.js',
			$post_location_asset['dependencies'],
			$post_location_asset['version'],
			true
		);
		$this->localize_js_script( 'spotmap-post-location' );
	}

	public function enqueue_scripts(){
		if ( ! $this->should_enqueue() ) {
			return;
		}
        // wp_enqueue_script('spotmap-handler', plugins_url('js/maphandler.js', __FILE__), ['jquery','moment','lodash'], false, true);
		$map_asset_file = plugin_dir_path( dirname( __FILE__ ) ) . 'build/spotmap-map.asset.php';
		$map_asset = file_exists( $map_asset_file ) ? include $map_asset_file : [ 'dependencies' => [], 'version' => false ];
		wp_enqueue_script(
			'spotmap-handler',
			plugin_dir_url( dirname( __FILE__ ) ) . 'build/spotmap-map.js',
			array_merge( $map_asset['dependencies'], [ 'jquery' ] ),
			$map_asset['version'],
			true
		);
		$this->localize_js_script( 'spotmap-handler' );
	}

	function localize_js_script($script_slug){
		$default_values  = Spotmap_Options::get_settings();
		$posts_type_feeds = array_filter(
			Spotmap_Options::get_feeds(),
			fn( $f ) => ( $f['type'] ?? '' ) === 'posts'
		);
		wp_localize_script($script_slug, 'spotmapjsobj', [
			'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
			'maps'           => $this->admin->get_maps(),
			'overlays'       => $this->admin->get_overlays(),
			'url'            => plugin_dir_url( __FILE__ ),
			'feeds'          => $this->db->get_all_feednames(),
			'defaultValues'  => $default_values,
			'marker'         => Spotmap_Options::get_marker_options(),
			'postsFeedNames' => array_values( array_column( $posts_type_feeds, 'name' ) ),
		]);
	}

	public function register_shortcodes(){
		foreach ( self::SHORTCODE_TAGS as $method => $tags ) {
			foreach ( $tags as $tag ) {
				add_shortcode( $tag, [ $this, $method ] );
			}
		}
	}
	function show_point_overview($atts){
		// error_log("Shortcode init vals: ".wp_json_encode($atts));
		$default_filter_points = Spotmap_Options::get_setting('filter-points');
		$a = array_merge(
			shortcode_atts([
				'count'=> 10,
				'types'=>'HELP,HELP-CANCEL,OK,CUSTOM',
				'feeds' => $this->db->get_all_feednames(),
				'group'=>'type,feed_name',
				'date-range-from' => '',
				'date' => '',
				'date-range-to' => '',
				'auto-reload' => FALSE,
				'filter-points' => $default_filter_points,
			], $atts),
			$atts);
		// get the keys that don't require a value
		if(array_key_exists('auto-reload',$atts)){
			$a['auto-reload']=TRUE;
		}
		// error_log("Shortcode after vals: ".wp_json_encode($a));
		foreach (['types','feeds'] as $value) {
			if(!empty($a[$value]) && !is_array($a[$value])){
				// error_log($a[$value]);
				$a[$value] = explode(',',$a[$value]);
			}
		}
		foreach ($a as $key => &$values) {
			if(is_array($values)){
				foreach($values as &$entry){
					$entry =_sanitize_text_fields($entry);
				}
			} else {
				$values = _sanitize_text_fields($values);
			}
		}
		
		$options = [
			'select' => "type,id,message,local_timezone,feed_name, time",
			'type'=>$a['types'],
			'filterPoints' => $a['filter-points'],
			'feeds' => $a['feeds'],
			'dateRange' => [
				'from' => $a['date-range-from'],
				'to' => $a['date-range-to']
			],
			'orderBy' => "time DESC",
			'limit' => $a['count'],
			'groupBy' => $a['group'],
			'autoReload' => $a['auto-reload'],
		];
		$table_id = "spotmap-table-".mt_rand();
		return '
	<table id='.$table_id.'></table>
	<script type=text/javascript>var spotmap; jQuery(function(){spotmap = new Spotmap('. wp_json_encode($options).');spotmap.initTable("'.$table_id.'")})</script>';

	}

	public function show_spotmap_block($options){
		$options_json = wp_json_encode($options);
		// error_log("BLOCK init vals: ". $options_json);
		return '<div id="'.$options['mapId'].'" class='. (!empty($a['align']) ? 'align'.$a['align'] : '' ). ' style="z-index: 0;"></div>
	<script type=text/javascript>var spotmap; jQuery(function(){spotmap = new Spotmap('.$options_json.');spotmap.initMap()})</script>';
	}
	public function show_spotmap($atts,$content = null){
		if(empty($atts)){
			$atts = [];
		}
		// error_log("Shortcode init vals: ".wp_json_encode($atts));
		// $atts['feeds'] = $atts['devices'];
		$defaults = Spotmap_Options::get_settings();
		$a = array_merge(
			shortcode_atts( [
				'height' => $defaults['height'],
				'mapcenter' => $defaults['mapcenter'],
				'feeds' => $this->db->get_all_feednames(),
				'width' => $defaults['width'],
				'colors' => $defaults['color'],
				'splitlines' => $defaults['splitlines'],
				'auto-reload' => FALSE,
				'last-point' => FALSE,
				'date-range-from' => NULL,
				'date' => NULL,
				'date-range-to' => NULL,
				'gpx-name' => [],
				'gpx-url' => [],
				'gpx-color' => ['blue', 'gold', 'red', 'green', 'orange', 'yellow', 'violet'],
				'maps' => $defaults['maps'],
				'map-overlays' => $defaults['map-overlays'],
				'filter-points' => $defaults['filter-points'],
				'debug'=> FALSE,
				'locate-button' => FALSE,
				'fullscreen-button' => TRUE,
				'navigation-buttons' => TRUE,
				'scroll-wheel-zoom' => TRUE,
				'enable-panning' => TRUE,
			], $atts ),
			$atts);
		if (array_key_exists('feeds',$atts)){
			$a['feeds'] = $atts['feeds'];
		}
		// get the keys that don't require a value 
		foreach (['auto-reload','debug','last-point',] as $value) {
			if(in_array($value,$atts)){
				if (array_key_exists($value,$atts) && !empty($atts[$value])){
					// if a real value was provided in the shortcode
					$a[$value] = $atts[$value];
				} else {
					$a[$value]=TRUE;
				}
			}
		}
		
		foreach (['feeds','splitlines','colors','gpx-name','gpx-url','gpx-color','maps','map-overlays',] as $value) {
			if(!empty($a[$value]) && !is_array($a[$value])){
				// error_log($a[$value]);
				$a[$value] = explode(',',$a[$value]);
				foreach ($a[$value] as $key => &$data) {
					if (empty($data)){
						unset($a[$value][$key]);
					}
				}
			}
		}
		// error_log(wp_json_encode($a));
		foreach ($atts as $key => &$values) {
			if(is_array($values)){
				foreach($values as &$entry){
					$entry =_sanitize_text_fields($entry);
				}
			} else {
				$values = _sanitize_text_fields($values);
			}
		}
	
		// valid inputs for feeds?
		$styles = [];
		if(!empty($a['feeds'])){
			$number_of_feeds = count($a['feeds']);
			$count_present_numbers = count($a['splitlines']);
			if($count_present_numbers < $number_of_feeds){
				$fillup_array = array_fill($count_present_numbers, $number_of_feeds - $count_present_numbers, $a['splitlines'][0]);
				$a['splitlines'] = array_merge($a['splitlines'],$fillup_array);

				// error_log(print_r($a['splitlines'],true));
			}
			if(count($a['colors']) < $number_of_feeds){
				$a['colors'] = array_fill(0,$number_of_feeds, $a['colors'][0]);
			}
			foreach ($a['feeds'] as $key => $value) {
				$styles[$value] = [
					'color'=>$a['colors'][$key],
					'splitLines' => $a['splitlines'][$key],
					];
			}
		}

		// If last-point is set, mark it on every feed style so the engine highlights
		// the latest point — matching the per-feed lastPoint toggle in the block editor.
		if ( ! empty( $a['last-point'] ) ) {
			foreach ( $styles as &$style ) {
				$style['lastPoint'] = true;
			}
			unset( $style );
		}

		// valid inputs for gpx tracks?
		$gpx = [];
		if(!empty($a['gpx-url'])){
			$number_of_tracks = count($a['gpx-url']);
			$count_present_numbers = count($a['gpx-color']);
			if($count_present_numbers < $number_of_tracks){
				$fillup_array = [];
				for ($i = $count_present_numbers; $i < $number_of_tracks; $i++) { 
					$value = $a['gpx-color'][$i % $count_present_numbers];
					$a['gpx-color'] = array_merge($a['gpx-color'],[$value]);
				}
			}
			if(empty($a['gpx-name'])){
				$a['gpx-name'][0] = "GPX";
			}
			if(count($a['gpx-name']) < $number_of_tracks){
				$a['gpx-name'] = array_fill(0,$number_of_tracks, $a['gpx-name'][0]);
			}
			foreach ($a['gpx-url'] as $key => $url) {
				$name = $a['gpx-name'][$key];
				$gpx[] = [
					'title' => $name,
					'url' => $url,
					"color" => $a['gpx-color'][$key]
				];
			}
		}
		// If a single date is given, expand it to a full-day dateRange so the engine
		// receives only dateRange (matching the block renderer).
		if ( ! empty( $a['date'] ) && empty( $a['date-range-from'] ) && empty( $a['date-range-to'] ) ) {
			$parsed = date_create( $a['date'] );
			if ( $parsed !== null ) {
				$day = date_format( $parsed, 'Y-m-d' );
				$a['date-range-from'] = $day . ' 00:00:00';
				$a['date-range-to']   = $day . ' 23:59:59';
			}
		}
		$map_id = "spotmap-container-".mt_rand();
		// generate the option object for init the map
		$options = wp_json_encode([
			'feeds' => $a['feeds'],
			'filterPoints' => $a['filter-points'],
			'styles' => $styles,
			'gpx' => $gpx,
			'dateRange' => [
				'from' => $a['date-range-from'],
				'to' => $a['date-range-to']
			],
			'mapcenter' => $a['mapcenter'],
			'maps' => $a['maps'],
			'mapOverlays' => $a['map-overlays'],
			'autoReload' => $a['auto-reload'],
			'debug' => $a['debug'],
			'locateButton' => (bool) $a['locate-button'],
			'fullscreenButton' => (bool) $a['fullscreen-button'],
			'navigationButtons' => $a['navigation-buttons'] ? [ 'enabled' => true, 'allPoints' => true, 'latestPoint' => true, 'gpxTracks' => true ] : [ 'enabled' => false ],
			'scrollWheelZoom' => (bool) $a['scroll-wheel-zoom'],
			'enablePanning' => (bool) $a['enable-panning'],
			'mapId' => $map_id
		]);
		// error_log($options);
		
		$css ='height: '.$a['height'].'px;z-index: 0;';
		if($a['width'] == 'full'){
			$css .= "max-width: 100%;";
		}

		return '
	<div id="'.$map_id.'" style="'.$css.'"></div>
	<script type=text/javascript>var spotmap; jQuery(function(){spotmap = new Spotmap('.$options.');spotmap.initMap()})</script>';
	}


	public function get_positions(){
		// error_log(print_r($_POST,true));
		if ( empty( $_POST['feeds'] ) ) {
			wp_send_json( [ 'error' => false, 'empty' => true, 'title' => 'No feeds defined', 'message' => '' ] );
			return;
		}

		$requested_feeds = (array) $_POST['feeds'];
		$results         = [];

		// Virtual feeds (type='posts') are backed by post meta, not the GPS
		// points table. Identify them by their configured type, not their name,
		// so the feed name can be freely chosen by the user.
		$configured   = array_filter( Spotmap_Options::get_feeds(), fn( $f ) => ! empty( $f['name'] ) );
		$type_by_name = array_column( array_values( $configured ), 'type', 'name' );

		$posts_feed_names = [];
		$db_feed_names    = [];
		foreach ( $requested_feeds as $name ) {
			if ( ( $type_by_name[ $name ] ?? '' ) === 'posts' ) {
				$posts_feed_names[] = $name;
			} else {
				$db_feed_names[] = $name;
			}
		}

		if ( ! empty( $posts_feed_names ) ) {
			$results = array_merge( $results, $this->get_post_feed_points( $_POST, $posts_feed_names ) );
		}

		$requested_feeds = $db_feed_names;

		if ( ! empty( $requested_feeds ) ) {
			$filter          = $_POST;
			$filter['feeds'] = $requested_feeds;
			$db_points       = $this->db->get_points( $filter );
			if ( is_array( $db_points ) && ! isset( $db_points['error'] ) ) {
				$media_ids = array_map(
					fn( $p ) => (int) $p->model,
					array_filter( $db_points, fn( $p ) => $p->type === 'MEDIA' && ! empty( $p->model ) )
				);
				if ( ! empty( $media_ids ) ) {
					update_postmeta_cache( $media_ids );
				}
				foreach ( $db_points as $point ) {
					if ( $point->type === 'MEDIA' && ! empty( $point->model ) ) {
						$point->message = wp_get_attachment_image_url( (int) $point->model, 'medium' ) ?: null;
					}
				}
				$results = array_merge( $results, $db_points );
			} elseif ( empty( $results ) ) {
				wp_send_json( $db_points );
				return;
			}
		}

		if ( empty( $results ) ) {
			wp_send_json( [ 'error' => false, 'empty' => true, 'title' => 'No points to show (yet)', 'message' => '' ] );
			return;
		}

		wp_send_json( $results );
	}

	private function get_post_feed_points( array $filter, array $feed_names ): array {
		$args = [
			'post_type'      => [ 'post', 'page' ],
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => 'date',
			'order'          => 'ASC',
			'meta_query'     => [
				'relation' => 'AND',
				[
					'key'     => '_spotmap_latitude',
					'value'   => '',
					'compare' => '!=',
				],
				[
					'key'     => '_spotmap_longitude',
					'value'   => '',
					'compare' => '!=',
				],
			],
		];

		$date_query = [];
		$date_range = $filter['date-range'] ?? [];
		foreach ( [ 'from' => 'after', 'to' => 'before' ] as $range_key => $wp_key ) {
			$val = $date_range[ $range_key ] ?? '';
			if ( empty( $val ) ) {
				continue;
			}
			if ( substr( $val, 0, 5 ) === 'last-' ) {
				$rel_string = str_replace( '-', ' ', substr( $val, 5 ) );
				$date       = date_create( '@' . strtotime( '-' . $rel_string ) );
			} else {
				$date = date_create( $val );
			}
			if ( $date !== null && $date !== false ) {
				$date_query[] = [ $wp_key => date_format( $date, 'Y-m-d H:i:s' ), 'inclusive' => true ];
			}
		}
		if ( ! empty( $date_query ) ) {
			$date_query['relation'] = 'AND';
			$args['date_query']     = $date_query;
		}

		$posts = get_posts( $args );
		$points = [];

		// Each posts-type feed gets the same set of located posts. Using the
		// first feed name is the common case; multiple posts-type feeds would
		// duplicate points intentionally (user chose to add them twice).
		$feed_name = $feed_names[0];

		foreach ( $posts as $post ) {
			$lat = (float) get_post_meta( $post->ID, '_spotmap_latitude', true );
			$lng = (float) get_post_meta( $post->ID, '_spotmap_longitude', true );

			if ( $lat === 0.0 && $lng === 0.0 ) {
				continue;
			}

			$unixtime  = (int) get_post_time( 'U', false, $post );
			$image_url = null;
			if ( has_post_thumbnail( $post->ID ) ) {
				$image_url = get_the_post_thumbnail_url( $post->ID, 'medium' );
			}

			$excerpt = has_excerpt( $post )
				? wp_strip_all_tags( get_the_excerpt( $post ) )
				: null;

			$points[] = (object) [
				'id'        => $post->ID,
				'feed_name' => $feed_name,
				'latitude'  => $lat,
				'longitude' => $lng,
				'altitude'  => 0,
				'type'      => 'POST',
				'unixtime'  => $unixtime,
				'date'      => wp_date( get_option( 'date_format' ), $unixtime ),
				'time'      => wp_date( get_option( 'time_format' ), $unixtime ),
				'message'   => get_the_title( $post ),
				'url'       => get_permalink( $post ),
				'image_url' => $image_url,
				'excerpt'   => $excerpt,
			];
		}

		return $points;
	}

}
