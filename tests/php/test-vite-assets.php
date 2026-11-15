<?php
/**
 * Focused CLI tests for the theme Vite asset resolver and enqueue behavior.
 *
 * @package DarkMatter_Package
 */

// phpcs:ignoreFile -- This standalone CLI test deliberately stubs WordPress and manipulates local temporary files.

function wp_json_file_decode( $path, $options = array() ) {
	$contents = file_get_contents( $path );
	return json_decode( $contents, ! empty( $options['associative'] ) );
}

function wp_parse_url( $url ) {
	return parse_url( $url );
}

function wp_json_encode( $data ) {
	return json_encode( $data );
}

function add_action( ...$args ) {}
function add_filter( ...$args ) {}
function wp_enqueue_script( ...$args ) {
	$GLOBALS['theme_vite_enqueues'][] = array( 'script', $args );
}
function wp_enqueue_style( ...$args ) {
	$GLOBALS['theme_vite_enqueues'][] = array( 'style', $args );
}
function _doing_it_wrong( ...$args ) {}
function esc_html( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
}
function get_theme_file_path( $file = '' ) {
	return rtrim( $GLOBALS['theme_vite_root'], '/' ) . ( '' === $file ? '' : '/' . $file );
}
function get_theme_file_uri( $file = '' ) {
	return 'https://theme.test/wp-content/themes/example/' . ltrim( $file, '/' );
}

require_once __DIR__ . '/../../include/helpers/vite-assets.php';
require_once __DIR__ . '/../../include/traits/trait-singleton.php';
require_once __DIR__ . '/../../include/classes/class-assets.php';

function theme_vite_assert( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function theme_vite_remove_directory( $directory ) {
	foreach ( scandir( $directory ) as $item ) {
		if ( '.' === $item || '..' === $item ) {
			continue;
		}

		$path = $directory . DIRECTORY_SEPARATOR . $item;
		is_dir( $path ) ? theme_vite_remove_directory( $path ) : unlink( $path );
	}
	rmdir( $directory );
}

$root = sys_get_temp_dir() . '/theme-vite-' . uniqid( '', true );
mkdir( $root . '/assets/build/.vite', 0777, true );

try {
	$hot_file = $root . '/assets/build/hot';
	$resolver = new DarkMatter_Theme\Helpers\Vite_Assets(
		$root,
		'https://theme.test/wp-content/themes/example/',
		$root . '/assets/build/.vite/manifest.json',
		$hot_file
	);

	file_put_contents( $hot_file, 'http://localhost:5173' );
	theme_vite_assert(
		'http://localhost:5173' === $resolver->get_dev_server_origin(),
		'Fresh HTTP dev origin should be accepted.'
	);

	foreach ( array( '', 'javascript:alert(1)', 'https://localhost:5173/path', 'https://user@localhost:5173', 'https://localhost:5173?debug=1', 'https://localhost:5173#fragment' ) as $invalid_origin ) {
		file_put_contents( $hot_file, $invalid_origin );
		theme_vite_assert(
			null === $resolver->get_dev_server_origin(),
			'Invalid dev origin should be rejected: ' . $invalid_origin
		);
	}

	file_put_contents( $hot_file, 'http://localhost:5173' );
	touch( $hot_file, time() - 16 );
	theme_vite_assert( null === $resolver->get_dev_server_origin(), 'Stale marker should be rejected.' );

	file_put_contents( $hot_file, 'http://localhost:5173' );
	touch( $hot_file, time() + 16 );
	theme_vite_assert( null === $resolver->get_dev_server_origin(), 'Future marker should be rejected.' );

	file_put_contents( $hot_file, 'http://localhost:5173' );
	$boundary_time = time() - 15;
	touch( $hot_file, $boundary_time );
	while ( time() - $boundary_time > 15 ) {
		$boundary_time = time() - 15;
		touch( $hot_file, $boundary_time );
	}
	theme_vite_assert( 'http://localhost:5173' === $resolver->get_dev_server_origin(), 'A marker exactly 15 seconds old should remain fresh.' );
	unlink( $hot_file );

	$manifest_path = $root . '/assets/build/.vite/manifest.json';
	file_put_contents(
		$manifest_path,
		wp_json_encode(
			array(
				'assets/src/js/main.js' => array(
					'file'                   => 'assets/main.js',
					'css'                    => array( 'assets/main.css' ),
					'wordpressDependencies' => array( 'wp-blocks' ),
				),
				'assets/src/css/main.css' => array(
					'file' => 'assets/main-style.css',
				),
			)
		)
	);

	$resolver = new DarkMatter_Theme\Helpers\Vite_Assets(
		$root,
		'https://theme.test/wp-content/themes/example/',
		$manifest_path,
		$hot_file
	);
	theme_vite_assert(
		array(
			'file'         => 'assets/main.js',
			'css'          => array( 'assets/main.css' ),
			'dependencies' => array( 'wp-blocks' ),
		) === $resolver->get_entry( 'assets/src/js/main.js' ),
		'JS manifest entry should include its emitted CSS.'
	);
	theme_vite_assert(
		array( 'file' => 'assets/main-style.css', 'css' => array(), 'dependencies' => array() ) === $resolver->get_entry( 'assets/src/css/main.css' ),
		'Standalone CSS manifest entry should be resolved.'
	);
	theme_vite_assert( null === $resolver->get_entry( 'assets/src/js/missing.js' ), 'Missing entry should return null.' );
	$missing_manifest = new DarkMatter_Theme\Helpers\Vite_Assets(
		$root,
		'https://theme.test/wp-content/themes/example/',
		$root . '/assets/build/.vite/missing.json',
		$hot_file
	);
	theme_vite_assert( null === $missing_manifest->get_entry( 'assets/src/js/main.js' ), 'Missing manifest should return null.' );

	file_put_contents( $manifest_path, '{invalid json' );
	$resolver = new DarkMatter_Theme\Helpers\Vite_Assets(
		$root,
		'https://theme.test/wp-content/themes/example/',
		$manifest_path,
		$hot_file
	);
	theme_vite_assert( null === $resolver->get_entry( 'assets/src/js/main.js' ), 'Invalid manifest should return null.' );

	file_put_contents(
		$manifest_path,
		wp_json_encode( array( 'assets/src/js/main.js' => array( 'file' => array( 'unexpected' ) ) ) )
	);
	$resolver = new DarkMatter_Theme\Helpers\Vite_Assets(
		$root,
		'https://theme.test/wp-content/themes/example/',
		$manifest_path,
		$hot_file
	);
	theme_vite_assert( null === $resolver->get_entry( 'assets/src/js/main.js' ), 'Malformed entry shape should return null.' );

	file_put_contents(
		$manifest_path,
		wp_json_encode( array( 'assets/src/js/main.js' => array( 'file' => 'assets/%2e%2e/private.js' ) ) )
	);
	$resolver = new DarkMatter_Theme\Helpers\Vite_Assets(
		$root,
		'https://theme.test/wp-content/themes/example/',
		$manifest_path,
		$hot_file
	);
	theme_vite_assert( null === $resolver->get_entry( 'assets/src/js/main.js' ), 'Traversal path should return null.' );

	$GLOBALS['theme_vite_root'] = $root;
	$GLOBALS['theme_vite_enqueues'] = array();
	foreach ( array( 'assets/main.js', 'assets/main.css' ) as $output ) {
		$target = $root . '/assets/build/' . $output;
		if ( ! is_dir( dirname( $target ) ) ) {
			mkdir( dirname( $target ), 0777, true );
		}
		file_put_contents( $target, 'asset' );
	}
	file_put_contents(
		$manifest_path,
		wp_json_encode(
			array(
				'assets/src/js/main.js' => array(
					'file'                   => 'assets/main.js',
					'css'                    => array( 'assets/main.css' ),
					'wordpressDependencies' => array( 'wp-blocks' ),
				),
				'assets/src/css/main.css' => array( 'file' => 'assets/main.css' ),
			)
		)
	);

	$enqueue_assets = new DarkMatter_Theme\Assets();
	$enqueue_assets->enqueue_entry( 'assets/src/js/main.js', 'main-js', array( 'wp-element' ), true );
	$enqueue_assets->enqueue_entry( 'assets/src/css/main.css', 'main-css', array(), false );
	theme_vite_assert( 3 === count( $GLOBALS['theme_vite_enqueues'] ), 'Production should enqueue JS, imported CSS, and standalone CSS.' );
	theme_vite_assert( array( 'wp-element', 'wp-blocks' ) === $GLOBALS['theme_vite_enqueues'][1][1][2], 'Production scripts must enqueue WordPress runtime dependencies from the manifest.' );
	theme_vite_assert(
		'https://theme.test/wp-content/themes/example/assets/build/assets/main.js' === $GLOBALS['theme_vite_enqueues'][1][1][1],
		'Production JavaScript must use the theme URL.'
	);
	theme_vite_assert(
		'https://theme.test/wp-content/themes/example/assets/build/assets/main.css' === $GLOBALS['theme_vite_enqueues'][0][1][1],
		'Production CSS must use the theme URL.'
	);
	theme_vite_assert( 'style' === $GLOBALS['theme_vite_enqueues'][0][0], 'Production CSS output must be enqueued as a stylesheet.' );
	theme_vite_assert(
		false === strpos( $GLOBALS['theme_vite_enqueues'][0][1][1], $root ),
		'Filesystem paths must never be passed to enqueue functions.'
	);
	theme_vite_assert(
		false !== strpos( $enqueue_assets->filter_vite_script_tag( '<script src="vite.js"></script>', 'main-js', 'vite.js' ), 'type="module"' ),
		'Vite script handles must be emitted as modules.'
	);
	theme_vite_assert(
		false === strpos( $enqueue_assets->filter_vite_script_tag( '<script src="other.js"></script>', 'other-js', 'other.js' ), 'type="module"' ),
		'Non-Vite scripts must not be changed.'
	);

	foreach ( array( 'assets/src/js/main.js', 'assets/src/js/helpers/helper.js', 'assets/src/css/main.css' ) as $source ) {
		$source_path = $root . '/' . $source;
		if ( ! is_dir( dirname( $source_path ) ) ) {
			mkdir( dirname( $source_path ), 0777, true );
		}
		$source_contents = 'assets/src/js/main.js' === $source
			? "import './helpers/helper.js';\nimport { registerBlockType } from '@wordpress/blocks';"
			: ( 'assets/src/js/helpers/helper.js' === $source ? "import { useSelect } from '@wordpress/data';" : '' );
		file_put_contents( $source_path, $source_contents );
	}
	file_put_contents( $hot_file, 'http://localhost:5173' );
	$GLOBALS['theme_vite_enqueues'] = array();
	$dev_assets = new DarkMatter_Theme\Assets();
	$dev_assets->enqueue_assets();
	$dev_assets->enqueue_block_assets();
	theme_vite_assert( 3 === count( $GLOBALS['theme_vite_enqueues'] ), 'Development should enqueue the Vite client once and both source modules.' );
	theme_vite_assert( 'vite-client' === $GLOBALS['theme_vite_enqueues'][0][1][0], 'Development should enqueue the Vite client first.' );
	theme_vite_assert( 'script' === $GLOBALS['theme_vite_enqueues'][1][0], 'Vite CSS entries must be served as module scripts during development.' );
	theme_vite_assert( 'http://localhost:5173/assets/src/css/main.css' === $GLOBALS['theme_vite_enqueues'][1][1][1], 'Development CSS source should use the Vite origin.' );
	theme_vite_assert(
		false !== strpos( $dev_assets->filter_vite_script_tag( '<script src="main.css"></script>', 'main-css', 'main.css' ), 'type="module"' ),
		'Vite CSS source modules need module tags for HMR style injection.'
	);
	theme_vite_assert( 'http://localhost:5173/assets/src/js/main.js' === $GLOBALS['theme_vite_enqueues'][2][1][1], 'Development JS source should use the Vite origin.' );
	theme_vite_assert( array( 'wp-blocks', 'wp-data' ) === $GLOBALS['theme_vite_enqueues'][2][1][2], 'Development scripts must enqueue direct and transitive WordPress runtime dependencies.' );
	unlink( $root . '/assets/src/js/main.js' );
	unlink( $root . '/assets/src/js/helpers/helper.js' );
	unlink( $root . '/assets/src/css/main.css' );
	$GLOBALS['theme_vite_enqueues'] = array();
	$missing_source_assets = new DarkMatter_Theme\Assets();
	$missing_source_assets->enqueue_assets();
	$missing_source_assets->enqueue_block_assets();
	theme_vite_assert( array() === $GLOBALS['theme_vite_enqueues'], 'Existing enqueue hooks must skip all missing development source mappings.' );

	unlink( $hot_file );
	unlink( $root . '/assets/build/assets/main.js' );
	$GLOBALS['theme_vite_enqueues'] = array();
	$missing_assets = new DarkMatter_Theme\Assets();
	$missing_assets->enqueue_entry( 'assets/src/js/main.js', 'main-js', array(), true );
	theme_vite_assert( array() === $GLOBALS['theme_vite_enqueues'], 'Missing production output must not enqueue any asset.' );
} finally {
	theme_vite_remove_directory( $root );
}

// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_var_dump -- CLI test confirmation.
fwrite( STDOUT, "Vite resolver tests passed.\n" );
