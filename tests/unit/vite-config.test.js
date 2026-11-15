import { afterEach, describe, expect, it } from 'vitest';
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import {
	createWordPressExternalPlugins,
	discoverEntries,
	discoverWordPressDependencies,
	discoverWordPressGlobals,
} from '../../vite.config.mjs';
import { buildTheme } from '../../bin/vite-build.js';

describe( 'discoverEntries', () => {
	let root;
	afterEach( () => {
		if ( root ) {
			rmSync( root, { recursive: true, force: true } );
			root = undefined;
		}
	} );

	it( 'includes only present JS and independent CSS entries', () => {
		root = mkdtempSync( path.join( tmpdir(), 'theme-vite-' ) );
		for ( const file of [
			'js/main.js',
			'js/admin.tsx',
			'css/main.css',
			'css/editor.scss',
		] ) {
			const target = path.join( root, 'assets/src', file );
			mkdirSync( path.dirname( target ), { recursive: true } );
			writeFileSync( target, '' );
		}

		const entries = discoverEntries( root );

		expect( Object.keys( entries ) ).toEqual( [
			'assets/src/css/editor.scss',
			'assets/src/css/main.css',
			'assets/src/js/admin.tsx',
			'assets/src/js/main.js',
		] );
		expect( entries ).not.toHaveProperty( 'assets/src/js/editor.js' );
	} );

	it( 'returns no entries when source directories do not exist', () => {
		root = mkdtempSync( path.join( tmpdir(), 'theme-vite-empty-' ) );

		expect( discoverEntries( root ) ).toEqual( {} );
	} );

	it( 'maps imported WordPress packages to WordPress runtime globals', () => {
		root = mkdtempSync( path.join( tmpdir(), 'theme-vite-wordpress-' ) );
		const source = path.join( root, 'assets/src/js/main.js' );
		mkdirSync( path.dirname( source ), { recursive: true } );
		writeFileSync(
			source,
			"import './helpers/helper.js';\nimport { select } from '@wordpress/data';\nimport { registerBlockType } from '@wordpress/blocks';"
		);
		mkdirSync(
			path.dirname(
				path.join( path.dirname( source ), 'helpers/helper.js' )
			),
			{ recursive: true }
		);
		writeFileSync(
			path.join( path.dirname( source ), 'helpers/helper.js' ),
			"import { useBlockProps } from '@wordpress/editor';"
		);

		expect( discoverWordPressGlobals( root ) ).toEqual( {
			'@wordpress/blocks': 'wp.blocks',
			'@wordpress/data': 'wp.data',
			'@wordpress/editor': 'wp.editor',
		} );
		expect( discoverWordPressDependencies( root ) ).toEqual( {
			'assets/src/js/main.js': [ 'wp-blocks', 'wp-data', 'wp-editor' ],
		} );
		expect( createWordPressExternalPlugins( root ) ).toHaveLength( 4 );
	} );

	it( 'externalizes WordPress imports to their runtime global in production', async () => {
		root = mkdtempSync( path.join( tmpdir(), 'theme-vite-external-' ) );
		const source = path.join( root, 'assets/src/js/main.js' );
		const outDir = path.join( root, 'build' );
		mkdirSync( path.dirname( source ), { recursive: true } );
		writeFileSync(
			source,
			"import { registerBlockType } from '@wordpress/blocks';\nglobalThis.testRegister = registerBlockType;"
		);

		await build( {
			configFile: false,
			root,
			logLevel: 'silent',
			plugins: createWordPressExternalPlugins( root ),
			build: {
				outDir,
				manifest: '.vite/manifest.json',
				emptyOutDir: true,
				rollupOptions: { input: source },
			},
		} );

		const manifest = JSON.parse(
			readFileSync( path.join( outDir, '.vite/manifest.json' ), 'utf8' )
		);
		const entry = Object.values( manifest ).find(
			( item ) => item.isEntry
		);
		const output = readFileSync( path.join( outDir, entry.file ), 'utf8' );
		expect( output ).toContain( 'wp.blocks' );
		expect( output ).not.toContain( '@wordpress/blocks' );
		expect( entry.wordpressDependencies ).toEqual( [ 'wp-blocks' ] );
	} );

	it( 'writes an empty manifest when the source tree has no entries', async () => {
		root = mkdtempSync( path.join( tmpdir(), 'theme-vite-no-entries-' ) );

		await buildTheme( { root } );

		expect(
			JSON.parse(
				readFileSync(
					path.join( root, 'assets/build/.vite/manifest.json' ),
					'utf8'
				)
			)
		).toEqual( {} );
	} );
} );
