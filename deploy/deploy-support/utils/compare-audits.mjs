#!/usr/bin/env node

/**
 * Site Audit Comparison Tool
 * 
 * This script compares metrics from multiple site audit reports to track changes over time.
 * It extracts key metrics like image counts, video counts, word counts, and page counts
 * from audit log files and displays them in a tabular format for easy comparison.
 * 
 * Usage: 
 * - Compare latest with previous: node compare-audits.mjs
 * - Compare specific audits: node compare-audits.mjs path/to/audit1.txt path/to/audit2.txt
 * - Compare last N audits: node compare-audits.mjs --last=3
 * - Set current audit as baseline: node compare-audits.mjs --set-baseline
 * - List baseline audits: node compare-audits.mjs --list-baselines
 * - Clear all baselines: node compare-audits.mjs --clear-baselines
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color constants for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m'
};

// Default audit logs directory
const DEFAULT_LOGS_DIR = path.join(__dirname, '../../../../logs/audit');
// Baseline configuration file
const BASELINE_CONFIG_PATH = path.join(__dirname, '../../../../logs/audit/baseline-audits.json');

/**
 * Load baseline configuration
 * @returns {object} Baseline configuration
 */
function loadBaselineConfig() {
    try {
        if (fs.existsSync(BASELINE_CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(BASELINE_CONFIG_PATH, 'utf8'));
            return config || { baselines: [] };
        }
    } catch (error) {
        console.error(`Error loading baseline config: ${error.message}`);
    }
    return { baselines: [] };
}

/**
 * Save baseline configuration
 * @param {object} config Baseline configuration to save
 */
function saveBaselineConfig(config) {
    try {
        const dir = path.dirname(BASELINE_CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(BASELINE_CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error(`Error saving baseline config: ${error.message}`);
    }
}

/**
 * Set an audit file as a baseline
 * @param {string} filePath Path to the audit file
 * @param {string} [label] Optional label for the baseline
 */
function setBaseline(filePath, label = '') {
    const config = loadBaselineConfig();
    const absolutePath = path.resolve(filePath);

    // Check if already a baseline
    const existing = config.baselines.find(b => b.path === absolutePath);
    if (existing) {
        if (label && !existing.label) {
            existing.label = label;
            console.log(`Updated baseline label for ${path.basename(filePath)} to "${label}"`);
        } else {
            console.log(`${path.basename(filePath)} is already a baseline${existing.label ? ` labeled "${existing.label}"` : ''}`);
        }
    } else {
        const date = extractDate(filePath);
        const baselineEntry = {
            path: absolutePath,
            date,
            label: label || `Baseline ${date}`,
            setAt: new Date().toISOString()
        };
        config.baselines.push(baselineEntry);
        console.log(`Set ${path.basename(filePath)} as a baseline${label ? ` labeled "${label}"` : ''}`);
    }

    saveBaselineConfig(config);
}

/**
 * List all baseline audits
 */
function listBaselines() {
    const config = loadBaselineConfig();
    if (config.baselines.length === 0) {
        console.log('No baseline audits set.');
        return;
    }

    console.log(`\n${colors.bright}BASELINE AUDITS${colors.reset}`);
    config.baselines.forEach((baseline, index) => {
        const filename = path.basename(baseline.path);
        console.log(`${index + 1}. ${colors.yellow}${filename}${colors.reset}`);
        console.log(`   Label: ${baseline.label || 'None'}`);
        console.log(`   Date: ${baseline.date}`);
        console.log(`   Set on: ${new Date(baseline.setAt).toLocaleString()}`);
    });
}

/**
 * Clear all baseline audits
 */
function clearBaselines() {
    saveBaselineConfig({ baselines: [] });
    console.log('All baseline audits cleared.');
}

/**
 * Parse metrics from a site audit log file
 * @param {string} filePath Path to the audit log file
 * @returns {object} Extracted metrics
 */
function parseAuditLog(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const metrics = {
            date: extractDate(filePath),
            totalImages: extractNumber(content, 'Total Images: (\\d+)'),
            totalVideos: extractNumber(content, 'Total Videos: (\\d+)'),
            totalWords: extractNumber(content, 'Total Words: (\\d+)'),
            totalCharacters: extractNumber(content, 'Total Characters: (\\d+)'),
            totalPages: extractNumber(content, '(\\d+) PAGES'),
            imageTypes: {},
            videoTypes: {},
            pageCategories: {}
        };

        // Extract image types
        const imageSection = extractSection(content, 'IMAGES SUMMARY', 'VIDEOS SUMMARY');
        const imageTypeMatches = [...imageSection.matchAll(/(PNG|WEBP|SVG|JPEG|JPG|GIF): (\d+)/g)];
        if (imageTypeMatches) {
            imageTypeMatches.forEach(match => {
                metrics.imageTypes[match[1]] = parseInt(match[2], 10);
            });
        }

        // Extract video types
        const videoSection = extractSection(content, 'VIDEOS SUMMARY', 'TEXT CONTENT SUMMARY');
        const videoTypeMatches = [...videoSection.matchAll(/(MP4|WEBM|MOV|AVI): (\d+)/g)];
        if (videoTypeMatches) {
            videoTypeMatches.forEach(match => {
                metrics.videoTypes[match[1]] = parseInt(match[2], 10);
            });
        }

        // Extract page categories
        const pageSection = extractSection(content, 'PAGES:', 'PORTFOLIO PAGES BY COMPANY');
        const pageCategoryMatches = [...pageSection.matchAll(/(\d+) (\w+)/g)];
        if (pageCategoryMatches) {
            pageCategoryMatches.forEach(match => {
                metrics.pageCategories[match[2]] = parseInt(match[1], 10);
            });
        }

        return metrics;
    } catch (error) {
        console.error(`Error parsing audit log ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Extract a section of text between two markers
 * @param {string} content The full text content
 * @param {string} startMarker Text that marks the beginning of the section
 * @param {string} endMarker Text that marks the end of the section
 * @returns {string} The extracted section
 */
function extractSection(content, startMarker, endMarker) {
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) return '';

    const endIndex = content.indexOf(endMarker, startIndex);
    if (endIndex === -1) return content.substring(startIndex);

    return content.substring(startIndex, endIndex);
}

/**
 * Extract a number using regex
 * @param {string} content The content to search in
 * @param {string} pattern The regex pattern with a capture group for the number
 * @returns {number} The extracted number, or 0 if not found
 */
function extractNumber(content, pattern) {
    const match = content.match(new RegExp(pattern));
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extract date from filename
 * @param {string} filePath The path to the audit log file
 * @returns {string} The extracted date in format "YYYY-MM-DD HH:MM:SS"
 */
function extractDate(filePath) {
    const filename = path.basename(filePath);
    const match = filename.match(/site-audit-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.txt/);
    if (match) {
        const dateStr = match[1].replace(/-/g, ':');
        return dateStr.replace(/^(\d{4}):(\d{2}):(\d{2}):/, '$1-$2-$3 ');
    }
    return path.basename(filePath);
}

/**
 * Get a list of audit log files sorted by date (most recent first)
 * @param {string} directory The directory to scan for audit logs
 * @param {boolean} includeBaselines Whether to include baseline audits in the result
 * @param {number} limit Maximum number of files to return (0 for all)
 * @returns {string[]} Array of sorted file paths
 */
function getAuditLogFiles(directory, includeBaselines = true, limit = 0) {
    try {
        let files = fs.readdirSync(directory)
            .filter(file => file.startsWith('site-audit-') && file.endsWith('.txt'))
            .map(file => ({
                name: file,
                path: path.join(directory, file),
                time: fs.statSync(path.join(directory, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time)
            .map(file => file.path);

        // Apply limit if specified
        if (limit > 0) {
            files = files.slice(0, limit);
        }

        // If including baselines and we want baseline + most recent only
        if (includeBaselines) {
            const baselineConfig = loadBaselineConfig();
            const baselinePaths = baselineConfig.baselines.map(b => b.path);

            if (baselinePaths.length > 0 && files.length > 0) {
                // If we have both a baseline and at least one regular audit,
                // keep only the most recent regular audit and add the baselines
                const mostRecent = files.slice(0, 1); // Only keep the most recent

                // Add baselines that aren't already in the list
                for (const baselinePath of baselinePaths) {
                    if (fs.existsSync(baselinePath) && !mostRecent.includes(baselinePath)) {
                        mostRecent.push(baselinePath);
                    }
                }

                return mostRecent;
            }

            // If there are no baselines, just return what we have
            // If we want to include all baselines, add them to the list
            for (const baselinePath of baselinePaths) {
                if (fs.existsSync(baselinePath) && !files.includes(baselinePath)) {
                    files.push(baselinePath);
                }
            }
        }

        return files;
    } catch (error) {
        console.error(`Error reading directory ${directory}:`, error.message);
        return [];
    }
}

/**
 * Format a date string
 * @param {string} dateStr Date string to format
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
    // Extract date and time parts from the dateStr
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (match) {
        // Get the hours to determine AM/PM
        const hours = parseInt(match[4], 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM

        // Return in format "MM/DD HH:MM AM/PM"
        return `${match[2]}/${match[3]} ${displayHours}:${match[5]} ${ampm}`;
    }

    // Fallback to just extracting date if full timestamp not available
    const datePart = dateStr.match(/\d{4}-(\d{2})-(\d{2})/);
    if (datePart) {
        return `${datePart[1]}/${datePart[2]}`;
    }

    // Ultimate fallback 
    return dateStr;
}

/**
 * Format a value with appropriate color based on comparison with baseline
 * @param {number} current The current value
 * @param {number} previous The previous value to compare with
 * @param {boolean} isBaseline Whether this value is from a baseline
 * @param {boolean} compareToPrevious Whether to compare to previous value (old behavior)
 * @returns {string} Formatted value with color
 */
function formatComparedValue(current, previous, isBaseline = false, compareToPrevious = false) {
    // For baseline metrics, just display without comparison indicators
    if (isBaseline) {
        return `${colors.bright}${current}${colors.reset}`;
    }

    // For current metrics, compare with baseline
    if (previous === undefined || current === previous) {
        return `${colors.bright}${current}${colors.reset}`;
    } else if (current > previous) {
        // Current value is GREATER than baseline - using blue instead of green
        return `${colors.blue}${current} (+${current - previous})${colors.reset}`;
    } else {
        // Current value is LESS than baseline - using magenta instead of red
        return `${colors.magenta}${current} (-${previous - current})${colors.reset}`;
    }
}

/**
 * Check if a file is a baseline audit
 * @param {string} filePath The path to check
 * @returns {object|null} Baseline info if it's a baseline, null otherwise
 */
function getBaselineInfo(filePath) {
    const config = loadBaselineConfig();
    const absolutePath = path.resolve(filePath);
    return config.baselines.find(b => b.path === absolutePath) || null;
}

/**
 * Generate a comparison table for metrics
 * @param {object[]} metricsArray Array of metric objects to compare
 */
function generateComparisonTable(metricsArray) {
    if (metricsArray.length === 0) {
        console.error('No metrics to compare.');
        return;
    }

    // Find baseline metrics for comparison
    const baseline = metricsArray.find(m => m._isBaseline) || metricsArray[metricsArray.length - 1];

    // Header - keeping just the title
    console.log(`\n${colors.bright}${colors.bgBlue}${colors.white} SITE AUDIT COMPARISON ${colors.reset}`);

    // Column headers with baseline label above date
    const columnHeaders = [];
    metricsArray.forEach(metrics => {
        const isBaseline = !!metrics._isBaseline;
        if (isBaseline) {
            columnHeaders.push(`${colors.white}BASELINE`);
        } else {
            columnHeaders.push(`CURRENT`);
        }
    });

    // Print column headers first (removing "CONTENT SUMMARY" header)
    console.log(); // Just an empty line for spacing
    process.stdout.write(`${' '.repeat(10)}`);
    columnHeaders.forEach((header, index) => {
        // Left align headers with their columns
        process.stdout.write(`${header}${colors.reset}${' '.repeat(20 - header.replace(/\x1b\[\d+m/g, '').length)}`);
    });
    console.log();

    // Date header row - align with other rows
    process.stdout.write(`${colors.dim}Date${colors.reset}      `);
    metricsArray.forEach(metrics => {
        // Format date with AM/PM and left align with column
        let formattedDate = formatDate(metrics.date);
        process.stdout.write(`${formattedDate}${' '.repeat(20 - formattedDate.length)}`);
    });
    console.log();

    // Pages
    process.stdout.write(`${colors.dim}Pages${colors.reset}     `);
    metricsArray.forEach(metrics => {
        const isBaseline = !!metrics._isBaseline;
        const comparisonValue = isBaseline ? undefined : baseline.totalPages;
        const formattedValue = formatComparedValue(metrics.totalPages, comparisonValue, isBaseline);
        process.stdout.write(`${formattedValue}${' '.repeat(20 - formattedValue.replace(/\x1b\[\d+m/g, '').length)}`);
    });
    console.log();

    // Images
    process.stdout.write(`${colors.dim}Images${colors.reset}    `);
    metricsArray.forEach(metrics => {
        const isBaseline = !!metrics._isBaseline;
        const comparisonValue = isBaseline ? undefined : baseline.totalImages;
        const formattedValue = formatComparedValue(metrics.totalImages, comparisonValue, isBaseline);
        process.stdout.write(`${formattedValue}${' '.repeat(20 - formattedValue.replace(/\x1b\[\d+m/g, '').length)}`);
    });
    console.log();

    // Videos
    process.stdout.write(`${colors.dim}Videos${colors.reset}    `);
    metricsArray.forEach(metrics => {
        const isBaseline = !!metrics._isBaseline;
        const comparisonValue = isBaseline ? undefined : baseline.totalVideos;
        const formattedValue = formatComparedValue(metrics.totalVideos, comparisonValue, isBaseline);
        process.stdout.write(`${formattedValue}${' '.repeat(20 - formattedValue.replace(/\x1b\[\d+m/g, '').length)}`);
    });
    console.log();

    // Words
    process.stdout.write(`${colors.dim}Words${colors.reset}     `);
    metricsArray.forEach(metrics => {
        const isBaseline = !!metrics._isBaseline;
        const comparisonValue = isBaseline ? undefined : baseline.totalWords;
        const formattedValue = formatComparedValue(metrics.totalWords, comparisonValue, isBaseline);
        process.stdout.write(`${formattedValue}${' '.repeat(20 - formattedValue.replace(/\x1b\[\d+m/g, '').length)}`);
    });
    console.log();

    // Characters
    process.stdout.write(`${colors.dim}Chars${colors.reset}     `);
    metricsArray.forEach(metrics => {
        const isBaseline = !!metrics._isBaseline;
        const comparisonValue = isBaseline ? undefined : baseline.totalCharacters;
        const formattedValue = formatComparedValue(metrics.totalCharacters, comparisonValue, isBaseline);
        process.stdout.write(`${formattedValue}${' '.repeat(20 - formattedValue.replace(/\x1b\[\d+m/g, '').length)}`);
    });
    console.log();

    // Image types section - only show if there are image types to display
    const allImageTypes = new Set();
    metricsArray.forEach(metrics => {
        Object.keys(metrics.imageTypes).forEach(type => allImageTypes.add(type));
    });

    if (allImageTypes.size > 0) {
        console.log(`${colors.bright}IMAGE TYPES${colors.reset}`);
        Array.from(allImageTypes).sort().forEach(type => {
            process.stdout.write(`${colors.dim}${type.padEnd(8)}${colors.reset} `);
            metricsArray.forEach(metrics => {
                const isBaseline = !!metrics._isBaseline;
                const current = metrics.imageTypes[type] || 0;
                const comparisonValue = isBaseline ? undefined : (baseline.imageTypes[type] || 0);
                const formattedValue = formatComparedValue(current, comparisonValue, isBaseline);
                // Add proper spacing between columns
                const padding = isBaseline ? 20 : 10;
                process.stdout.write(`${formattedValue}${' '.repeat(Math.max(1, padding - String(current).length))}  `);
            });
            console.log();
        });
        console.log();
    }

    // Video types section - only show if there are video types to display
    const allVideoTypes = new Set();
    metricsArray.forEach(metrics => {
        Object.keys(metrics.videoTypes).forEach(type => allVideoTypes.add(type));
    });

    if (allVideoTypes.size > 0) {
        console.log(`${colors.bright}VIDEO TYPES${colors.reset}`);
        Array.from(allVideoTypes).sort().forEach(type => {
            process.stdout.write(`${colors.dim}${type.padEnd(8)}${colors.reset} `);
            metricsArray.forEach(metrics => {
                const isBaseline = !!metrics._isBaseline;
                const current = metrics.videoTypes[type] || 0;
                const comparisonValue = isBaseline ? undefined : (baseline.videoTypes[type] || 0);
                const formattedValue = formatComparedValue(current, comparisonValue, isBaseline);
                // Add proper spacing between columns
                const padding = isBaseline ? 20 : 10;
                process.stdout.write(`${formattedValue}${' '.repeat(Math.max(1, padding - String(current).length))}  `);
            });
            console.log();
        });
        console.log();
    }

    // Page categories section - only show if there are categories to display
    const allCategories = new Set();
    metricsArray.forEach(metrics => {
        Object.keys(metrics.pageCategories).forEach(category => allCategories.add(category));
    });

    if (allCategories.size > 0) {
        console.log(`${colors.bright}PAGE CATEGORIES${colors.reset}`);
        Array.from(allCategories).sort().forEach(category => {
            process.stdout.write(`${colors.dim}${category.padEnd(8)}${colors.reset} `);
            metricsArray.forEach(metrics => {
                const isBaseline = !!metrics._isBaseline;
                const current = metrics.pageCategories[category] || 0;
                const comparisonValue = isBaseline ? undefined : (baseline.pageCategories[category] || 0);
                const formattedValue = formatComparedValue(current, comparisonValue, isBaseline);
                // Add proper spacing between columns
                const padding = isBaseline ? 20 : 10;
                process.stdout.write(`${formattedValue}${' '.repeat(Math.max(1, padding - String(current).length))}  `);
            });
            console.log();
        });
    }
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);
    let auditFiles = [];
    let lastCount = 1; // Default to just compare the latest audit (changed from 3)

    // Check for --list-baselines flag
    if (args.includes('--list-baselines')) {
        listBaselines();
        return;
    }

    // Check for --clear-baselines flag
    if (args.includes('--clear-baselines')) {
        clearBaselines();
        return;
    }

    // Check for --set-baseline flag
    if (args.includes('--set-baseline')) {
        const labelArg = args.find(arg => arg.startsWith('--label='));
        const label = labelArg ? labelArg.split('=')[1] : '';

        // Get the most recent audit file
        const recentAudits = getAuditLogFiles(DEFAULT_LOGS_DIR, false, 1);
        if (recentAudits.length === 0) {
            console.error('No audit files found to set as baseline.');
            process.exit(1);
        }

        setBaseline(recentAudits[0], label);
        return;
    }

    // Check for --last=N flag
    const lastArg = args.find(arg => arg.startsWith('--last='));
    if (lastArg) {
        lastCount = parseInt(lastArg.split('=')[1], 10);
        if (isNaN(lastCount) || lastCount < 1) {
            console.error('Invalid --last value, must be a positive integer');
            process.exit(1);
        }
    }

    // Check for explicit file paths
    const filePaths = args.filter(arg => !arg.startsWith('--'));
    if (filePaths.length > 0) {
        auditFiles = filePaths.filter(file => fs.existsSync(file));
        if (auditFiles.length === 0) {
            console.error('No valid audit files found.');
            process.exit(1);
        }
    } else {
        // Get the audit files (including baselines)
        auditFiles = getAuditLogFiles(DEFAULT_LOGS_DIR, true, lastCount);
        if (auditFiles.length === 0) {
            console.error(`No audit files found in ${DEFAULT_LOGS_DIR}`);
            process.exit(1);
        }
    }

    // Parse metrics from each audit file
    const metrics = auditFiles.map(file => {
        const parsedMetrics = parseAuditLog(file);
        if (parsedMetrics) {
            // Mark if this is a baseline audit
            const baselineInfo = getBaselineInfo(file);
            if (baselineInfo) {
                parsedMetrics._isBaseline = true;
                parsedMetrics._baselineLabel = baselineInfo.label;
            }
        }
        return parsedMetrics;
    }).filter(Boolean);

    // Reverse the order so newest audit appears last (on the right)
    metrics.reverse();

    // Generate comparison table
    generateComparisonTable(metrics);

    // Show which metrics are baselines in the summary
    const baselineCount = metrics.filter(m => m._isBaseline).length;
    if (baselineCount > 0) {
        console.log(`\nCompared ${metrics.length} audit report${metrics.length === 1 ? '' : 's'} (including ${baselineCount} baseline${baselineCount === 1 ? '' : 's'}).`);
    } else {
        console.log(`\nCompared ${metrics.length} audit report${metrics.length === 1 ? '' : 's'}.`);
    }
}

// Run the main function
main();