<?php
/**
 * Main theme asset class.
 *
 * @package DarkMatter_Package
 */

namespace DarkMatter_Theme;

use DarkMatter_Theme\Helpers\Vite_Assets;
use DarkMatter_Theme\Traits\Singleton;

require_once __DIR__ . '/../helpers/vite-assets.php';

/**
 * Enqueues theme styles and scripts from Vite.
 */
class Assets {

	/**
	 * Stable WordPress stylesheet handles for JavaScript entries.
	 *
	 * @var array
	 */
	private const STYLE_HANDLES = array(
		'main-js' => 'main-css',
	);

	use Singleton;

	/**
	 * Vite asset resolver.
	 *
	 * @var Vite_Assets|null
	 */
	private $vite_assets;

	/**
	 * Whether the Vite client has been enqueued during this request.
	 *
	 * @var bool
	 */
	private $vite_client_enqueued = false;

	/**
	 * Handles that should be emitted as ES modules.
	 *
	 * @var array
	 */
	private $vite_module_handles = array();

	/**
	 * Whether the module tag filter is registered.
	 *
	 * @var bool
	 */
	private $script_tag_filter_registered = false;

	/**
	 * Register existing theme enqueue hooks.
	 *
	 * @return void
	 */
	public function __construct() {
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_assets' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_block_assets' ) );
	}

	/**
	 * Enqueue the theme's main stylesheet and script.
	 *
	 * @return void
	 */
	public function enqueue_assets() {
		$this->enqueue_entry( 'assets/src/css/main.css', 'main-css', array(), false );
		$this->enqueue_entry( 'assets/src/js/main.js', 'main-js', array(), true );
	}

	/**
	 * Enqueue an editor stylesheet if the theme defines one.
	 *
	 * @return void
	 */
	public function enqueue_block_assets() {
		$this->enqueue_entry( 'assets/src/css/editor.scss', 'editor-css', array(), false );
	}

	/**
	 * Enqueue one source entry and its generated CSS.
	 *
	 * @param string $entry        Vite manifest key and source path.
	 * @param string $handle       WordPress handle.
	 * @param array  $dependencies Script dependencies.
	 * @param bool   $in_footer    Whether a script belongs in the footer.
	 * @return void
	 */
	public function enqueue_entry( string $entry, string $handle, array $dependencies, bool $in_footer ): void {
		$assets = $this->get_vite_assets();
		$origin = $assets->get_dev_server_origin();

		if ( null !== $origin ) {
			$this->enqueue_dev_entry( $assets, $origin, $entry, $handle, $dependencies, $in_footer );
			return;
		}

		$this->enqueue_production_entry( $assets, $entry, $handle, $dependencies, $in_footer );
	}

	/**
	 * Enqueue a source module from the Vite development server.
	 *
	 * @param Vite_Assets $assets       Asset resolver.
	 * @param string      $origin       Validated Vite server origin.
	 * @param string      $entry        Source path.
	 * @param string      $handle       WordPress handle.
	 * @param array       $dependencies Script dependencies.
	 * @param bool        $in_footer    Whether the script belongs in the footer.
	 * @return void
	 */
	private function enqueue_dev_entry( Vite_Assets $assets, string $origin, string $entry, string $handle, array $dependencies, bool $in_footer ): void {
		if ( ! is_file( $assets->get_theme_path() . $entry ) ) {
			$this->log_missing_entry( $entry );
			return;
		}
		$dependencies = array_values( array_unique( array_merge( $dependencies, $assets->get_source_dependencies( $entry ) ) ) );
		if ( ! $this->vite_client_enqueued ) {
			$this->register_module_handle( 'vite-client' );
			wp_enqueue_script( 'vite-client', $origin . '/@vite/client', array(), 'dev', true );
			$this->vite_client_enqueued = true;
		}

		$this->register_module_handle( $handle );
		wp_enqueue_script( $handle, $origin . '/' . ltrim( $entry, '/' ), $dependencies, 'dev', $in_footer );
	}

	/**
	 * Enqueue an entry from the production manifest.
	 *
	 * @param Vite_Assets $assets       Asset resolver.
	 * @param string      $entry        Manifest key.
	 * @param string      $handle       WordPress handle.
	 * @param array       $dependencies Script dependencies.
	 * @param bool        $in_footer    Whether the script belongs in the footer.
	 * @return void
	 */
	private function enqueue_production_entry( Vite_Assets $assets, string $entry, string $handle, array $dependencies, bool $in_footer ): void {
		$manifest_entry = $assets->get_entry( $entry );
		if ( null === $manifest_entry ) {
			$this->log_missing_entry( $entry );
			return;
		}

		$build_path = $assets->get_theme_path() . 'assets/build/';
		$asset_url  = $assets->get_theme_url() . 'assets/build/';

		if ( preg_match( '/\.css$/i', $manifest_entry['file'] ) ) {
			$this->enqueue_style_file( $handle, $manifest_entry['file'], $build_path, $asset_url );
			return;
		}
		$dependencies = array_values( array_unique( array_merge( $dependencies, $manifest_entry['dependencies'] ) ) );

		$script_path = $build_path . $manifest_entry['file'];
		if ( ! is_file( $script_path ) ) {
			$this->log_missing_entry( $entry );
			return;
		}

		foreach ( $manifest_entry['css'] as $index => $css_file ) {
			$style_handle = $this->get_style_handle( $handle, $index );
			$this->enqueue_style_file( $style_handle, $css_file, $build_path, $asset_url );
		}

		$this->register_module_handle( $handle );
		wp_enqueue_script(
			$handle,
			$asset_url . $manifest_entry['file'],
			$dependencies,
			(string) filemtime( $script_path ),
			$in_footer
		);
	}

	/**
	 * Enqueue a generated stylesheet when its file exists.
	 *
	 * @param string $handle     WordPress stylesheet handle.
	 * @param string $css_file   Relative CSS output path.
	 * @param string $build_path Build directory filesystem path.
	 * @param string $asset_url  Build directory public URL.
	 * @return void
	 */
	private function enqueue_style_file( string $handle, string $css_file, string $build_path, string $asset_url ): void {
		$css_path = $build_path . $css_file;
		if ( ! is_file( $css_path ) ) {
			$this->log_missing_entry( $css_file );
			return;
		}

		wp_enqueue_style( $handle, $asset_url . $css_file, array(), (string) filemtime( $css_path ) );
	}

	/**
	 * Register a Vite module script handle.
	 *
	 * @param string $handle Script handle.
	 * @return void
	 */
	private function register_module_handle( string $handle ): void {
		if ( ! in_array( $handle, $this->vite_module_handles, true ) ) {
			$this->vite_module_handles[] = $handle;
		}

		if ( ! $this->script_tag_filter_registered ) {
			add_filter( 'script_loader_tag', array( $this, 'filter_vite_script_tag' ), 10, 3 );
			$this->script_tag_filter_registered = true;
		}
	}

	/**
	 * Return a stable stylesheet handle for CSS emitted by a script entry.
	 *
	 * @param string $script_handle Script handle.
	 * @param int    $index         CSS file index.
	 * @return string
	 */
	private function get_style_handle( string $script_handle, int $index ): string {
		if ( isset( self::STYLE_HANDLES[ $script_handle ] ) ) {
			return 0 === $index ? self::STYLE_HANDLES[ $script_handle ] : self::STYLE_HANDLES[ $script_handle ] . '-' . $index;
		}

		return $script_handle . '-style-' . $index;
	}

	/**
	 * Add the ES module type to Vite handles only.
	 *
	 * @param string $tag    Script HTML.
	 * @param string $handle Script handle.
	 * @param string $src    Script URL.
	 * @return string
	 */
	public function filter_vite_script_tag( string $tag, string $handle, string $src ): string {
		unset( $src );
		if ( ! in_array( $handle, $this->vite_module_handles, true ) ) {
			return $tag;
		}

		if ( preg_match( '/\btype\s*=/', $tag ) ) {
			return preg_replace( '/\btype=(["\']).*?\1/', 'type="module"', $tag, 1 );
		}

		return preg_replace( '/<script\b/', '<script type="module"', $tag, 1 );
	}

	/**
	 * Get the resolver for the active theme.
	 *
	 * @return Vite_Assets
	 */
	private function get_vite_assets(): Vite_Assets {
		if ( null === $this->vite_assets ) {
			$theme_path        = get_theme_file_path();
			$theme_url         = get_theme_file_uri();
			$this->vite_assets = new Vite_Assets(
				$theme_path,
				$theme_url,
				get_theme_file_path( 'assets/build/.vite/manifest.json' ),
				get_theme_file_path( 'assets/build/hot' )
			);
		}

		return $this->vite_assets;
	}

	/**
	 * Emit a developer notice when a requested entry cannot be loaded.
	 *
	 * @param string $entry Entry or output path that is missing.
	 * @return void
	 */
	private function log_missing_entry( string $entry ): void {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			_doing_it_wrong(
				__METHOD__,
				sprintf( 'Vite asset "%s" is unavailable. Run pnpm build.', esc_html( $entry ) ),
				'1.0.0'
			);
		}
	}
}
