<?php

class Spotmap_Options {

	const OPTION_API_PROVIDERS = 'spotmap_api_providers';
	const OPTION_CUSTOM_MESSAGES = 'spotmap_custom_messages';
	const OPTION_MARKER = 'spotmap_marker';
	const OPTION_DEFAULT_VALUES = 'spotmap_default_values';
	const OPTION_API_TOKENS = 'spotmap_api_tokens';

	private static $cache = [];

	/**
	 * Returns default marker settings keyed by Spot message type.
	 *
	 * @return array<string, array<string, string>>
	 */
	public static function get_marker_defaults() {
		return [
			'HELP' => [
				'iconShape' => 'marker',
				'icon' => 'life-ring',
				'customMessage' => '',
			],
			'HELP-CANCEL' => [
				'iconShape' => 'marker',
				'icon' => 'check-double',
				'customMessage' => '',
			],
			'CUSTOM' => [
				'iconShape' => 'marker',
				'icon' => 'comment-dots',
				'customMessage' => '',
			],
			'OK' => [
				'iconShape' => 'marker',
				'icon' => 'thumbs-up',
				'customMessage' => '',
			],
			'STATUS' => [
				'iconShape' => 'circle',
				'icon' => 'check-circle',
				'customMessage' => '',
			],
			'UNLIMITED-TRACK' => [
				'iconShape' => 'circle-dot',
				'icon' => 'user',
				'customMessage' => '',
			],
			'NEWMOVEMENT' => [
				'iconShape' => 'circle',
				'icon' => 'play-circle',
				'customMessage' => '',
			],
			'STOP' => [
				'iconShape' => 'circle',
				'icon' => 'stop-circle',
				'customMessage' => '',
			],
			'MEDIA' => [
				'iconShape' => 'marker',
				'icon' => 'camera-retro',
				'customMessage' => '',
			],
		];
	}

	/**
	 * Returns default shortcode/settings values for the plugin.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_settings_defaults() {
		return [
			'maps' => 'openstreetmap,opentopomap',
			'height' => 500,
			'mapcenter' => 'all',
			'width' => 'normal',
			'color' => 'blue,red',
			'splitlines' => '12',
			'filter-points' => 5,
			'map-overlays' => null,
		];
	}

	/**
	 * Returns known API token keys with empty-string defaults.
	 *
	 * @return array<string, string>
	 */
	public static function get_api_token_defaults() {
		return [
			'timezonedb' => '',
			'mapbox' => '',
			'thunderforest' => '',
			'linz.govt.nz' => '',
			'geoservices.ign.fr' => '',
			'osdatahub.os.uk' => '',
		];
	}

	/**
	 * Returns registered API providers.
	 *
	 * @return array<string, string>
	 */
	public static function get_api_providers() {
		return self::get_array_option(self::OPTION_API_PROVIDERS, ['findmespot' => 'Spot Feed']);
	}

	/**
	 * Builds a provider option name for a specific field.
	 *
	 * @param string $provider Provider key, e.g. "findmespot".
	 * @param string $field Option suffix, e.g. "id".
	 * @return string
	 */
	public static function get_provider_option_name($provider, $field) {
		return 'spotmap_' . $provider . '_' . $field;
	}

	/**
	 * Returns a provider option field as an array.
	 *
	 * @param string $provider
	 * @param string $field
	 * @return array<int|string, mixed>
	 */
	public static function get_provider_field($provider, $field) {
		return self::get_array_option(self::get_provider_option_name($provider, $field), []);
	}

	/**
	 * Returns a single provider field value by index.
	 *
	 * @param string $provider
	 * @param string $field
	 * @param int|string $index
	 * @param mixed $fallback
	 * @return mixed
	 */
	public static function get_provider_field_value($provider, $field, $index, $fallback = '') {
		$values = self::get_provider_field($provider, $field);
		return isset($values[$index]) ? $values[$index] : $fallback;
	}

	/**
	 * Returns normalized marker options merged with defaults.
	 *
	 * @return array<string, array<string, string>>
	 */
	public static function get_marker_options() {
		$defaults = self::get_marker_defaults();
		$current = self::get_array_option(self::OPTION_MARKER, []);
		$normalized = [];
		foreach ($defaults as $type => $type_defaults) {
			$type_current = isset($current[$type]) && is_array($current[$type]) ? $current[$type] : [];
			$normalized[$type] = array_merge($type_defaults, $type_current);
		}
		return $normalized;
	}

	/**
	 * Returns one marker setting for a specific message type.
	 *
	 * @param string $type Message type key.
	 * @param string $key Marker setting key.
	 * @param mixed $fallback
	 * @return mixed
	 */
	public static function get_marker_setting($type, $key, $fallback = '') {
		$marker = self::get_marker_options();
		if (!isset($marker[$type]) || !is_array($marker[$type])) {
			return $fallback;
		}
		return isset($marker[$type][$key]) ? $marker[$type][$key] : $fallback;
	}

	/**
	 * Returns effective settings by merging stored values with defaults.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_settings() {
		$defaults = self::get_settings_defaults();
		$current = self::get_array_option(self::OPTION_DEFAULT_VALUES, []);
		return array_merge($defaults, $current);
	}

	/**
	 * Returns a single effective settings value.
	 *
	 * @param string $key
	 * @param mixed $fallback
	 * @return mixed
	 */
	public static function get_setting($key, $fallback = null) {
		$defaults = self::get_settings();
		if (array_key_exists($key, $defaults)) {
			return $defaults[$key];
		}
		return $fallback;
	}

	/**
	 * Returns effective API tokens merged with known token defaults.
	 *
	 * @return array<string, string>
	 */
	public static function get_api_tokens() {
		$defaults = self::get_api_token_defaults();
		$current = self::get_array_option(self::OPTION_API_TOKENS, []);
		return array_merge($defaults, $current);
	}

	/**
	 * Returns one API token by provider key.
	 *
	 * @param string $provider
	 * @param string $fallback
	 * @return string
	 */
	public static function get_api_token($provider, $fallback = '') {
		$tokens = self::get_api_tokens();
		return isset($tokens[$provider]) ? $tokens[$provider] : $fallback;
	}

	/**
	 * Returns custom message overrides by message type.
	 *
	 * @return array<string, string>
	 */
	public static function get_custom_messages() {
		return self::get_array_option(self::OPTION_CUSTOM_MESSAGES, []);
	}

	/**
	 * Returns a custom message override for one message type.
	 *
	 * @param string $type
	 * @param mixed $fallback
	 * @return mixed
	 */
	public static function get_custom_message($type, $fallback = null) {
		$messages = self::get_custom_messages();
		if (!isset($messages[$type]) || $messages[$type] === '') {
			return $fallback;
		}
		return $messages[$type];
	}

	/**
	 * Ensures required plugin options exist with baseline defaults.
	 *
	 * @return void
	 */
	public static function ensure_defaults() {
		if (!get_option(self::OPTION_API_PROVIDERS)) {
			add_option(self::OPTION_API_PROVIDERS, ['findmespot' => 'Spot Feed']);
		}
		if (!get_option(self::OPTION_CUSTOM_MESSAGES)) {
			add_option(self::OPTION_CUSTOM_MESSAGES, []);
		}

		self::upsert_array_option(self::OPTION_MARKER, self::get_marker_defaults());
		self::upsert_array_option(self::OPTION_DEFAULT_VALUES, self::get_settings_defaults());
	}

	/**
	 * Returns all dynamic provider option names used by this plugin.
	 *
	 * @return array<int, string>
	 */
	public static function get_dynamic_provider_option_names() {
		$keys = [];
		foreach (self::get_api_providers() as $provider => $label) {
			$keys[] = self::get_provider_option_name($provider, 'name');
			$keys[] = self::get_provider_option_name($provider, 'id');
			$keys[] = self::get_provider_option_name($provider, 'password');
		}
		return $keys;
	}

	/**
	 * Returns an option as array and caches it for the current request.
	 *
	 * @param string $option_name
	 * @param array<int|string, mixed> $fallback
	 * @return array<int|string, mixed>
	 */
	private static function get_array_option($option_name, $fallback = []) {
		if (array_key_exists($option_name, self::$cache)) {
			return self::$cache[$option_name];
		}
		$value = get_option($option_name, $fallback);
		if (!is_array($value)) {
			$value = $fallback;
		}
		self::$cache[$option_name] = $value;
		return $value;
	}

	/**
	 * Creates or updates an array option so defaults are always present.
	 *
	 * @param string $option_name
	 * @param array<int|string, mixed> $defaults
	 * @return void
	 */
	private static function upsert_array_option($option_name, $defaults) {
		$current = get_option($option_name);
		if (!is_array($current)) {
			if (false === $current) {
				add_option($option_name, $defaults);
			} else {
				update_option($option_name, $defaults);
			}
			self::$cache[$option_name] = $defaults;
			return;
		}

		$merged = array_merge($defaults, $current);
		if ($merged !== $current) {
			update_option($option_name, $merged);
		}
		self::$cache[$option_name] = $merged;
	}
}
