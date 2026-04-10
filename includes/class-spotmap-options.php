<?php

/**
 * Pure data-access layer for all Spotmap plugin options.
 *
 * Rules:
 *  - No migration logic here. Schema changes belong in class-spotmap-migrator.php.
 *  - No defaults are silently merged into stored values at runtime.
 *    Defaults are only written once on fresh install via seed_defaults().
 *  - All get_option() / update_option() calls go through this class.
 */
class Spotmap_Options
{
    public const OPTION_FEEDS          = 'spotmap_feeds';
    public const OPTION_MARKER         = 'spotmap_marker';
    public const OPTION_DEFAULT_VALUES  = 'spotmap_default_values';
    public const OPTION_API_TOKENS      = 'spotmap_api_tokens';
    public const OPTION_VERSION         = 'spotmap_version';

    private static $cache = [];

    // -------------------------------------------------------------------------
    // Defaults (authoritative definitions — used by seed_defaults and migrator)
    // -------------------------------------------------------------------------

    /**
     * Returns default marker settings keyed by Spot message type.
     *
     * @return array<string, array<string, string>>
     */
    public static function get_marker_defaults()
    {
        return [
            'HELP' => [
                'iconShape' => 'marker',
                'icon'      => 'life-ring',
            ],
            'HELP-CANCEL' => [
                'iconShape' => 'marker',
                'icon'      => 'check-double',
            ],
            'CUSTOM' => [
                'iconShape' => 'marker',
                'icon'      => 'comment-dots',
            ],
            'OK' => [
                'iconShape' => 'marker',
                'icon'      => 'thumbs-up',
            ],
            'STATUS' => [
                'iconShape' => 'circle',
                'icon'      => 'check-circle',
            ],
            'TRACK' => [
                'iconShape' => 'circle-dot',
                'icon'      => 'user',
            ],
            'NEWMOVEMENT' => [
                'iconShape' => 'circle',
                'icon'      => 'play-circle',
            ],
            'STOP' => [
                'iconShape' => 'circle',
                'icon'      => 'stop-circle',
            ],
            'MEDIA' => [
                'iconShape' => 'marker',
                'icon'      => 'camera-retro',
            ],
        ];
    }

    /**
     * Returns default shortcode/block attribute values.
     *
     * @return array<string, mixed>
     */
    public static function get_settings_defaults()
    {
        return [
            'maps'               => 'openstreetmap,opentopomap',
            'height'             => 500,
            'mapcenter'          => 'all',
            'width'              => 'normal',
            'color'              => 'blue,red',
            'splitlines'         => '12',
            'filter-points'      => 5,
            'map-overlays'       => null,
            'import-min-distance' => 25,
            'import-min-time'    => 600,
        ];
    }

    /**
     * Returns known API token keys with empty-string defaults.
     *
     * @return array<string, string>
     */
    public static function get_api_token_defaults()
    {
        return [
            'timezonedb'          => '',
            'mapbox'              => '',
            'thunderforest'       => '',
            'linz.govt.nz'        => '',
            'geoservices.ign.fr'  => '',
            'osdatahub.os.uk'     => '',
        ];
    }

    // -------------------------------------------------------------------------
    // Fresh-install seeding (called by activator only, never on updates)
    // -------------------------------------------------------------------------

    /**
     * Writes baseline option values for a brand-new installation.
     * Uses add_option() so existing values are never overwritten.
     * Schema changes on update are handled by Spotmap_Migrator, not here.
     *
     * @return void
     */
    public static function seed_defaults()
    {
        add_option(self::OPTION_FEEDS, []);
        add_option(self::OPTION_MARKER, self::get_marker_defaults());
        add_option(self::OPTION_DEFAULT_VALUES, self::get_settings_defaults());
        add_option(self::OPTION_API_TOKENS, self::get_api_token_defaults());
    }

    // -------------------------------------------------------------------------
    // Feeds CRUD
    // -------------------------------------------------------------------------

    /**
     * Returns all configured feeds.
     *
     * Each feed is an associative array containing at minimum:
     *   'id'   — unique string identifier (generated on creation)
     *   'type' — provider type key, e.g. 'findmespot'
     *   'name' — display name
     * Plus provider-specific fields (e.g. 'feed_id', 'password').
     *
     * @return list<array<string, mixed>>
     */
    public static function get_feeds()
    {
        return self::get_array_option(self::OPTION_FEEDS, []);
    }

    /**
     * Returns a single feed by its id, or null if not found.
     *
     * @param string $id
     * @return array<string, mixed>|null
     */
    public static function get_feed($id)
    {
        foreach (self::get_feeds() as $feed) {
            if (isset($feed['id']) && $feed['id'] === $id) {
                return $feed;
            }
        }
        return null;
    }

    /**
     * Persists the full feeds array.
     *
     * @param list<array<string, mixed>> $feeds
     * @return void
     */
    public static function save_feeds(array $feeds)
    {
        self::$cache[ self::OPTION_FEEDS ] = $feeds;
        update_option(self::OPTION_FEEDS, $feeds);
    }

    /**
     * Appends a new feed and returns it with its generated id.
     *
     * @param array<string, mixed> $feed Feed data without 'id'.
     * @return array<string, mixed> The feed with 'id' set.
     */
    public static function add_feed(array $feed)
    {
        $feed['id']         = uniqid('feed_', true);
        $feed['created_at'] = time();
        $feed['updated_at'] = time();
        $feeds              = self::get_feeds();
        $feeds[]            = $feed;
        self::save_feeds($feeds);
        return $feed;
    }

    /**
     * Replaces the feed with the given id and returns true, or false if not found.
     *
     * @param string               $id
     * @param array<string, mixed> $data New feed data (id is preserved from $id).
     * @return bool
     */
    public static function update_feed($id, array $data)
    {
        $feeds = self::get_feeds();
        $found = false;
        foreach ($feeds as &$feed) {
            if (isset($feed['id']) && $feed['id'] === $id) {
                $data['id']         = $id;
                $data['created_at'] = $feed['created_at'] ?? null;
                $data['updated_at'] = time();
                $feed               = $data;
                $found              = true;
                break;
            }
        }
        unset($feed);
        if ($found) {
            self::save_feeds($feeds);
        }
        return $found;
    }

    /**
     * Sets the paused flag on a feed and returns true, or false if not found.
     *
     * @param string $id
     * @param bool   $paused
     * @return bool
     */
    public static function set_feed_paused(string $id, bool $paused): bool
    {
        $feed = self::get_feed($id);
        if (! $feed) {
            return false;
        }
        $feed['paused'] = $paused;
        return self::update_feed($id, $feed);
    }

    /**
     * Removes the feed with the given id and returns true, or false if not found.
     *
     * @param string $id
     * @return bool
     */
    public static function delete_feed($id)
    {
        $feeds    = self::get_feeds();
        $filtered = array_values(
            array_filter($feeds, function ($f) use ($id) {
                return ! isset($f['id']) || $f['id'] !== $id;
            })
        );
        if (count($filtered) === count($feeds)) {
            return false;
        }
        self::save_feeds($filtered);
        return true;
    }

    // -------------------------------------------------------------------------
    // Markers
    // -------------------------------------------------------------------------

    /**
     * Returns normalized marker options merged with defaults.
     *
     * @return array<string, array<string, string>>
     */
    public static function get_marker_options()
    {
        $defaults = self::get_marker_defaults();
        $current  = self::get_array_option(self::OPTION_MARKER, []);
        $result   = [];
        foreach ($defaults as $type => $type_defaults) {
            $type_current    = isset($current[ $type ]) && is_array($current[ $type ]) ? $current[ $type ] : [];
            $result[ $type ] = array_merge($type_defaults, $type_current);
        }
        return $result;
    }

    /**
     * Returns one marker setting for a specific message type.
     *
     * @param string $type Message type key.
     * @param string $key  Marker setting key.
     * @param mixed  $fallback
     * @return mixed
     */
    public static function get_marker_setting($type, $key, $fallback = '')
    {
        $markers = self::get_marker_options();
        if (! isset($markers[ $type ]) || ! is_array($markers[ $type ])) {
            return $fallback;
        }
        return isset($markers[ $type ][ $key ]) ? $markers[ $type ][ $key ] : $fallback;
    }

    /**
     * Persists marker options.
     *
     * @param array<string, array<string, string>> $markers
     * @return void
     */
    public static function save_marker_options(array $markers)
    {
        self::$cache[ self::OPTION_MARKER ] = $markers;
        update_option(self::OPTION_MARKER, $markers);
    }

    // -------------------------------------------------------------------------
    // Default values (shortcode / block attributes)
    // -------------------------------------------------------------------------

    /**
     * Returns effective settings merged with defaults.
     *
     * @return array<string, mixed>
     */
    public static function get_settings()
    {
        $defaults = self::get_settings_defaults();
        $current  = self::get_array_option(self::OPTION_DEFAULT_VALUES, []);
        return array_merge($defaults, $current);
    }

    /**
     * Returns a single effective settings value.
     *
     * @param string $key
     * @param mixed  $fallback
     * @return mixed
     */
    public static function get_setting($key, $fallback = null)
    {
        $settings = self::get_settings();
        return array_key_exists($key, $settings) ? $settings[ $key ] : $fallback;
    }

    /**
     * Persists default values.
     *
     * @param array<string, mixed> $values
     * @return void
     */
    public static function save_settings(array $values)
    {
        self::$cache[ self::OPTION_DEFAULT_VALUES ] = $values;
        update_option(self::OPTION_DEFAULT_VALUES, $values);
    }

    // -------------------------------------------------------------------------
    // API tokens
    // -------------------------------------------------------------------------

    /**
     * Returns effective API tokens merged with known token defaults.
     *
     * @return array<string, string>
     */
    public static function get_api_tokens()
    {
        $defaults = self::get_api_token_defaults();
        $current  = self::get_array_option(self::OPTION_API_TOKENS, []);
        return array_merge($defaults, $current);
    }

    /**
     * Returns one API token by provider key.
     *
     * @param string $provider
     * @param string $fallback
     * @return string
     */
    public static function get_api_token($provider, $fallback = '')
    {
        $tokens = self::get_api_tokens();
        return isset($tokens[ $provider ]) ? $tokens[ $provider ] : $fallback;
    }

    /**
     * Persists API tokens.
     *
     * @param array<string, string> $tokens
     * @return void
     */
    public static function save_api_tokens(array $tokens)
    {
        self::$cache[ self::OPTION_API_TOKENS ] = $tokens;
        update_option(self::OPTION_API_TOKENS, $tokens);
    }

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Returns an option as an array, with request-level caching.
     *
     * @param string                   $option_name
     * @param array<int|string, mixed> $fallback
     * @return array<int|string, mixed>
     */
    private static function get_array_option($option_name, $fallback = [])
    {
        if (array_key_exists($option_name, self::$cache)) {
            return self::$cache[ $option_name ];
        }
        $value = get_option($option_name, $fallback);
        if (! is_array($value)) {
            $value = $fallback;
        }
        self::$cache[ $option_name ] = $value;
        return $value;
    }
}
