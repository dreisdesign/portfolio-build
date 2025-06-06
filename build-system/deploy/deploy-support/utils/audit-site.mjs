#!/usr/bin/env node

/**
 * Site Audit Tool
 * 
 * This script analyzes a built site directory to generate reports on:
 * - Image assets by type (PNG, WebP, SVG, etc.)
 * - Video assets by type (MP4, WebM, etc.)
 * - Word and character counts for each page
 * - Overall site statistics
 * 
 * Usage: node audit-site.mjs [directory]
 * Example: node audit-site.mjs build/temp/public_html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const config = {
    // Extensions to scan
    imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'],
    // Video extensions to scan
    videoExtensions: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'],
    // Files to ignore
    ignoreFiles: ['.DS_Store', 'Thumbs.db', '.gitkeep'],
    // Directories to ignore
    ignoreDirs: ['node_modules', '.git'],
    // File types to analyze for text content
    textContentTypes: ['.html']
};

// Color constants for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m'
};

// Baseline audit data
let baselineData = null;
// Baseline configuration file
const BASELINE_CONFIG_PATH = path.join(__dirname, '../../../../logs/audit/baseline-audits.json');

// Main stats object to store all collected data
const siteStats = {
    images: {
        total: 0,
        byType: {}
    },
    videos: {
        total: 0,
        byType: {},
        totalSize: 0
    },
    text: {
        totalWords: 0,
        totalCharacters: 0
    },
    pages: [],
    pageCategories: {}
};

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
 * Load baseline data from the baseline audit file
 */
function loadBaselineData() {
    try {
        const config = loadBaselineConfig();
        if (config.baselines.length > 0) {
            const baselinePath = config.baselines[0].path;
            if (fs.existsSync(baselinePath)) {
                const content = fs.readFileSync(baselinePath, 'utf8');
                const pageData = {};

                // Parse page data from baseline file
                const pageDetailSection = content.split('PAGES DETAIL')[1] || '';
                const pageBlocks = pageDetailSection.split(/Page\s+\d+:/);

                for (const block of pageBlocks) {
                    if (!block.trim()) continue;

                    const lines = block.trim().split('\n');
                    const relativePath = lines[0].trim();
                    let wordCount = 0;
                    let charCount = 0;

                    for (const line of lines) {
                        const wordMatch = line.match(/Word Count: (\d+)/);
                        if (wordMatch) {
                            wordCount = parseInt(wordMatch[1], 10);
                        }

                        const charMatch = line.match(/Character Count: (\d+)/);
                        if (charMatch) {
                            charCount = parseInt(charMatch[1], 10);
                        }
                    }

                    pageData[relativePath] = { wordCount, charCount };
                }

                baselineData = pageData;
            }
        }
    } catch (error) {
        console.error(`Error loading baseline data: ${error.message}`);
    }
}

/**
 * Counts words in a given text string
 * @param {string} text The text to count words in
 * @returns {number} The word count
 */
function countWords(text) {
    // Remove HTML tags, normalize whitespace, and count words
    text = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(' ').length : 0;
}

/**
 * Formats a file size in bytes to a human-readable format
 * @param {number} bytes The size in bytes
 * @returns {string} The formatted size
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Analyzes an HTML file to extract text statistics
 * @param {string} filePath The path to the HTML file
 * @returns {object} Statistics about the file
 */
function analyzeHtmlFile(filePath) {
    try {
        const html = fs.readFileSync(filePath, 'utf8');

        // Extract title using regex
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath);

        // Extract description using regex
        const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';

        // Extract body content to count words
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const bodyContent = bodyMatch ? bodyMatch[1] : html;

        // Remove scripts and styles for word counting
        const textContent = bodyContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Count images in the file using regex
        const imgMatches = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
        const images = [];

        for (const imgTag of imgMatches) {
            const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
            if (srcMatch && srcMatch[1]) {
                const src = srcMatch[1];
                // Strip cache busters from extension
                const extension = path.extname(src.split('?')[0]).toLowerCase();
                images.push({
                    src: src,
                    type: extension.substring(1) || 'unknown'
                });
            }
        }

        // Count videos in the file using regex
        const videoMatches = html.match(/<video[^>]*>[\s\S]*?<\/video>/gi) || [];
        const videos = [];

        // Find video sources in video tags
        for (const videoTag of videoMatches) {
            const sourceMatches = videoTag.match(/<source[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];

            for (const sourceTag of sourceMatches) {
                const srcMatch = sourceTag.match(/src=["']([^"']+)["']/i);
                if (srcMatch && srcMatch[1]) {
                    const src = srcMatch[1];
                    // Strip cache busters from extension
                    const extension = path.extname(src.split('?')[0]).toLowerCase();
                    videos.push({
                        src: src,
                        type: extension.substring(1) || 'unknown'
                    });
                }
            }
        }

        // Also check for video source attributes directly on video tags
        const directVideoSrcMatches = html.match(/<video[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
        for (const videoTag of directVideoSrcMatches) {
            const srcMatch = videoTag.match(/src=["']([^"']+)["']/i);
            if (srcMatch && srcMatch[1]) {
                const src = srcMatch[1];
                // Strip cache busters from extension
                const extension = path.extname(src.split('?')[0]).toLowerCase();
                videos.push({
                    src: src,
                    type: extension.substring(1) || 'unknown'
                });
            }
        }

        // Count words and characters
        const wordCount = countWords(textContent);
        const charCount = textContent.length;

        // Add to global totals
        siteStats.text.totalWords += wordCount;
        siteStats.text.totalCharacters += charCount;

        // Determine page category based on path
        const relativePath = filePath.split('public_html/').pop() || filePath;
        let category = 'Other';
        let companyCategory = 'N/A';

        if (relativePath === 'index.html') {
            category = 'Homepage';
        } else if (relativePath === '404.html') {
            category = 'Error';
        } else if (relativePath.startsWith('about/')) {
            category = 'About';
        } else if (relativePath.startsWith('portfolio/')) {
            category = 'Portfolio';

            // Extract company name from portfolio path
            const pathParts = relativePath.split('/');
            if (pathParts.length > 1) {
                const possibleCompany = pathParts[1];
                if (possibleCompany && possibleCompany !== 'index.html' && possibleCompany !== 'portfolio-company-template') {
                    // Capitalize company name
                    companyCategory = possibleCompany.charAt(0).toUpperCase() + possibleCompany.slice(1);
                } else if (possibleCompany === 'portfolio-company-template') {
                    companyCategory = 'Template';
                }
            }
        } else if (relativePath.startsWith('legal/')) {
            category = 'Legal';
        } else if (relativePath.startsWith('blog/')) {
            category = 'Blog';
        }

        // Increment the category count
        if (!siteStats.pageCategories[category]) {
            siteStats.pageCategories[category] = 0;
        }
        siteStats.pageCategories[category]++;

        // Increment the company category count if it's a portfolio page
        if (category === 'Portfolio' && companyCategory !== 'N/A') {
            if (!siteStats.companyCategories) {
                siteStats.companyCategories = {};
            }
            if (!siteStats.companyCategories[companyCategory]) {
                siteStats.companyCategories[companyCategory] = 0;
            }
            siteStats.companyCategories[companyCategory]++;
        }

        return {
            path: filePath,
            title: title,
            description: description,
            wordCount: wordCount,
            charCount: charCount,
            images: images,
            videos: videos,
            category: category,
            company: companyCategory
        };
    } catch (error) {
        console.error(`Error analyzing ${filePath}: ${error.message}`);
        return {
            path: filePath,
            error: error.message,
            wordCount: 0,
            charCount: 0,
            images: [],
            videos: [],
            category: 'Error',
            company: 'N/A'
        };
    }
}

/**
 * Recursively scans a directory to collect statistics
 * @param {string} dir The directory to scan
 */
function scanDirectory(dir) {
    try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            if (config.ignoreFiles.includes(item)) continue;

            const itemPath = path.join(dir, item);
            const itemStats = fs.statSync(itemPath);

            if (itemStats.isDirectory()) {
                if (config.ignoreDirs.includes(item)) continue;
                scanDirectory(itemPath);
            } else {
                const extension = path.extname(itemPath).toLowerCase();

                // Track image files
                if (config.imageExtensions.includes(extension)) {
                    // Add to total count
                    siteStats.images.total++;

                    // Add to type-specific count
                    const type = extension.substring(1); // Remove the leading dot
                    if (!siteStats.images.byType[type]) {
                        siteStats.images.byType[type] = 0;
                    }
                    siteStats.images.byType[type]++;
                }

                // Track video files
                if (config.videoExtensions.includes(extension)) {
                    // Add to total count
                    siteStats.videos.total++;

                    // Add to type-specific count
                    const type = extension.substring(1); // Remove the leading dot
                    if (!siteStats.videos.byType[type]) {
                        siteStats.videos.byType[type] = 0;
                    }
                    siteStats.videos.byType[type]++;

                    // Add to total size
                    siteStats.videos.totalSize += itemStats.size;
                }

                // Analyze HTML files for text content
                if (config.textContentTypes.includes(extension)) {
                    const pageStats = analyzeHtmlFile(itemPath);
                    siteStats.pages.push(pageStats);
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dir}: ${error.message}`);
    }
}

/**
 * Formats the collected statistics into a report
 * @returns {string} The formatted report
 */
function generateReport() {
    let report = '';

    // Header
    report += `${colors.bright}${colors.bgBlue}${colors.white} SITE AUDIT REPORT ${colors.reset}\n\n`;

    // Images summary
    report += `${colors.bright}${colors.green}IMAGES SUMMARY${colors.reset}\n`;
    report += `${colors.bright}Total Images: ${siteStats.images.total}${colors.reset}\n`;

    // Sort image types by count (descending)
    const sortedImageTypes = Object.entries(siteStats.images.byType)
        .sort((a, b) => b[1] - a[1]);

    for (const [type, count] of sortedImageTypes) {
        report += `${count} ${type.toUpperCase()}\n`;
    }
    report += '\n';

    // Videos summary
    report += `${colors.bright}${colors.yellow}VIDEOS SUMMARY${colors.reset}\n`;

    if (siteStats.videos.total > 0) {
        report += `${colors.bright}Total Videos: ${siteStats.videos.total}${colors.reset}\n`;
        report += `Total Video Size: ${formatBytes(siteStats.videos.totalSize)}\n`;

        // Sort video types by count (descending)
        const sortedVideoTypes = Object.entries(siteStats.videos.byType)
            .sort((a, b) => b[1] - a[1]);

        for (const [type, count] of sortedVideoTypes) {
            report += `${count} ${type.toUpperCase()}\n`;
        }
    } else {
        report += `No videos found on the site.\n`;
    }
    report += '\n';

    // Text summary
    report += `${colors.bright}${colors.green}TEXT CONTENT SUMMARY${colors.reset}\n`;
    report += `Total Words: ${siteStats.text.totalWords}\n`;
    report += `Total Characters: ${siteStats.text.totalCharacters}\n\n`;

    // Pages category summary (simplified)
    report += `${colors.bright}${colors.blue}${siteStats.pages.length} PAGES${colors.reset}\n`;

    // Sort categories by count (descending)
    const sortedCategories = Object.entries(siteStats.pageCategories)
        .sort((a, b) => b[1] - a[1]);

    for (const [category, count] of sortedCategories) {
        report += `${count} ${category.toLowerCase()}\n`;
    }
    report += '\n';

    // Add company categories section if there are portfolio pages
    if (siteStats.companyCategories && Object.keys(siteStats.companyCategories).length > 0) {
        report += `${colors.bright}${colors.yellow}PORTFOLIO PAGES BY COMPANY${colors.reset}\n`;

        // Sort companies by count (descending)
        const sortedCompanies = Object.entries(siteStats.companyCategories)
            .sort((a, b) => b[1] - a[1]);

        for (const [company, count] of sortedCompanies) {
            report += `${count} ${company}\n`;
        }
        report += '\n';
    }

    // Detailed pages listing
    report += `${colors.bright}${colors.green}PAGES DETAIL${colors.reset}\n`;

    // Sort pages by URL for consistent output
    const sortedPages = [...siteStats.pages].sort((a, b) => a.path.localeCompare(b.path));

    for (let i = 0; i < sortedPages.length; i++) {
        const page = sortedPages[i];
        const relativePath = page.path.split('public_html/').pop() || page.path;

        report += `${colors.bright}Page ${(i + 1).toString().padStart(2)}:${colors.reset}\n`;
        report += `${relativePath}\n`;

        // Format word count with color if it has changed from the baseline
        if (baselineData && baselineData[relativePath]) {
            const baselineWordCount = baselineData[relativePath].wordCount;
            if (page.wordCount > baselineWordCount) {
                report += `Word Count: ${colors.blue}${page.wordCount} (+${page.wordCount - baselineWordCount})${colors.reset}\n`;
            } else if (page.wordCount < baselineWordCount) {
                report += `Word Count: ${colors.magenta}${page.wordCount} (-${baselineWordCount - page.wordCount})${colors.reset}\n`;
            } else {
                report += `Word Count: ${page.wordCount}\n`;
            }

            // Format character count with color if it has changed from the baseline
            const baselineCharCount = baselineData[relativePath].charCount;
            if (page.charCount > baselineCharCount) {
                report += `Character Count: ${colors.blue}${page.charCount} (+${page.charCount - baselineCharCount})${colors.reset}\n`;
            } else if (page.charCount < baselineCharCount) {
                report += `Character Count: ${colors.magenta}${page.charCount} (-${baselineCharCount - page.charCount})${colors.reset}\n`;
            } else {
                report += `Character Count: ${page.charCount}\n`;
            }
        } else {
            // No baseline data available
            report += `Word Count: ${page.wordCount}\n`;
            report += `Character Count: ${page.charCount}\n`;
        }

        // Show company for portfolio pages
        if (page.category === 'Portfolio' && page.company !== 'N/A') {
            report += `Company: ${page.company}\n`;
        }

        // Count specific image types
        const svgCount = page.images.filter(img => img.type === 'svg').length;
        const pngCount = page.images.filter(img => img.type === 'png').length;
        const jpgCount = page.images.filter(img => img.type === 'jpg' || img.type === 'jpeg').length;
        const gifCount = page.images.filter(img => img.type === 'gif').length;
        const webpCount = page.images.filter(img => img.type === 'webp').length;

        // Display total images count with breakdown
        if (page.images.length > 0) {
            report += `${colors.bright}Total Images: ${page.images.length}${colors.reset}\n`;
            if (svgCount > 0) report += `${svgCount} SVG\n`;
            if (pngCount > 0) report += `${pngCount} PNG\n`;
            if (jpgCount > 0) report += `${jpgCount} JPEG\n`;
            if (gifCount > 0) report += `${gifCount} GIF\n`;
            if (webpCount > 0) report += `${webpCount} WebP\n`;
        } else {
            report += `${colors.bright}Total Images: 0${colors.reset}\n`;
        }

        // Display videos count with breakdown
        const videosByType = {};
        for (const video of page.videos) {
            if (!videosByType[video.type]) {
                videosByType[video.type] = 0;
            }
            videosByType[video.type]++;
        }

        if (Object.keys(videosByType).length > 0) {
            report += `${colors.bright}Total Videos: ${page.videos.length}${colors.reset}\n`;
            for (const [type, count] of Object.entries(videosByType)) {
                report += `${count} ${type.toUpperCase()}\n`;
            }
        } else {
            report += `${colors.bright}Total Videos: 0${colors.reset}\n`;
        }

        report += '\n';
    }

    return report;
}

/**
 * Main entry point
 */
function main() {
    console.log(`${colors.bright}Site Audit Tool${colors.reset}`);

    // Get directory from command line args or use default
    const args = process.argv.slice(2);
    const targetDir = args[0] || 'build/temp/public_html';

    // Resolve absolute path
    const absolutePath = path.isAbsolute(targetDir)
        ? targetDir
        : path.resolve(process.cwd(), targetDir);

    console.log(`Scanning directory: ${absolutePath}`);

    // Validate directory exists
    if (!fs.existsSync(absolutePath)) {
        console.error(`Error: Directory "${absolutePath}" does not exist.`);
        process.exit(1);
    }

    // Load baseline data for comparison
    loadBaselineData();

    // Scan the directory
    scanDirectory(absolutePath);

    // Generate and print the report
    const report = generateReport();
    console.log(report);

    // Save report to file
    const reportDir = path.join(process.cwd(), 'dev', 'logs', 'audit');

    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    // Format date for filename
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const reportFilename = `site-audit-${dateStr}-${timeStr}.txt`;
    const reportPath = path.join(reportDir, reportFilename);

    // Write report with ANSI color codes stripped
    const plainReport = report.replace(/\x1b\[\d+m/g, '');
    fs.writeFileSync(reportPath, plainReport);

    console.log(`\nReport saved to: ${reportPath}`);
}

// Run the main function
main();