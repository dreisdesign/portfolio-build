/**
 * HTML Navigation Injection Script
 *
 * Created: 2025-01-20
 * Version: 1.0.0
 * Author: Daniel Reis
 *
 * Injects navigation HTML into all HTML files during the build process:
 * - Replaces <!-- BUILD_INSERT id="nav" --> placeholder with navigation content
 * - Creates a consistent navigation structure across all pages
 * - Handles active page detection based on file path
 * 
 * Usage:
 * node inject-nav.mjs <build-directory>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get command line arguments
const args = process.argv.slice(2);
const buildDir = args[0] || path.join(__dirname, '../../../../../build/temp');

if (!buildDir) {
    console.error('Error: Build directory not specified');
    console.log('Usage: node inject-nav.mjs <build-directory>');
    process.exit(1);
}

// Ensure the build directory exists
if (!fs.existsSync(buildDir)) {
    console.error(`Error: Build directory does not exist: ${buildDir}`);
    process.exit(1);
}

console.log(`🧭 Starting navigation injection in: ${buildDir}`);

// Navigation template with proper structure based on CSS
const navigationTemplate = `<nav>
  <ul>
    <li><a href="/" data-page="home">Home</a></li>
    <li><a href="/portfolio/" data-page="portfolio">Portfolio</a></li>
    <li><a href="/about/" data-page="about">About</a></li>
  </ul>
</nav>`;

/**
 * Determines the active page based on file path
 * @param {string} filePath - The file path to analyze
 * @returns {string} - The page identifier for active state
 */
function getActivePage(filePath) {
    // Get path relative to the public_html directory within build
    const publicHtmlDir = path.join(buildDir, 'public_html');
    const relativePath = path.relative(publicHtmlDir, filePath);

    // Home page
    if (relativePath === 'index.html') {
        return 'home';
    }

    // Portfolio pages
    if (relativePath.startsWith('portfolio/')) {
        return 'portfolio';
    }

    // About page
    if (relativePath.startsWith('about/')) {
        return 'about';
    }

    // Default to home for other pages
    return 'home';
}

/**
 * Creates navigation HTML with active page styling
 * @param {string} activePage - The page to mark as active
 * @returns {string} - Navigation HTML with active state
 */
function createNavigationWithActiveState(activePage) {
    let navHtml = navigationTemplate;

    // Add 'current' class to the active page link
    const activePattern = new RegExp(`(<a href="[^"]*" data-page="${activePage}"[^>]*)(>)`);
    navHtml = navHtml.replace(activePattern, '$1 class="current"$2');

    return navHtml;
}

/**
 * Processes a single HTML file to inject navigation
 * @param {string} filePath - Path to the HTML file
 */
function injectNavigationIntoFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Check if file contains navigation placeholder
        if (!content.includes('<!-- BUILD_INSERT id="nav" -->')) {
            return false; // Skip files without navigation placeholder
        }

        // Determine active page
        const activePage = getActivePage(filePath);

        // Create navigation with active state
        const navigationHtml = createNavigationWithActiveState(activePage);

        // Replace the placeholder with navigation
        const updatedContent = content.replace(
            '<!-- BUILD_INSERT id="nav" -->',
            navigationHtml
        );

        // Write the updated content back to file
        fs.writeFileSync(filePath, updatedContent, 'utf8');

        console.log(`  ✅ Injected navigation into: ${path.relative(path.join(buildDir, 'public_html'), filePath)} (active: ${activePage})`);
        return true;

    } catch (error) {
        console.error(`  ❌ Error processing ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Recursively finds all HTML files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} - Array of HTML file paths
 */
function findHtmlFiles(dir) {
    let htmlFiles = [];

    try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                htmlFiles = htmlFiles.concat(findHtmlFiles(fullPath));
            } else if (stat.isFile() && item.endsWith('.html')) {
                htmlFiles.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error.message);
    }

    return htmlFiles;
}

/**
 * Main function to inject navigation into all HTML files
 */
function main() {
    console.log('🔍 Finding HTML files...');

    // Look for HTML files in the public_html directory within build
    const publicHtmlDir = path.join(buildDir, 'public_html');

    if (!fs.existsSync(publicHtmlDir)) {
        console.error(`Error: public_html directory not found: ${publicHtmlDir}`);
        process.exit(1);
    }

    const htmlFiles = findHtmlFiles(publicHtmlDir);
    console.log(`📄 Found ${htmlFiles.length} HTML files`);

    let injectedCount = 0;
    let skippedCount = 0;

    for (const filePath of htmlFiles) {
        const result = injectNavigationIntoFile(filePath);
        if (result) {
            injectedCount++;
        } else {
            skippedCount++;
        }
    }

    console.log('\n📊 Navigation injection summary:');
    console.log(`  ✅ Injected: ${injectedCount} files`);
    console.log(`  ⏭️ Skipped: ${skippedCount} files (no navigation placeholder)`);
    console.log('🧭 Navigation injection completed successfully!');
}

// Run the script
main();
