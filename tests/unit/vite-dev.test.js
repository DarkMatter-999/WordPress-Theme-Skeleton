import { EventEmitter } from 'node:events';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startViteDev } from '../../bin/vite-dev.js';

const packageJson = JSON.parse(
	readFileSync( path.resolve( 'package.json' ), 'utf8' )
);

describe( 'Vite development lifecycle', () => {
	let root;
	afterEach( () => {
		if ( root ) {
			rmSync( root, { recursive: true, force: true } );
			root = undefined;
		}
	} );

	it( 'writes the server origin after listening and removes the marker on SIGTERM', async () => {
		root = mkdtempSync( path.join( os.tmpdir(), 'theme-vite-dev-' ) );
		const markerPath = path.join( root, 'assets/build/hot' );
		mkdirSync( path.dirname( markerPath ), { recursive: true } );
		writeFileSync( markerPath, 'http://old-server:5173' );
		const stale = new Date( Date.now() - 60_000 );
		utimesSync( markerPath, stale, stale );
		const signals = new EventEmitter();
		let listened = false;
		let closed = false;
		const server = {
			config: { server: { origin: 'http://localhost:5173' } },
			async listen() {
				listened = true;
				expect( existsSync( markerPath ) ).toBe( false );
			},
			async close() {
				closed = true;
			},
		};

		const running = await startViteDev( {
			createServer: async () => server,
			markerPath,
			signals,
		} );

		expect( listened ).toBe( true );
		expect( readFileSync( markerPath, 'utf8' ) ).toBe(
			'http://localhost:5173'
		);
		signals.emit( 'SIGTERM' );
		await running.closed;
		expect( closed ).toBe( true );
		expect( existsSync( markerPath ) ).toBe( false );
	} );

	it( 'closes the server and leaves no marker when startup fails', async () => {
		root = mkdtempSync( path.join( os.tmpdir(), 'theme-vite-fail-' ) );
		const markerPath = path.join( root, 'assets/build/hot' );
		let closed = false;
		const server = {
			async listen() {
				throw new Error( 'listen failed' );
			},
			async close() {
				closed = true;
			},
		};

		await expect(
			startViteDev( {
				createServer: async () => server,
				markerPath,
				signals: new EventEmitter(),
			} )
		).rejects.toThrow( 'listen failed' );
		expect( closed ).toBe( true );
		expect( existsSync( markerPath ) ).toBe( false );
	} );

	it( 'preserves a live server marker when a competing server cannot listen', async () => {
		root = mkdtempSync( path.join( os.tmpdir(), 'theme-vite-conflict-' ) );
		const markerPath = path.join( root, 'assets/build/hot' );
		const active = await startViteDev( {
			createServer: async () => ( {
				config: { server: { origin: 'http://localhost:5173' } },
				async listen() {},
				async close() {},
			} ),
			markerPath,
			signals: new EventEmitter(),
		} );

		await expect(
			startViteDev( {
				createServer: async () => ( {
					async listen() {
						throw new Error( 'port is already in use' );
					},
					async close() {},
				} ),
				markerPath,
				signals: new EventEmitter(),
			} )
		).rejects.toThrow( 'port is already in use' );
		expect( readFileSync( markerPath, 'utf8' ) ).toBe(
			'http://localhost:5173'
		);
		await active.shutdown();
	} );

	it( 'refreshes the marker timestamp every five seconds', async () => {
		root = mkdtempSync( path.join( os.tmpdir(), 'theme-vite-heartbeat-' ) );
		const markerPath = path.join( root, 'assets/build/hot' );
		let refresh;
		let interval;
		const running = await startViteDev( {
			createServer: async () => ( {
				config: { server: { origin: 'http://localhost:5173' } },
				async listen() {},
				async close() {},
			} ),
			markerPath,
			signals: new EventEmitter(),
			setInterval( callback, delay ) {
				refresh = callback;
				interval = delay;
				return { unref() {} };
			},
			clearInterval() {},
		} );
		const stale = new Date( Date.now() - 60_000 );
		utimesSync( markerPath, stale, stale );

		await refresh();

		expect( interval ).toBe( 5000 );
		expect( statSync( markerPath ).mtimeMs ).toBeGreaterThan(
			stale.getTime()
		);
		await running.shutdown();
	} );

	it( 'uses the marker-managed Vite command and a marker-free production build', () => {
		expect( packageJson.scripts.dev ).toBe( 'node ./bin/vite-dev.js' );
		expect( packageJson.scripts.build ).toBe( 'node ./bin/vite-build.js' );
		expect( packageJson.scripts.build ).not.toContain( 'vite-dev' );
	} );

	it( 'preserves WordPress lint commands with working fix flags', () => {
		expect( packageJson.scripts[ 'lint:js' ] ).toBe( 'wp-scripts lint-js' );
		expect( packageJson.scripts[ 'lint:js:fix' ] ).toBe(
			'wp-scripts lint-js --fix'
		);
		expect( packageJson.scripts[ 'lint:css' ] ).toBe(
			'wp-scripts lint-style'
		);
		expect( packageJson.scripts[ 'lint:css:fix' ] ).toBe(
			'wp-scripts lint-style --fix'
		);
	} );
} );
