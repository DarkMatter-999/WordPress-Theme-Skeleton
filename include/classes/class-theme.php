<?php
/**
 * Main Theme File
 *
 * Main Theme class file for theme. This class registers the necessary theme supports for the theme.
 *
 * @package DarkMatter_Package
 **/

namespace DarkMatter_Theme;

use DarkMatter_Theme\Traits\Singleton;

/**
 * Main Theme File
 *
 * Main Theme class file for DarkMatter theme. This class registers the necessary theme supports for the theme.
 *
 * @since 1.0.0
 **/
class Theme {

	use Singleton;

	/**
	 * Constructor for DarkMatter Theme
	 *
	 * @return void
	 */
	public function __construct() {
		add_action( 'after_setup_theme', array( $this, 'setup' ) );
		add_filter( 'mime_types', array( $this, 'svg_upload_support' ) );

		Assets::get_instance();
	}

	/**
	 * Sets up theme defaults and registers support for various WordPress features.
	 *
	 * @return void
	 */
	public function setup() {
	}

	/**
	 * Add support for uploading SVG files
	 *
	 * @param array $types Mime Types array.
	 * @return array
	 */
	public function svg_upload_support( $types ) {
		$types['svg'] = 'image/svg+xml';

		return $types;
	}
}
