<?php
/**
 * Autoloader
 *
 * This file provides the autoloader for the Theme.
 *
 * @package DarkMatter_Package
 **/

namespace DarkMatter_Theme\Helpers;

spl_autoload_register(
	function ( $what ) {
		$split = explode( '\\', $what );
		if ( 'DarkMatter_Theme' !== $split[0] ) {
			return;
		}
		$base_dir = 'include/';

		if ( isset( $split[1] ) && 'Traits' === $split[1] ) {
			$base_dir .= 'traits/trait-';
			$split[1]  = '';
		} else {
			$base_dir .= 'classes/class-';
		}

		$split[ count( $split ) - 1 ] = str_replace(
			'_',
			'-',
			strtolower( $split[ count( $split ) - 1 ] ) . '.php'
		);

		$split[0] = $base_dir;

		$file_path = implode( '', $split );

		if ( file_exists( DM_THEME_PATH . $file_path ) ) {
			include_once DM_THEME_PATH . $file_path;
		}
	}
);
