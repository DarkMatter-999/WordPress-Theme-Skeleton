import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import externalGlobals from 'rollup-plugin-external-globals';
import viteExternal from 'vite-plugin-external';
import { defineConfig } from 'vite';

const JAVASCRIPT_EXTENSIONS = /\.(?:js|jsx|ts|tsx)$/;
const STYLE_EXTENSIONS = /\.(?:css|scss)$/;

export function discoverEntries( root = process.cwd() ) {
	const sourceRoot = path.resolve( root, 'assets/src' );
	const entries = {};

	for ( const [ directoryName, extensionPattern ] of [
		[ 'js', JAVASCRIPT_EXTENSIONS ],
		[ 'css', STYLE_EXTENSIONS ],
	] ) {
		const directory = path.join( sourceRoot, directoryName );
		if ( ! existsSync( directory ) ) {
			continue;
		}

		const files = readdirSync( directory, { withFileTypes: true } )
			.filter(
				( item ) => item.isFile() && extensionPattern.test( item.name )
			)
			.sort( ( left, right ) => left.name.localeCompare( right.name ) );

		for ( const file of files ) {
			const manifestKey = path.posix.join(
				'assets/src',
				directoryName,
				file.name
			);
			entries[ manifestKey ] = path.join( directory, file.name );
		}
	}

	return Object.fromEntries(
		Object.entries( entries ).sort( ( [ left ], [ right ] ) =>
			left.localeCompare( right )
		)
	);
}

function sourceFiles( directory ) {
	if ( ! existsSync( directory ) ) {
		return [];
	}

	return readdirSync( directory, { withFileTypes: true } ).flatMap(
		( item ) => {
			const filePath = path.join( directory, item.name );
			if ( item.isDirectory() ) {
				return sourceFiles( filePath );
			}

			return JAVASCRIPT_EXTENSIONS.test( item.name ) ? [ filePath ] : [];
		}
	);
}

function camelCaseDashes( value ) {
	return value.replace( /-([a-z])/g, ( _, letter ) => letter.toUpperCase() );
}

export function discoverWordPressGlobals( root = process.cwd() ) {
	const imports = new Set();
	const importPattern = /\b(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;

	for ( const file of sourceFiles( path.resolve( root, 'assets/src' ) ) ) {
		const source = readFileSync( file, 'utf8' );
		for ( const match of source.matchAll( importPattern ) ) {
			const moduleName = match[ 1 ];
			if ( /^@wordpress\/[a-z0-9-]+$/.test( moduleName ) ) {
				imports.add( moduleName );
			}
		}
	}

	return Object.fromEntries(
		[ ...imports ]
			.sort()
			.map( ( moduleName ) => [
				moduleName,
				`wp.${ camelCaseDashes(
					moduleName.slice( '@wordpress/'.length )
				) }`,
			] )
	);
}

export function discoverWordPressDependencies( root = process.cwd() ) {
	const importPattern = /\b(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;
	const entries = {};

	for ( const [ manifestKey, sourcePath ] of Object.entries( discoverEntries( root ) ) ) {
		if ( ! JAVASCRIPT_EXTENSIONS.test( sourcePath ) ) {
			continue;
		}

		const handles = new Set();
		const visited = new Set();
		const visitSource = ( file ) => {
			if ( visited.has( file ) || ! existsSync( file ) ) {
				return;
			}
			visited.add( file );
			const source = readFileSync( file, 'utf8' );
			for ( const match of source.matchAll( importPattern ) ) {
				const moduleName = match[ 1 ];
				if ( /^@wordpress\/[a-z0-9-]+$/.test( moduleName ) ) {
					handles.add( `wp-${ moduleName.slice( '@wordpress/'.length ) }` );
				} else if (
					[ 'react', 'react-dom', 'react/jsx-runtime' ].includes( moduleName )
				) {
					handles.add( 'wp-element' );
				} else if ( [ 'jquery', 'lodash' ].includes( moduleName ) ) {
					handles.add( moduleName );
				} else if ( moduleName.startsWith( '.' ) ) {
					const resolved = path.resolve( path.dirname( file ), moduleName );
					const candidates = path.extname( resolved )
						? [ resolved ]
						: [
							...['.js', '.jsx', '.ts', '.tsx'].map(
								( extension ) => `${ resolved }${ extension }`
							),
							...['.js', '.jsx', '.ts', '.tsx'].map(
								( extension ) =>
									path.join( resolved, `index${ extension }` )
							),
						];
					const localFile = candidates.find(
						( candidate ) =>
							existsSync( candidate ) &&
							JAVASCRIPT_EXTENSIONS.test( candidate )
					);
					if ( localFile ) {
						visitSource( localFile );
					}
				}
			}
		};
		visitSource( sourcePath );

		if ( handles.size > 0 ) {
			entries[ manifestKey ] = [ ...handles ].sort();
		}
	}

	return entries;
}

function wordpressDependencyManifest( root ) {
	return {
		name: 'wordpress-entry-dependencies-manifest',
		apply: 'build',
		writeBundle( outputOptions ) {
			const outputDirectory = outputOptions.dir || path.resolve( root, 'assets/build' );
			const manifestPath = path.join( outputDirectory, '.vite/manifest.json' );
			if ( ! existsSync( manifestPath ) ) {
				return;
			}

			const manifest = JSON.parse( readFileSync( manifestPath, 'utf8' ) );
			for ( const [ entry, dependencies ] of Object.entries(
				discoverWordPressDependencies( root )
			) ) {
				if ( manifest[ entry ] ) {
					manifest[ entry ].wordpressDependencies = dependencies;
				}
			}

			writeFileSync( manifestPath, `${ JSON.stringify( manifest, null, 2 ) }\n` );
		},
	};
}

export function createWordPressExternalPlugins( root = process.cwd() ) {
	const globals = {
		jquery: 'jQuery',
		lodash: 'lodash',
		react: 'React',
		'react-dom': 'ReactDOM',
		'react/jsx-runtime': 'ReactJSXRuntime',
		...discoverWordPressGlobals( root ),
	};

	return [
		{
			name: 'wordpress-build-globals',
			apply: 'build',
			config() {
				return {
					build: {
						rollupOptions: {
							external: Object.keys( globals ),
							output: { globals },
						},
					},
				};
			},
		},
		externalGlobals( globals ),
		viteExternal( { development: { externals: globals } } ),
		wordpressDependencyManifest( root ),
	];
}


export function createViteConfig( root = process.cwd() ) {
	return {
		base: './',
		plugins: [ react(), ...createWordPressExternalPlugins( root ) ],
		server: {
			host: '0.0.0.0',
			port: 5173,
			strictPort: true,
			origin: 'http://localhost:5173',
		},
		build: {
			outDir: path.resolve( root, 'assets/build' ),
			manifest: '.vite/manifest.json',
			emptyOutDir: true,
			rollupOptions: {
				input: discoverEntries( root ),
			},
		},
	};
}

export default defineConfig( () => createViteConfig() );
