const fs = require( 'fs' );
const readline = require( 'readline' );
const path = require( 'path' );

// Helper functions
function slugify( str ) {
	return str
		.toLowerCase()
		.replace( /\s+/g, '-' )
		.replace( /[^a-z0-9\-]/g, '' );
}

function getPrefix( str ) {
	const matches = str.match( /(?:^|[ _])([a-zA-Z])|([A-Z])/g ) || [];
	return matches
		.map( ( match ) =>
			match.length === 1 ? match : match[ match.length - 1 ].toUpperCase()
		)
		.join( '' );
}

function replaceInIncludes() {
	const includesDir = path.join( process.cwd(), 'include' );
	const targetNamespace = 'DarkMatter_Theme';
	const targetPathConst = 'DM_THEME_PATH';
	const targetPackage = 'DarkMatter_Package';

	const replacementNamespace = answers.namespace;
	const replacementPathConst = `${ getPrefix(
		answers.themeName
	) }_THEME_PATH`;
	const replacementPackage = answers.package;

	if ( ! fs.existsSync( includesDir ) ) {
		console.warn( `⚠️ Directory not found: ${ includesDir }` ); // eslint-disable-line no-console
		return;
	}

	function walkDir( dir ) {
		const files = fs.readdirSync( dir );
		for ( const file of files ) {
			const fullPath = path.join( dir, file );
			const stat = fs.statSync( fullPath );

			if ( stat.isDirectory() ) {
				walkDir( fullPath );
			} else if ( file.endsWith( '.php' ) ) {
				const content = fs.readFileSync( fullPath, 'utf8' );
				const updated = content
					.replace(
						new RegExp( targetNamespace, 'g' ),
						replacementNamespace
					)
					.replace(
						new RegExp( targetPathConst, 'g' ),
						replacementPathConst
					)
					.replace(
						new RegExp( targetPackage, 'g' ),
						replacementPackage
					);

				if ( updated !== content ) {
					fs.writeFileSync( fullPath, updated, 'utf8' );
					console.log( `🛠️ Updated: ${ fullPath }` ); // eslint-disable-line no-console
				}
			}
		}
	}

	walkDir( includesDir );
}

// CLI
const rl = readline.createInterface( {
	input: process.stdin,
	output: process.stdout,
} );

const questions = [
	{ key: 'themeName', question: 'Theme Name', default: 'My Theme' },
	{ key: 'themeURI', question: 'Theme URI', default: '' },
	{
		key: 'description',
		question: 'Theme Description',
		default: 'A custom WordPress theme.',
	},
	{ key: 'version', question: 'Version', default: '1.0.0' },
	{ key: 'author', question: 'Author Name', default: '' },
	{ key: 'authorURI', question: 'Author URI', default: '' },
	{
		key: 'license',
		question: 'License',
		default: 'GNU General Public License v2.0 or later',
	},
	{
		key: 'licenseURI',
		question: 'License URI',
		default: 'https://www.gnu.org/licenses/gpl-2.0.html',
	},
	{
		key: 'tags',
		question: 'Theme Tags (comma separated)',
		default: 'block-patterns, full-site-editing',
	},
	{ key: 'textDomain', question: 'Text Domain', default: '' },
	{ key: 'domainPath', question: 'Domain Path', default: '/languages' },
	{
		key: 'testedUpTo',
		question: 'Tested up to (WP version)',
		default: '6.8.1',
	},
	{ key: 'requiresWP', question: 'Requires at least', default: '6.5' },
	{ key: 'requiresPHP', question: 'Requires PHP', default: '7.4' },
	{ key: 'package', question: 'Package Name', default: '' },
	{ key: 'email', question: 'Author Email', default: '' },
	{ key: 'namespace', question: 'Namespace', default: 'MyTheme' },
];

const answers = {};

function askQuestion( index = 0 ) {
	const item = questions[ index ];
	const prompt = !! item.default
		? `${ item.question } [${ item.default }]: `
		: `${ item.question }: `;

	rl.question( prompt, ( input ) => {
		answers[ item.key ] = input.trim() || item.default;
		if ( index + 1 < questions.length ) {
			askQuestion( index + 1 );
		} else {
			rl.close();
			generateThemeFiles();
		}
	} );
}

function generateThemeFiles() {
	const slug = slugify( answers.themeName );
	const constPrefix = getPrefix( answers.themeName ).toUpperCase();
	const themeDir = process.cwd();
	const fullNamespace = answers.namespace;

	// --- style.css ---
	const styleContent = `/**
 * Theme Name:        ${ answers.themeName }
 * Theme URI:         ${ answers.themeURI }
 * Description:       ${ answers.description }
 * Version:           ${ answers.version }
 * Author:            ${ answers.author }
 * Author URI:        ${ answers.authorURI }
 * Tags:              ${ answers.tags }
 * Text Domain:       ${ answers.textDomain || slug }
 * Domain Path:       ${ answers.domainPath }
 * Tested up to:      ${ answers.testedUpTo }
 * Requires at least: ${ answers.requiresWP }
 * Requires PHP:      ${ answers.requiresPHP }
 * License:           ${ answers.license }
 * License URI:       ${ answers.licenseURI }
 */
`;

	fs.writeFileSync(
		path.join( themeDir, 'style.css' ),
		styleContent,
		'utf8'
	);

	// --- functions.php ---
	const functionsContent = `<?php
/**
 * Functions file for ${ answers.themeName }.
 *
 * @package ${ answers.package }
 * @since   ${ answers.themeName } ${ answers.version }
 */

use ${ fullNamespace }\\Theme;

define('${ constPrefix }_THEME_PATH', get_template_directory());
define('${ constPrefix }_THEME_URL', get_template_directory_uri());

require_once ${ constPrefix }_THEME_PATH . '/include/helpers/autoloader.php';

if (! function_exists('${ slug.replace( /-/g, '_' ) }_setup')) {
  /**
	 * Theme Main setup function.
	 *
	 * @return void
	 */
    function ${ slug.replace( /-/g, '_' ) }_setup() {
        Theme::get_instance();
    }
}
${ slug.replace( /-/g, '_' ) }_setup();

if (! function_exists('${ constPrefix.toLowerCase() }_load_textdomain')) {
  /**
	 * Load the textdomain from template-dir/languages
	 *
	 * @return void
	 */
    function ${ constPrefix.toLowerCase() }_load_textdomain() {
        load_theme_textdomain('${
			answers.textDomain || slug
		}', false, ${ constPrefix }_THEME_PATH . '${ answers.domainPath }');
    }
}
add_action('after_setup_theme', '${ constPrefix.toLowerCase() }_load_textdomain');
`;

	fs.writeFileSync(
		path.join( themeDir, 'functions.php' ),
		functionsContent,
		'utf8'
	);

	// eslint-disable-next-line no-console
	console.log( `✅ Theme generated at: ${ themeDir }` );
	// eslint-disable-next-line no-console
	console.log( `📁 Namespace: ${ fullNamespace }` );
	// eslint-disable-next-line no-console
	console.log( `📦 Slug: ${ slug }` );
	// eslint-disable-next-line no-console
	console.log( `🔧 Constant prefix: ${ constPrefix }` );

	process.chdir( themeDir ); // Move to theme dir for include replacement
	replaceInIncludes();
}

askQuestion();
