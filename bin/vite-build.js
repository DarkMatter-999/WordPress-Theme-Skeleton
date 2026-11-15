const fs = require( 'node:fs/promises' );
const path = require( 'node:path' );

async function writeEmptyManifest( root ) {
	const buildDirectory = path.resolve( root, 'assets/build' );
	await fs.mkdir( buildDirectory, { recursive: true } );

	for ( const item of await fs.readdir( buildDirectory ) ) {
		if ( item !== 'hot' ) {
			await fs.rm( path.join( buildDirectory, item ), {
				recursive: true,
				force: true,
			} );
		}
	}

	const manifestDirectory = path.join( buildDirectory, '.vite' );
	await fs.mkdir( manifestDirectory, { recursive: true } );
	const manifestPath = path.join( manifestDirectory, 'manifest.json' );
	await fs.writeFile( manifestPath, '{}\n' );
	return manifestPath;
}

async function buildTheme( options = {} ) {
	const root = path.resolve( options.root || process.cwd() );
	const { createViteConfig, discoverEntries } = await import(
		'../vite.config.mjs'
	);
	const entries = discoverEntries( root );

	if ( Object.keys( entries ).length === 0 ) {
		return { manifestPath: await writeEmptyManifest( root ), empty: true };
	}

	const vite = await import( 'vite' );
	await vite.build( {
		configFile: false,
		root,
		...createViteConfig( root ),
	} );
	return {
		manifestPath: path.resolve( root, 'assets/build/.vite/manifest.json' ),
		empty: false,
	};
}

module.exports = { buildTheme };

if ( require.main === module ) {
	buildTheme().catch( ( error ) => {
		process.stderr.write( `${ error.stack || error }\n` );
		process.exitCode = 1;
	} );
}
