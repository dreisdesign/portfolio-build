/**
 * HTML Head Injection Script
 *
 * Created: 2025-04-14
 * Version: 1.4.0
 * Author: Daniel Reis
 *
 * Injects common HTML head elements into all HTML files during the build process:
 * 1. At the start of <head>: Adds standard meta tags and timestamp comment
 * 2. Replaces <!-- BUILD_INSERT id="head" --> placeholder with the common head content
 * 3. Or inserts content before </head> if no placeholder is found
 * 4. Uses minified CSS (.min.css) for production builds
 * 5. Adds video-wrapper.js script to portfolio pages
 * 
 * Usage:
 * node inject-head.mjs <build-directory>
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
const buildDir = args[0];

if (!buildDir) {
    console.error('Error: Build directory not specified');
    process.exit(1);
}

// Create timestamp for versioning
const dateObj = new Date();
const machineTimestamp = dateObj.toISOString().slice(0, 10).replace(/-/g, '') + '-' +
    dateObj.toTimeString().slice(0, 5).replace(':', '');

// Determine if this is a production build by checking if minified CSS files exist
const stylesDir = path.join(buildDir, 'styles');
let isProductionBuild = false;

if (fs.existsSync(stylesDir)) {
    // Check for any .min.css files in the styles directory
    const files = fs.readdirSync(stylesDir);
    isProductionBuild = files.some(file => file.endsWith('.min.css'));
}

console.log(`Build type: ${isProductionBuild ? 'Production (using .min.css)' : 'Development (using .css)'}`);

// =========================================================
// TEMPLATE CONTENT - Consolidated directly in this file
// =========================================================

// Essential meta tags for the beginning of head section
const headStartTemplate = `<!-- Essential Meta Tags -->
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#fff" />`;

// Define headStartContent from the template
const headStartContent = headStartTemplate;

// Common head elements for all pages
const headCommonTemplate = `<!-- Common head elements for all pages -->
  <!-- Font Display Strategy -->
  <style>
    @font-face {
        font-family: "Source Sans 3 VF";
        src: url("/fonts/SourceSans3VF.woff2") format("woff2-variations");
        font-weight: 200 900;
        font-style: normal;
        font-display: swap;
    }
  </style>
  <!-- Font Preload -->
  <link rel="preload" href="/fonts/SourceSans3VF.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
  <!-- Favicon -->
  <link rel="icon" href="/favicon.ico?v=20250415-0739" sizes="any">
  <link rel="icon" href="/favicon.svg?v=20250415-0739" type="image/svg+xml">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v={{VERSION}}">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v={{VERSION}}">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v={{VERSION}}">
  <link rel="manifest" href="/site.webmanifest?v={{VERSION}}">
  <link rel="mask-icon" href="/safari-pinned-tab.svg?v={{VERSION}}" color="#333333">
  <meta name="msapplication-TileColor" content="#333333">
  <!-- Critical Resources -->
  <link rel="preload" href="/styles/main${isProductionBuild ? '.min' : ''}.css?v={{VERSION}}" as="style" />
  <!-- Stylesheets -->
  <link rel="stylesheet" href="/styles/main${isProductionBuild ? '.min' : ''}.css?v={{VERSION}}" />`;

// Additional script for portfolio pages
const portfolioScriptsTemplate = `
  <!-- Portfolio-specific scripts -->
  <script defer src="/js/video-wrapper.js?v={{VERSION}}"></script>`;

// Replace version placeholder in templates
const headCommonContent = headCommonTemplate.replace(/{{VERSION}}/g, machineTimestamp);
const portfolioScriptsContent = portfolioScriptsTemplate.replace(/{{VERSION}}/g, machineTimestamp);

// Helper function to check if essential meta tags are already present
function hasEssentialMetaTags(content) {
    return content.includes('<meta charset="UTF-8"') &&
        content.includes('<meta name="viewport"') &&
        content.includes('<meta name="theme-color"');
}

// Helper function to check if full head content is already injected
function hasInjectedHeadContent(content) {
    // Check for main stylesheet which is part of injected content
    return content.includes('href="/styles/main') &&
        content.includes('rel="stylesheet"') &&
        content.includes('Source Sans 3 VF') &&
        content.includes('rel="preload"');
}

// Helper function to check if a file is in the portfolio section
function isPortfolioPage(filePath) {
    return filePath.includes('/portfolio/');
}

// Find all HTML files in the build directory
function findHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Recurse into subdirectory
            results = results.concat(findHtmlFiles(filePath));
        } else if (path.extname(filePath).toLowerCase() === '.html') {
            results.push(filePath);
        }
    });

    return results;
}

async function injectHeadContent() {
    try {
        // Find all HTML files in the build directory
        const htmlFiles = findHtmlFiles(buildDir);
        console.log(`Found ${htmlFiles.length} HTML files for head injection`);

        let injectedCount = 0;
        let placeholderCount = 0;
        let insertBeforeHeadCount = 0;
        let portfolioPageCount = 0;

        for (const file of htmlFiles) {
            // Read file content
            let content = fs.readFileSync(file, 'utf8');
            let injected = false;
            let modified = false;
            const isPortfolio = isPortfolioPage(file);

            // Prepare the appropriate head content based on page type
            let headContent = headCommonContent;
            if (isPortfolio) {
                headContent += portfolioScriptsContent;
                portfolioPageCount++;
            }

            // Step 1: Update meta tags at beginning of head section if needed
            const headStartPos = content.indexOf('<head>');
            if (headStartPos !== -1) {
                // Only insert essential meta tags if they aren't already present
                if (!hasEssentialMetaTags(content)) {
                    const headStartInsertPos = headStartPos + 6; // Length of '<head>'
                    content = content.slice(0, headStartInsertPos) + '\n  ' + headStartContent + content.slice(headStartInsertPos);
                    modified = true;
                }
            }

            // Step 2: Check for BUILD_INSERT id="head" placeholder
            const placeholderRegex = /<!-- BUILD_INSERT id="head" -->/;
            if (placeholderRegex.test(content)) {
                // Only replace if head content isn't already injected
                if (!hasInjectedHeadContent(content)) {
                    content = content.replace(placeholderRegex, headContent);
                    placeholderCount++;
                    injected = true;
                    modified = true;
                } else {
                    // Remove the placeholder since content is already injected
                    content = content.replace(placeholderRegex, '');
                    modified = true;
                }
            }
            // Step 3: Otherwise insert before </head> only if we haven't already injected via placeholder
            else {
                const headEndPos = content.indexOf('</head>');
                if (headEndPos !== -1 && !injected && !hasInjectedHeadContent(content)) {
                    content = content.slice(0, headEndPos) + '  ' + headContent + '\n  ' + content.slice(headEndPos);
                    insertBeforeHeadCount++;
                    injected = true;
                    modified = true;
                }
            }

            // Step 4: Replace any remaining {{VERSION}} placeholders throughout the document
            if (content.includes('{{VERSION}}')) {
                content = content.replace(/{{VERSION}}/g, machineTimestamp);
                modified = true;
            }

            // Write updated content back to file
            if (modified) {
                fs.writeFileSync(file, content, 'utf8');
                injectedCount++;
            }
        }

        console.log(`Successfully injected head content into ${injectedCount} HTML files:`);
        console.log(`- ${placeholderCount} files using placeholder`);
        console.log(`- ${insertBeforeHeadCount} files by inserting before </head> tag`);
        console.log(`- ${portfolioPageCount} portfolio pages with video-wrapper.js`);
        console.log('HTML head injection completed successfully');
    } catch (err) {
        console.error(`Error injecting head content: ${err.message}`);
        process.exit(1);
    }
}

// Run the injection
injectHeadContent();