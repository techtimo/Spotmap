<?php

class Spotmap{

	protected $loader;
	protected $admin;

	public function __construct() {
		$this->load_dependencies();
		$this->register_migrator();
		$this->register_rest_api();
		$this->define_admin_hooks();
		$this->define_public_hooks();
	}

	private function register_migrator() {
		add_action( 'plugins_loaded', [ 'Spotmap_Migrator', 'run' ] );
	}

	private function register_rest_api() {
		add_action( 'rest_api_init', [ 'Spotmap_Rest_Api', 'register_routes' ] );
		add_action( 'rest_api_init', [ 'Spotmap_Ingest', 'register_routes' ] );
	}

	private function load_dependencies() {
		/**
		 * The class responsible for orchestrating the actions and filters of the
		 * core plugin.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-loader.php';

		/**
		 * Centralized options access layer.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-options.php';

		/**
		 * Hardcoded registry of supported tracking device/service provider types.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-providers.php';

		/**
		 * Handles data migrations between plugin versions.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-migrator.php';

		/**
		 * REST API endpoints for the admin UI.
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-rest-api.php';

		/**
		 * Public ingestion endpoints for push-based providers (e.g. OsmAnd).
		 */
		require_once plugin_dir_path( dirname( __FILE__ ) ) . 'includes/class-spotmap-ingest.php';

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
		$this->admin = new Spotmap_Admin();
		$this->loader->add_action( 'admin_enqueue_scripts', $this->admin, 'enqueue_scripts');
		$this->loader->add_filter( 'cron_schedules', $this->admin, 'add_cron_schedule');
		$this->loader->add_filter( 'plugin_action_links_spotmap/spotmap.php', $this->admin, 'add_link_plugin_overview');
		$this->loader->add_action( 'admin_menu', $this->admin, 'add_options_page');
		$this->loader->add_action( 'admin_init', $this->admin, 'ensure_cron_scheduled');
		$this->loader->add_action( 'spotmap_api_crawler_hook', $this->admin, 'get_feed_data');
		$this->loader->add_action( 'spotmap_import_media_hook', $this->admin, 'import_existing_media');
		$this->loader->add_action( 'spotmap_get_timezone_hook', $this->admin, 'get_local_timezone');
		$this->loader->add_action( 'upload_mimes', $this->admin, 'allow_gpx_upload');
		$this->loader->add_action( 'add_attachment', $this->admin, 'add_images_to_map');
		$this->loader->add_action( 'delete_attachment', $this->admin, 'delete_images_from_map');
	}

	/**
	 * Register all of the hooks related to the public-facing functionality
	 * of the plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function define_public_hooks() {
		$spotmap_public = new Spotmap_Public( $this->admin );
		$this->loader->add_action( 'init', $spotmap_public, 'register_shortcodes');
		$this->loader->add_action( 'init', $spotmap_public, 'register_block');
		$this->loader->add_action( 'wp_enqueue_scripts', $spotmap_public, 'enqueue_styles');
		$this->loader->add_action( 'wp_enqueue_scripts', $spotmap_public, 'enqueue_scripts');
		$this->loader->add_action( 'enqueue_block_editor_assets', $spotmap_public, 'enqueue_block_editor_assets');
		$this->loader->add_action( 'wp_ajax_spotmap_get_positions', $spotmap_public, 'get_positions');
		$this->loader->add_action( 'wp_ajax_nopriv_spotmap_get_positions', $spotmap_public, 'get_positions');
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
