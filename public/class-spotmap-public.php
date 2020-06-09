<?php
class Spotmap_Public{
	
	public $db;

	function __construct() {
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-database.php';
		$this->db = new Spotmap_Database();
    }

	public function enqueue_styles() {
		wp_enqueue_style( 'leafletcss', plugin_dir_url( __FILE__ ) . 'leaflet/leaflet.css');
		wp_enqueue_style( 'custom', plugin_dir_url( __FILE__ ) . 'css/custom.css');
        wp_enqueue_style( 'leafletfullscreencss', plugin_dir_url( __FILE__ ) . 'leafletfullscreen/leaflet.fullscreen.css');
    }

	public function enqueue_block_editor_assets(){
		$this->enqueue_scripts();
		$this->enqueue_styles();
		wp_enqueue_script(
			'spotmap-block',
			plugins_url('js/block.js', __FILE__),
			['wp-blocks', 'wp-element']
		);
	}

	public function enqueue_scripts(){
        wp_enqueue_script('leaflet',  plugins_url( 'leaflet/leaflet.js', __FILE__ ));
        wp_enqueue_script('leaflet-fullscreen',plugin_dir_url( __FILE__ ) . 'leafletfullscreen/leaflet.fullscreen.js');
        wp_enqueue_script('leaflet-gpx',plugin_dir_url( __FILE__ ) . 'leaflet-gpx/gpx.js');
        wp_enqueue_script('spotmap-handler', plugins_url('js/maphandler.js', __FILE__), array('jquery'), false, true);
		
		wp_localize_script('spotmap-handler', 'spotmapjsobj', array(
			'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			'maps' => $this->get_maps(),
			'url' =>  plugin_dir_url( __FILE__ )

		));
	}

	public function get_maps(){
		$maps_file = plugin_dir_path( dirname( __FILE__ ) ) . 'config/maps.json';
		if(file_exists($maps_file)){
			$maps = json_decode(file_get_contents($maps_file),true);
			$token = get_option('spotmap_mapbox_token');
			foreach ($maps as $name => &$data) {
				// error_log(print_r($data,true));
				if(!empty($token)){
					$data['options']['mapboxToken'] = $token;
				} else if(isset($data['options']['mapboxToken'])){
					unset($maps[$name]);
				}
			}
			return $maps;
		}
	}

	public function register_shortcodes(){
		add_shortcode('spotmap', [$this,'show_spotmap'] );
	}

	function show_spotmap($atts,$content){
		// if no attributes are provided use the default:
			foreach ($atts as $key => &$values) {
				if(is_array($values)){
					foreach($values as &$entry){
						$entry =_sanitize_text_fields($entry);
					}
				} else {
					$values = _sanitize_text_fields($values);
				}
			}
			error_log("TEST".wp_json_encode($atts));
			$a = shortcode_atts( [
				'height' => '500',
				'mapcenter' => 'all',
				'devices' => $this->db->get_all_feednames(),
				'width' => 'normal',
				'colors' => ['blue', 'gold', 'red', 'green', 'orange', 'yellow', 'violet'],
				'splitlines' => '[12,12,12,12]',
				'date-range-from' => '',
				'date' => '',
				'date-range-to' => '',
				'gpx-name' => [],
				'gpx-url' => [],
				'maps' => ['OpenStreetMap', 'OpenTopoMap']
			], $atts );
			error_log(wp_json_encode($a));

			foreach (['devices','splitlines','colors','gpx-name','gpx-url','maps'] as $value) {
				if(!empty($a[$value]) && !is_array($a[$value])){
					// error_log($a[$value]);
					$a[$value] = explode(',',$a[$value]);
				}
		}

		// TODO test what happens if array lengths are different
	
		$styles = [];
		if(!empty($a['devices'])){
			foreach ($a['devices'] as $key => $value) {
				$styles[$value] = [
					'color'=>$a['colors'][$key],
					'splitLines' => $a['splitlines'][$key]
					];
			}
		}
		$gpx = [];
		if(!empty($a['gpx-url'])){
			foreach ($a['gpx-url'] as $key => $value) {
				$name = $a['gpx-name'][$key];
				$gpx[$name] = $value;
			}
		}
		// generate the option object for init the map
		$options = wp_json_encode([
			'feeds' => $a['devices'],
			'styles' => $styles,
			'gpx' => $gpx,
			'date' => $a['date'],
			'dateRange' => [
				'from' => $a['date-range-from'],
				'to' => $a['date-range-to']
			],
			'mapcenter' => $a['mapcenter'],
			'maps' => $a['maps']
		]);
		// error_log($options);
		
		$css ='height: '.$a['height'].'px;z-index: 0;';
		if($a['width'] == 'full'){
			$css .= "max-width: 100%;";
		}

		return '<div id="spotmap-container" style="'.$css.'"></div><script type=text/javascript>jQuery( document ).ready(function() {initMap('.$options.');});</script>';
	}


	public function the_action_function(){
		// error_log(print_r($_POST,true));
		$points = $this->db->get_points($_POST);
		if(isset($points['error'])){
			wp_send_json($points);
		}
		
		foreach ($points as &$point){
			$point->unixtime = $point->time;
			$point->date = date_i18n( get_option('date_format'), $point->time );
			$point->time = date_i18n( get_option('time_format'), $point->time );
		}
		wp_send_json($points);
	}

}
