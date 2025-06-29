# WordPress Theme Skeleton

This repository provides a skeleton for developing WordPress themes. It's designed to streamline development workflow by providing a pre-configured setup for common tasks like linting, building, and initializing theme.

## Features

*   **WordPress Scripts Integration:** Leverages `@wordpress/scripts` for easy handling of JavaScript and CSS compilation, linting, and development server setup.
*   **Code Linting:**
    *   **PHP:** Integrated with PHP_CodeSniffer for enforcing consistent PHP coding standards.
    *   **JavaScript:** Uses ESLint via `@wordpress/scripts`.
    *   **CSS/SCSS:** Uses Stylelint via `@wordpress/scripts`.
*   **Git Hooks (Husky):** Configured with Husky to run `lint-staged` before committing, ensuring that only linted and formatted code is committed to your repository.
*   **Autoloading:** Includes a basic autoloader setup (within the `include/helpers` directory) to manage PHP classes efficiently.
*   **Clear Structure:** Provides a logical directory structure to keep theme organized.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/DarkMatter-999/WordPress-Theme-Skeleton.git your-new-theme-name
cd your-new-theme-name
```

### 2. Install Dependencies

This project uses `npm` for managing front-end and development dependencies.

```bash
npm install
```

### 3. Initialize Your Theme

Run the initialization script to set up your theme's basic information. This script will prompt you for details like theme name, author, version, etc., and will update the main `style.css` and `functions.php` files, as well as internal namespaces and constants.

```bash
npm run init
```

Follow the prompts to enter your theme's details.

### 4. Composer Dependencies (for PHPCS)

To use the PHP linting, you'll need Composer to install `PHP_CodeSniffer`.

Once Composer is installed, run:

```bash
composer install
```

This will install PHP_CodeSniffer into the `vendor/` directory, allowing `npm run lint:php` to work.

## Development Workflow

### Starting the Development Server

To start the development server for JavaScript and CSS, which watches for changes and provides hot reloading:

```bash
npm start
```

### Building for Production

To compile and minify your JavaScript and CSS for production:

```bash
npm run build
```

### Code Linting and Formatting

This skeleton comes with pre-configured linting rules for PHP, JavaScript, and CSS.

*   **Lint All:**
    ```bash
    npm run lint
    ```
*   **Lint CSS/SCSS:**
    ```bash
    npm run lint:css
    ```
*   **Fix CSS/SCSS Linting Issues:**
    ```bash
    npm run lint:css:fix
    ```
*   **Lint JavaScript:**
    ```bash
    npm run lint:js
    ```
*   **Fix JavaScript Linting Issues:**
    ```bash
    npm run lint:js:fix
    ```
*   **Lint PHP:**
    ```bash
    npm run lint:php
    ```
*   **Fix PHP Linting Issues:**
    ```bash
    npm run lint:php:fix
    ```

### Pre-Commit Linting

This project uses `husky` and `lint-staged` to automatically run linters on staged files before you commit. This helps maintain code quality and consistency.

You don't need to run `lint:staged` manually; it's triggered by Git when you commit.

## Project Structure

*   `bin/`: Contains utility scripts, including `init.js`.
*   `include/`: Main directory for your theme's PHP classes and core logic.
    *   `include/helpers/autoloader.php`: Basic autoloader for your theme classes.
*   `src/`: Contains your raw JavaScript and CSS/SCSS files.
*   `build/`: (Generated) Compiled and minified assets from `npm run build`.
*   `vendor/`: (Generated) Composer dependencies (e.g., PHP_CodeSniffer).
*   `style.css`: The main theme stylesheet, updated by `npm run init`.
*   `functions.php`: The main theme functions file, updated by `npm run init`.
*   `index.php`: A minimal `index.php` (you'll likely want to expand on this).
*   `stylelintrc.json`: Stylelint configuration.
*   `phpcs.xml`: PHP_CodeSniffer configuration.
*   `package.json`: Project metadata and npm scripts.
*   `composer.json`: Composer metadata and dependencies.

## Customization

*   **PHP Namespace:** The `init` script will prompt you for a namespace. This will be used for your main theme classes.
*   **Constant Prefix:** The `init` script automatically generates a unique constant prefix based on your theme name.
*   **Linting Rules:** Adjust `stylelintrc.json`, and `phpcs.xml` to match your preferred coding standards.
*   **Autoloading:** If your project grows complex, you might consider migrating to a more robust autoloader (e.g., Composer's autoloader) for PHP classes.
