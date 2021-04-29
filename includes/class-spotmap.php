<?php

class Spotmap{

	protected $loader;

	public function __construct() {
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
		$this->loader->add_filter( 'plugin_action_links_spotmap/spotmap.php', $spotmap_admin, 'add_link_plugin_overview');
		$this->loader->add_action( 'admin_menu', $spotmap_admin, 'add_options_page');
		$this->loader->add_action( 'admin_init', $spotmap_admin, 'register_settings');
		$this->loader->add_action( 'spotmap_api_crawler_hook', $spotmap_admin, 'get_feed_data');
		$this->loader->add_action( 'spotmap_get_timezone_hook', $spotmap_admin, 'get_local_timezone');
		$this->loader->add_action( 'upload_mimes', $spotmap_admin, 'allow_gpx_upload');
	}

	/**
	 * Register all of the hooks related to the public-facing functionality
	 * of the plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function define_public_hooks() {
		$spotmap_public = new Spotmap_Public();
		$this->loader->add_action( 'init', $spotmap_public, 'register_shortcodes');
		$this->loader->add_action( 'wp_enqueue_styles', $spotmap_public, 'enqueue_styles');
		$this->loader->add_action( 'wp_enqueue_scripts', $spotmap_public, 'enqueue_scripts');
		$this->loader->add_action( 'enqueue_block_assets', $spotmap_public, 'enqueue_block_editor_assets');
		$this->loader->add_action( 'wp_ajax_get_positions', $spotmap_public, 'get_positions');
		$this->loader->add_action( 'wp_ajax_nopriv_get_positions', $spotmap_public, 'get_positions');
	}
	/**
	 * Run the loader to execute all of the hooks with WordPress.
	 *
	 * @since    1.0.0
	 */
	public function run() {
		$this->loader->run();
	}

}
