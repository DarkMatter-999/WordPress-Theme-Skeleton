# WordPress Theme Skeleton

A starter for developing WordPress themes with a Vite-based asset workflow, PHP and frontend linting, and an interactive theme initializer.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- pnpm `12.20.0` (managed through Corepack)
- Composer, for PHP_CodeSniffer

## Getting started

Clone the repository and install the JavaScript dependencies:

```bash
git clone https://github.com/DarkMatter-999/WordPress-Theme-Skeleton.git your-theme-name
cd your-theme-name
corepack enable
corepack prepare pnpm@12.20.0 --activate
pnpm install
```

Install the PHP development dependencies and initialize theme metadata:

```bash
composer install
pnpm run init
```

The initializer generates `style.css` and `functions.php` and updates the namespace and theme path constant in PHP files. Review its prompts and generated files before using the theme.

## Development

Run the Vite server while developing the theme:

```bash
pnpm dev
```

Keep the command running while browsing the WordPress site that has this theme active. PHP uses the fresh, ignored `assets/build/hot` marker to load mapped source entries from Vite at `http://localhost:5173`; Vite provides CSS/JavaScript HMR. The marker is refreshed while the server runs and removed on normal shutdown. If the process exits unexpectedly, the marker is considered stale after 15 seconds and PHP falls back to production asset resolution.

Source entry files live under `assets/src/js/` and `assets/src/css/`. Present top-level JS/JSX/TS/TSX and CSS/SCSS files are discovered and built independently. For example, `assets/src/css/main.css` is a standalone stylesheet entry; it does not need to be imported by a JavaScript file. PHP's existing enqueue hooks map `main.css` and `main.js`, plus an optional `editor.scss`; add a mapping in `include/classes/class-assets.php` when you add another source entry. The build does not require an `editor` or `screen` entry.

## Production build

Build optimized assets and the Vite manifest:

```bash
pnpm build
```

The build writes generated files to `assets/build/` and the manifest to `assets/build/.vite/manifest.json`. Deploy the generated `assets/build/` directory with the theme. Production PHP resolves assets from the manifest and does not require Node.js or a running Vite server.

## Linting and tests

The JavaScript and stylesheet linters use `@wordpress/scripts`; PHP linting uses Composer's PHP_CodeSniffer dependencies.

```bash
pnpm lint:js
pnpm lint:css
pnpm lint:php
pnpm test:js -- --run
php -d zend.assertions=1 -d assert.exception=1 tests/php/test-vite-assets.php
```

Fix commands are available as `pnpm lint:js:fix`, `pnpm lint:css:fix`, and `pnpm lint:php:fix`.

## Project structure

- `assets/src/` — JavaScript, TypeScript, CSS, and SCSS source entries.
- `assets/build/` — generated production files, Vite manifest, and temporary dev marker; ignored by Git.
- `bin/` — initializer and Vite development-server helper.
- `include/` — theme PHP classes, traits, and helpers.
- `parts/`, `templates/` — block theme template parts and templates.
- `theme.json` — WordPress theme settings and styles.
