const fs = require( 'node:fs/promises' );
const path = require( 'node:path' );

const MARKER_REFRESH_INTERVAL = 5000;
const MARKER_STALE_AFTER = 15000;

async function removeStaleMarker( markerPath ) {
	try {
		const marker = await fs.stat( markerPath );
		const age = Date.now() - marker.mtimeMs;
		if ( age < 0 || age > MARKER_STALE_AFTER ) {
			await fs.rm( markerPath, { force: true } );
		}
	} catch ( error ) {
		if ( error.code !== 'ENOENT' ) {
			throw error;
		}
	}
}

async function startViteDev( options = {} ) {
	const createServer =
		options.createServer ||
		( async () => {
			const vite = await import( 'vite' );
			return vite.createServer();
		} );
	const markerPath = options.markerPath || path.resolve( 'assets/build/hot' );
	const signals = options.signals || process;
	const scheduleInterval = options.setInterval || setInterval;
	const cancelInterval = options.clearInterval || clearInterval;
	const writeMarker = options.writeMarker || fs.writeFile;
	let server;
	let ownsMarker = false;
	let refreshTimer;
	let startupComplete = false;
	let stopRequested = false;
	let shutdownPromise;
	let resolveClosed;
	const closed = new Promise( ( resolve ) => {
		resolveClosed = resolve;
	} );

	const removeMarker = async () => {
		if ( ownsMarker ) {
			await fs.rm( markerPath, { force: true } );
			ownsMarker = false;
		}
	};

	const stop = async () => {
		stopRequested = true;
		if ( ! startupComplete ) {
			return;
		}

		if ( shutdownPromise ) {
			return shutdownPromise;
		}

		shutdownPromise = ( async () => {
			cancelInterval( refreshTimer );
			try {
				if ( server ) {
					await server.close();
				}
			} finally {
				await removeMarker();
				signals.off( 'SIGINT', stop );
				signals.off( 'SIGTERM', stop );
				resolveClosed();
			}
		} )();

		return shutdownPromise;
	};

	signals.on( 'SIGINT', stop );
	signals.on( 'SIGTERM', stop );

	try {
		await removeStaleMarker( markerPath );
		if ( stopRequested ) {
			startupComplete = true;
			await stop();
			return { server, closed, shutdown: stop };
		}

		server = await createServer();
		if ( stopRequested ) {
			startupComplete = true;
			await stop();
			return { server, closed, shutdown: stop };
		}

		await server.listen();
		if ( stopRequested ) {
			startupComplete = true;
			await stop();
			return { server, closed, shutdown: stop };
		}

		const origin =
			server.config.server.origin || server.resolvedUrls?.local?.[ 0 ];
		if ( typeof origin !== 'string' || origin.length === 0 ) {
			throw new Error(
				'Vite did not resolve a development server origin.'
			);
		}

		await fs.mkdir( path.dirname( markerPath ), { recursive: true } );
		await writeMarker( markerPath, origin );
		ownsMarker = true;
		refreshTimer = scheduleInterval( () => {
			const now = new Date();
			return fs.utimes( markerPath, now, now ).catch( () => {} );
		}, options.refreshInterval || MARKER_REFRESH_INTERVAL );
		refreshTimer.unref?.();
		startupComplete = true;
		if ( stopRequested ) {
			await stop();
		}
	} catch ( error ) {
		startupComplete = true;
		try {
			await stop();
		} catch ( shutdownError ) {
			process.stderr.write(
				`${ shutdownError.stack || shutdownError }\n`
			);
		}
		throw error;
	}

	return { server, closed, shutdown: stop };
}

module.exports = { startViteDev };

if ( require.main === module ) {
	startViteDev()
		.then( ( running ) => running.closed )
		.catch( ( error ) => {
			process.stderr.write( `${ error.stack || error }\n` );
			process.exitCode = 1;
		} );
}
