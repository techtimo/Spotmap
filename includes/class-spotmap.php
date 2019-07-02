<?php
/**
 * Created by PhpStorm.
 * User: Work
 * Date: 6/19/2019
 * Time: 4:56 PM
 */
class Spotmap{

	protected $loader;
	protected $plugin_name = 'spotmap';
	protected $version;

	public function __construct() {
		if ( defined( 'SPOTMAP__VERSION' ) ) {
			$this->version = SPOTMAP_VERSION;
		}

		$this->load_dependencies();
		$this->define_admin_hooks();
		$this->define_public_hooks();
	}

	private function load_dependencies() {
		/**
		 * The class responsible for orchestrating the actions and filters of the
		 * core plugin.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-loader.php';

		/**
		 * The class responsible for defining all actions that occur in the admin area.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'admin/class-spotmap-admin.php';

		/**
		 * The class responsible for defining all actions that occur in the public-facing
		 * side of the site.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'public/class-spotmap-public.php';

		$this->loader = new Spotmap_Loader();

	}

	/**
	 * Register all of the hooks related to the admin area functionality
	 * of the plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function define_admin_hooks() {
		$spotmap_admin = new Spotmap_Admin();
		$this->loader->add_action( 'admin_enqueue_scripts', $spotmap_admin, 'enqueue_scripts');
		$this->loader->add_filter( 'cron_schedules', $spotmap_admin, 'add_cron_schedule');
		$this->loader->add_action( 'admin_menu', $spotmap_admin, 'add_options_page');
		$this->loader->add_action( 'admin_init', $spotmap_admin, 'register_settings');

	}

	/**
	 * Register all of the hooks related to the public-facing functionality
	 * of the plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function define_public_hooks() {
		$spotmap_public = new Spotmap_Public( $this->get_plugin_name());
		$this->loader->add_action('init', $spotmap_public, 'register_shortcodes');
		$this->loader->add_action('wp_enqueue_styles', $spotmap_public, 'enqueue_styles');
		$this->loader->add_action('wp_enqueue_scripts', $spotmap_public, 'enqueue_scripts');
		$this->loader->add_action('wp_ajax_the_ajax_hook', $spotmap_public, 'the_action_function');
		$this->loader->add_action('wp_ajax_nopriv_the_ajax_hook', $spotmap_public, 'the_action_function');
		$this->loader->add_action('spotmap_cron_hook', $spotmap_public, 'get_feed_data');

	}
	/**
	 * Run the loader to execute all of the hooks with WordPress.
	 *
	 * @since    1.0.0
	 */
	public function run() {
		$this->loader->run();
	}

	public function get_plugin_name(){
		return $this->plugin_name;
	}

}