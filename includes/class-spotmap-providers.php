<?php

/**
 * Hardcoded registry of supported tracking device/service provider types.
 *
 * This is code, not data — new provider types require a code change here
 * plus a corresponding crawler implementation. Do not store provider type
 * definitions in wp_options.
 */
class Spotmap_Providers {

	/**
	 * Returns all registered provider type definitions.
	 *
	 * Each entry contains:
	 *   'label'  — human-readable name shown in the admin UI
	 *   'fields' — ordered list of field descriptors used to render the feed form:
	 *              'key'         string   option key stored in the feed entry
	 *              'type'        string   input type: text|password|url|number
	 *              'label'       string   field label
	 *              'required'    bool     whether the field must be non-empty
	 *              'description' string   optional help text
	 *
	 * @return array<string, array{label: string, fields: list<array<string, mixed>>}>
	 */
	public static function all() {
		static $providers = null;
		if ( $providers === null ) {
			$providers = [
				'findmespot' => [
					'label'  => 'SPOT Feed',
					'fields' => [
						[
							'key'         => 'name',
							'type'        => 'text',
							'label'       => 'Feed Name',
							'required'    => true,
							'description' => 'A unique name used to identify this feed in the map block.',
						],
						[
							'key'         => 'feed_id',
							'type'        => 'text',
							'label'       => 'Feed ID',
							'required'    => true,
							'description' => 'The SPOT XML Feed ID. See the <a href="https://www.findmespot.com/en-us/support/spot-x/get-help/general/spot-api-support">SPOT API support page</a> for details.',
						],
						[
							'key'         => 'password',
							'type'        => 'password',
							'label'       => 'Feed Password',
							'required'    => false,
							'description' => 'Leave empty if the feed is public.',
						],
					],
				],

				'osmand' => [
					'label'  => 'OsmAnd (Live Tracking)',
					'fields' => [
						[
							'key'         => 'name',
							'type'        => 'text',
							'label'       => 'Feed Name',
							'required'    => true,
							'description' => 'A unique name used to identify this feed in the map block.',
						],
					],
				],

				'teltonika' => [
					'label'  => 'Teltonika (Push)',
					'fields' => [
						[
							'key'         => 'name',
							'type'        => 'text',
							'label'       => 'Feed Name',
							'required'    => true,
							'description' => 'A unique name used to identify this feed in the map block.',
						],
					],
				],

				'media' => [
					'label'  => 'Photos',
					'fields' => [
						[
							'key'         => 'name',
							'type'        => 'text',
							'label'       => 'Feed Name',
							'required'    => true,
							'description' => 'A unique name used to identify this photo feed in the map block.',
						],
					],
				],

				// Future providers — add crawler implementation alongside each entry.
				// 'garmin' => [
				//     'label'  => 'Garmin inReach',
				//     'fields' => [ ... ],
				// ],
			];
		}
		return $providers;
	}

	/**
	 * Returns the definition for a single provider type, or null if unknown.
	 *
	 * @param string $type Provider type key, e.g. 'findmespot'.
	 * @return array<string, mixed>|null
	 */
	public static function get( $type ) {
		$all = self::all();
		return isset( $all[ $type ] ) ? $all[ $type ] : null;
	}

	/**
	 * Returns true if the given type key is registered.
	 *
	 * @param string $type
	 * @return bool
	 */
	public static function exists( $type ) {
		return self::get( $type ) !== null;
	}
}
