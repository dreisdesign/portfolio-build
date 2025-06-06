#!/usr/bin/env node

/**
 * 00-validate-html.mjs
 * 
 * This script validates HTML files to ensure they're well-formed before proceeding with the build.
 * It runs before any transformations, checking for common issues like unclosed tags,
 * mismatched tags, etc., and ONLY reports problems without attempting to fix them automatically.
 * 
 * This script performs multiple functions:
 * 1. Validates HTML files for structural errors
 * 2. Ensures asset folders exist for all portfolio projects
 * 3. Updates timestamps in HTML files
 * 4. Updates version numbers in CSS files
 * 5. Ensures proper formatting with blank lines between timestamp comments and doctype declarations
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import globCallback from 'glob';
import { parse } from 'node-html-parser';

const glob = promisify(globCallback);

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Asset Folder Creation for Portfolio Projects ===
async function ensureAssetFolders() {
    const portfolioRoot = path.join(process.cwd(), 'public_html', 'portfolio');
    const assetTypes = ['images', 'videos', 'documents'];
    const assetRoot = (type) => path.join(process.cwd(), 'public_html', 'assets', type, 'portfolio');

    function walkPortfolio(dir) {
        // Recursively find all [company]/[project] folders
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(function (file) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                // If this directory contains an index.html, treat as a project folder
                if (fs.existsSync(path.join(fullPath, 'index.html'))) {
                    results.push(fullPath);
                } else {
                    results = results.concat(walkPortfolio(fullPath));
                }
            }
        });
        return results;
    }

    const projectFolders = walkPortfolio(portfolioRoot);
    let created = 0;
    for (const projectPath of projectFolders) {
        // Get relative path after 'portfolio/' and force lowercase
        const rel = path.relative(portfolioRoot, projectPath).toLowerCase();
        for (const type of assetTypes) {
            const dest = path.join(assetRoot(type), rel);
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
                created++;
                console.log(`[assets] Created missing folder: ${dest}`);
            }
        }
    }
    if (created > 0) {
        console.log(`[assets] Ensured asset folders for ${projectFolders.length} portfolio projects (${created} created)`);
    } else {
        console.log(`[assets] All asset folders already exist for ${projectFolders.length} portfolio projects`);
    }
}

// Run asset folder creation before any validation or timestamp logic
await ensureAssetFolders();

/**
 * Custom HTML parser wrapper that accepts closing </source> tags within video elements
 * @param {string} html - HTML content to parse
 * @returns {Object} - Parsed HTML object
 */
function customParseHtml(html) {
    // Before parsing, replace all closing </source> tags within video elements
    // with a temporary placeholder to prevent parsing errors
    const modifiedHtml = html.replace(
        /(<video[^>]*>)([\s\S]*?)(<\/video>)/g,
        (match, videoOpen, content, videoClose) => {
            // Replace </source> with a placeholder in video content
            const modifiedContent = content.replace(/<\/source>/g, '<!-- SOURCE_CLOSING_TAG_PLACEHOLDER -->');
            return videoOpen + modifiedContent + videoClose;
        }
    );

    try {
        // Parse the modified HTML
        return parse(modifiedHtml);
    } catch (error) {
        // If still having issues with source tags, try with more lenient options
        if (error.message && error.message.includes('source')) {
            console.log('Note: Using lenient parsing for source tags in video elements');
            return parse(modifiedHtml, {
                lowerCaseTagName: false,
                voidTag: {
                    closingSlash: 'ignore',
                    canUseClosingTag: true // Allow closing tags for void elements
                }
            });
        }
        // If it's a different error, just throw it
        throw error;
    }
}

/**
 * Validates a single HTML file
 * @param {string} filePath - Path to the HTML file
 * @returns {Object} - Object with isValid boolean and any issues
 */
async function validateHtmlFile(filePath) {
    const issues = [];
    let isValid = true;

    try {
        const content = await fs.promises.readFile(filePath, 'utf8');

        // Check for incomplete video tags - using a more precise regex
        // This improved version looks for video tags that aren't properly closed before the next div
        const videoTagRegex = /<video[^>]*>(?:(?!<\/video>|<video)[\s\S])*?(?=<div|$)/gs;
        const incompleteVideoTags = content.match(videoTagRegex);

        if (incompleteVideoTags) {
            // Only consider it an issue if the match doesn't already contain a closing video tag
            // AND the video tag doesn't appear properly closed in the following content
            const realIncomplete = incompleteVideoTags.filter(match => {
                if (match.includes('</video>')) return false;

                // Check if this might be a case where the closing tag is just a bit further down
                const matchEndPos = content.indexOf(match) + match.length;
                const nextChunk = content.substring(matchEndPos, matchEndPos + 100);
                return !nextChunk.includes('</video>');
            });

            if (realIncomplete.length > 0) {
                issues.push({
                    type: 'incomplete_video_tag',
                    message: 'Video tag missing closing </video> tag',
                    snippet: realIncomplete[0].substring(0, 100) + '...',
                    matches: realIncomplete
                });
                isValid = false;
            }
        }

        // Skip checking for unclosed source tags within video elements
        // We're allowing both self-closing <source /> tags and tags with </source> closing tags

        // Try parsing the HTML to catch other structural issues
        try {
            // Use custom parser that accepts closing source tags
            const root = customParseHtml(content);
            const parsingErrors = root.errors ? root.errors.filter(error => {
                // Filter out any errors related to source tags within video elements
                return !(error && error.message && (
                    error.message.includes('source') &&
                    content.includes('<video') &&
                    content.includes('</source>')
                ));
            }) : [];

            if (parsingErrors && parsingErrors.length > 0) {
                issues.push({
                    type: 'parsing_error',
                    message: 'HTML parsing error',
                    details: parsingErrors
                });
                isValid = false;
            }
        } catch (parseError) {
            // Skip errors related to source tags
            if (!(parseError.message && parseError.message.includes('source') && content.includes('<video'))) {
                issues.push({
                    type: 'parse_error',
                    message: 'Failed to parse HTML',
                    error: parseError.message
                });
                isValid = false;
            }
        }

        // Check for specific div/video nesting issues in carousel slides
        // This regex looks for a video tag that incorrectly appears to close AFTER a div closes
        // We're being more specific to avoid false positives with properly structured HTML
        const carouselVideoCheck = /<div[^>]*>[\s\S]*?<video[^>]*>[\s\S]*?<\/div>\s*<\/video>/g;
        const misplacedVideoClosing = content.match(carouselVideoCheck);

        if (misplacedVideoClosing) {
            // Find the exact line number(s) for more precise diagnostics
            const lines = content.split('\n');
            let lineMatches = [];

            // Find actual problematic closing video tags
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('</video>') &&
                    (i > 0 && lines[i - 1].includes('</div>') || lines[i].includes('</div>'))) {
                    // This is likely a problematic case where </video> appears right after </div>
                    lineMatches.push({
                        lineNumber: i + 1,
                        content: lines[i].trim(),
                        surroundingCode: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n')
                    });
                }
            }

            if (lineMatches.length > 0) {
                issues.push({
                    type: 'misplaced_video_closing',
                    message: 'Video closing tag appears after div closing tag',
                    snippet: misplacedVideoClosing[0].substring(0, 100) + '...',
                    lineMatches: lineMatches
                });
                isValid = false;
            }
        }

        // Look for incorrect </video> tags where they don't belong (after picture elements)
        const spuriousVideoTags = /<\/picture>\s*<\/video>/g;
        const spuriousTags = content.match(spuriousVideoTags);

        if (spuriousTags) {
            issues.push({
                type: 'spurious_video_tag',
                message: 'Spurious video closing tag after picture element',
                snippet: spuriousTags.join('\n').substring(0, 100) + '...'
            });
            isValid = false;
        }

    } catch (error) {
        issues.push({
            type: 'file_error',
            message: `Error reading file: ${error.message}`
        });
        isValid = false;
    }

    return {
        isValid,
        filePath,
        issues
    };
}

/**
 * Validates all HTML files in a directory
 * @param {string} dirPath - Path to directory containing HTML files
 * @param {Object} options - Options object
 * @returns {Object} - Object with validation results
 */
async function validateHtmlDirectory(dirPath, { recursive = true, verbose = false } = {}) {
    const isPostTransform = dirPath.includes('build/temp');
    const startTime = Date.now();

    try {
        const pattern = recursive ? '**/*.html' : '*.html';
        const files = await glob(pattern, { cwd: dirPath });

        if (verbose) {
            if (isPostTransform) {
                console.log(`\n====== FINAL HTML VALIDATION (POST-TRANSFORMATION) ======`);
                console.log(`🔍 Checking HTML files after responsive image transformation`);
                console.log(`🕒 Starting validation at: ${new Date().toLocaleTimeString()}`);
            }
            console.log(`Found ${files.length} HTML files to validate in ${dirPath}`);
        }

        const results = [];
        let allValid = true;
        let filesWithIssues = 0;
        let filesFailed = 0;
        let filesPassed = 0;

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const result = await validateHtmlFile(filePath);

            if (!result.isValid) {
                allValid = false;
                filesWithIssues++;
                filesFailed++;

                if (verbose) {
                    console.error(`❌ ${file}: ${result.issues.length} issues found`);
                    result.issues.forEach(issue => {
                        console.error(`  - ${issue.message}`);
                        if (issue.snippet) {
                            console.error(`    ${issue.snippet}`);
                        }

                        // Add more detailed location information if available
                        if (issue.lineMatches) {
                            issue.lineMatches.forEach(match => {
                                console.error(`    Line ${match.lineNumber}: ${match.content}`);
                                console.error(`    Context:\n${match.surroundingCode}`);
                            });
                        }
                    });
                }
            } else {
                filesPassed++;
                if (verbose) {
                    console.log(`✅ ${file}: No issues found`);
                }
            }

            results.push(result);
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        if (verbose || filesWithIssues > 0) {
            console.log(`\n=== HTML Validation Summary ===`);
            console.log(`Total files checked: ${files.length}`);
            console.log(`Files with no issues: ${filesPassed}`);
            console.log(`Files with issues: ${filesWithIssues}`);

            const status = allValid ? '✅ PASSED' : '❌ FAILED';
            console.log(`Overall validation: ${status}`);

            if (isPostTransform) {
                console.log(`⏱️ Validation completed in ${duration} seconds`);
                console.log(`======================================================\n`);
            }
        }

        return {
            allValid,
            totalFiles: files.length,
            filesPassed,
            filesWithIssues,
            filesFailed,
            results
        };

    } catch (error) {
        console.error('Error validating HTML directory:', error);
        return {
            allValid: false,
            totalFiles: 0,
            filesPassed: 0,
            filesWithIssues: 0,
            filesFailed: 0,
            error: error.message
        };
    }
}

/**
 * Ensures there's a blank line between the timestamp comment and doctype declaration
 * @param {string} content - HTML content to process
 * @returns {string} - Updated HTML content
 */
function ensureBlankLineAfterTimestamp(content) {
    // Check if there's a timestamp comment followed immediately by doctype with no blank line
    if (content.includes('<!-- Last updated:')) {
        // Use regex to find timestamp comment followed directly by doctype
        const timestampRegex = /(<!-- Last updated:.*? -->)(\s*)(<!(DOCTYPE|doctype) html>)/i;

        // Check if the pattern is found
        if (timestampRegex.test(content)) {
            // Insert a proper newline between timestamp comment and doctype
            content = content.replace(timestampRegex, '$1\n$3');
        }
    }
    return content;
}

/**
 * Updates HTML comment timestamps in files
 * @param {string} dirPath - Path to directory containing HTML files
 * @param {Object} options - Options object
 * @returns {Object} - Object with update results
 */
async function updateHtmlTimestamps(dirPath, { recursive = true, verbose = false } = {}) {
    const startTime = Date.now();

    try {
        const pattern = recursive ? '**/*.html' : '*.html';
        const files = await glob(pattern, { cwd: dirPath });

        if (verbose) {
            console.log(`\n====== UPDATING HTML TIMESTAMPS ======`);
            console.log(`🕒 Starting timestamp updates at: ${new Date().toLocaleTimeString()}`);
            console.log(`Found ${files.length} HTML files to update in ${dirPath}`);
        }

        let updatedFiles = 0;
        let addedTimestamps = 0;
        let blankLinesAdded = 0;
        const currentDate = new Date();

        // Create human-readable timestamp for HTML comments
        const humanReadableDate = currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const humanReadableTime = currentDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const humanReadableTimestamp = `${humanReadableDate} at ${humanReadableTime}`;

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            let content;

            try {
                content = await fs.promises.readFile(filePath, 'utf8');
                let originalContent = content;

                // Look for HTML comment timestamp patterns
                const timestampRegex = /<!-- Last updated:.*?-->/g;

                if (content.match(timestampRegex)) {
                    // Update existing timestamp comments
                    content = content.replace(
                        timestampRegex,
                        `<!-- Last updated: ${humanReadableTimestamp} -->`
                    );
                } else {
                    // Add timestamp comment if it doesn't exist
                    const doctypeRegex = /(<!(DOCTYPE|doctype) html>)/i;
                    if (doctypeRegex.test(content)) {
                        content = content.replace(
                            doctypeRegex,
                            `<!-- Last updated: ${humanReadableTimestamp} -->\n$1`
                        );
                    } else {
                        // If no doctype found, just add to beginning of file
                        content = `<!-- Last updated: ${humanReadableTimestamp} -->\n${content}`;
                    }
                    addedTimestamps++;
                }

                // Ensure there's a blank line between timestamp comment and doctype
                const contentBeforeBlankLine = content;
                content = ensureBlankLineAfterTimestamp(content);

                if (content !== contentBeforeBlankLine) {
                    blankLinesAdded++;
                    if (verbose) {
                        console.log(`✅ Added blank line after timestamp in: ${file}`);
                    }
                }

                // Only write to file if content has changed
                if (content !== originalContent) {
                    await fs.promises.writeFile(filePath, content, 'utf8');
                    updatedFiles++;

                    if (verbose) {
                        if (content !== contentBeforeBlankLine) {
                            console.log(`✅ Updated timestamp and formatting in: ${file}`);
                        } else if (originalContent.includes('<!-- Last updated:')) {
                            console.log(`✅ Updated timestamp in: ${file}`);
                        } else {
                            console.log(`✅ Added timestamp to: ${file}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error updating timestamp in ${file}: ${error.message}`);
            }
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        if (verbose || updatedFiles > 0) {
            console.log(`\n=== HTML Timestamp Update Summary ===`);
            console.log(`Total files checked: ${files.length}`);
            console.log(`Files with updated timestamps: ${updatedFiles - addedTimestamps}`);
            console.log(`Files with timestamps added: ${addedTimestamps}`);
            console.log(`Files with blank lines added: ${blankLinesAdded}`);
            console.log(`⏱️ Update completed in ${duration} seconds`);
            console.log(`======================================\n`);
        }

        return {
            success: true,
            totalFiles: files.length,
            updatedFiles,
            blankLinesAdded
        };

    } catch (error) {
        console.error('Error updating HTML timestamps:', error);
        return {
            success: false,
            totalFiles: 0,
            updatedFiles: 0,
            blankLinesAdded: 0,
            error: error.message
        };
    }
}

/**
 * Updates version timestamps in CSS files
 * @param {string} dirPath - Path to directory containing CSS files
 * @param {Object} options - Options object
 * @returns {Object} - Object with update results
 */
async function updateCssVersions(dirPath, { recursive = true, verbose = false } = {}) {
    const startTime = Date.now();

    try {
        const pattern = recursive ? '**/*.css' : '*.css';
        const files = await glob(pattern, { cwd: dirPath });

        if (verbose) {
            console.log(`\n====== UPDATING CSS VERSION TIMESTAMPS ======`);
            console.log(`🕒 Starting CSS version updates at: ${new Date().toLocaleTimeString()}`);
            console.log(`Found ${files.length} CSS files to check in ${dirPath}`);
        }

        let updatedFiles = 0;
        const currentDate = new Date();

        // Format: YYYY-MM-DD-vX where X is incremented
        const dateString = currentDate.toISOString().slice(0, 10);

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            let content;

            try {
                content = await fs.promises.readFile(filePath, 'utf8');

                // Look for version timestamp patterns in CSS files
                // This matches patterns like: * Version: 2024-03-11-v1
                const versionRegex = /(\/\*[\s\S]*?Version:[\s]*)([\d]{4}-[\d]{2}-[\d]{2})-v(\d+)([\s\S]*?\*\/)/;
                const match = content.match(versionRegex);

                if (match) {
                    const existingDate = match[2];
                    const existingVersion = parseInt(match[3], 10);

                    // Only update if the file has been modified (date changed)
                    // If the date is the same as today, increment the version number
                    let newVersion = existingVersion;

                    if (existingDate === dateString) {
                        // Same day, increment version
                        newVersion = existingVersion + 1;
                    } else {
                        // New day, reset to version 1
                        newVersion = 1;
                    }

                    // Replace with new date and version
                    const updatedContent = content.replace(
                        versionRegex,
                        `$1${dateString}-v${newVersion}$4`
                    );

                    if (updatedContent !== content) {
                        await fs.promises.writeFile(filePath, updatedContent, 'utf8');
                        updatedFiles++;

                        if (verbose) {
                            console.log(`✅ Updated version in: ${file} to ${dateString}-v${newVersion}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error updating version in ${file}: ${error.message}`);
            }
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        if (verbose || updatedFiles > 0) {
            console.log(`\n=== CSS Version Update Summary ===`);
            console.log(`Total files checked: ${files.length}`);
            console.log(`Files with updated versions: ${updatedFiles}`);
            console.log(`⏱️ Update completed in ${duration} seconds`);
            console.log(`===================================\n`);
        }

        return {
            success: true,
            totalFiles: files.length,
            updatedFiles
        };

    } catch (error) {
        console.error('Error updating CSS versions:', error);
        return {
            success: false,
            totalFiles: 0,
            updatedFiles: 0,
            error: error.message
        };
    }
}

// Run validation and timestamp updates if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const dirPath = process.argv[2] || './danrtzaq/public_html';
    const options = {
        recursive: !process.argv.includes('--no-recursive'),
        verbose: !process.argv.includes('--quiet')
    };

    const isSourceValidation = !dirPath.includes('build/temp');
    const isPostTransform = dirPath.includes('build/temp');

    console.log(`
=======================================
HTML Validation and Timestamp Update Tool
=======================================
${isPostTransform ? '🔄 POST-TRANSFORMATION VALIDATION' : '🔍 INITIAL VALIDATION'}
Checking: ${dirPath}
Options: ${JSON.stringify(options, null, 2)}
`);

    validateHtmlDirectory(dirPath, options).then(results => {
        // Only update timestamps if validation succeeds and this is source validation
        if (results.allValid && isSourceValidation) {
            console.log('✅ HTML validation successful, updating timestamps...');

            // Update timestamps in HTML files
            return Promise.all([
                updateHtmlTimestamps(dirPath, options),
                updateCssVersions(path.join(dirPath, 'styles'), options)
            ]).then(([htmlResults, cssResults]) => {
                console.log(`✅ Updated timestamps in ${htmlResults.updatedFiles} HTML files and ${cssResults.updatedFiles} CSS files`);
                process.exit(0);
            });
        } else if (results.allValid) {
            console.log('✅ HTML validation successful');
            process.exit(0);
        } else {
            console.error('❌ HTML validation failed');
            console.log('Please fix the reported HTML issues manually');
            process.exit(1);
        }
    }).catch(err => {
        console.error('Error running validation:', err);
        process.exit(1);
    });
}

export { validateHtmlFile, validateHtmlDirectory, updateHtmlTimestamps, updateCssVersions };