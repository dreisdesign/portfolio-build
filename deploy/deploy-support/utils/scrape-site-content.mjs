#!/usr/bin/env node

/**
 * Website Content Scraper
 * 
 * This script crawls an entire website and extracts all text content
 * (meta descriptions, titles, headings, paragraphs, etc.)
 * and saves it to a single text file.
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import path from 'path';
import { URL } from 'url';
import { fileURLToPath } from 'url';

// Configuration
const BASE_URL = 'https://danreisdesign.com'; // Your actual domain
const LOG_DIR = '/Users/danielreis/web/danrtzaq/dev/logs/production-scrape';
// Get current date in YYYY-MM-DD-HH-MM-SS format for the filename
const now = new Date();
const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
const OUTPUT_FILE = `${LOG_DIR}/site-content-${dateStr}-${timeStr}.txt`;
const IGNORE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.css', '.js', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.pdf', '.zip', '.xml'];
const MAX_PAGES = 1000; // Set a limit to avoid infinite crawling

// Globals
const visitedUrls = new Set();
const pendingUrls = new Set();
let contentOutput = '';

async function main() {
    console.log(`Starting site scrape for ${BASE_URL}`);

    // Start with the homepage
    pendingUrls.add(BASE_URL);

    // Process all pages
    while (pendingUrls.size > 0 && visitedUrls.size < MAX_PAGES) {
        const url = pendingUrls.values().next().value;
        pendingUrls.delete(url);

        if (!visitedUrls.has(url)) {
            console.log(`Processing: ${url}`);

            try {
                const { links, content } = await scrapePage(url);
                visitedUrls.add(url);

                // Add content to output
                contentOutput += `\n\n=== ${url} ===\n\n${content}`;

                // Add new links to pending queue
                for (const link of links) {
                    if (!visitedUrls.has(link) && !pendingUrls.has(link)) {
                        pendingUrls.add(link);
                    }
                }
            } catch (error) {
                console.error(`Error scraping ${url}: ${error.message}`);
            }
        }
    }

    // Write output file
    await fs.writeFile(OUTPUT_FILE, contentOutput);
    console.log(`\nScraping complete!`);
    console.log(`Processed ${visitedUrls.size} pages`);
    console.log(`Content saved to: ${OUTPUT_FILE}`);
}

async function scrapePage(url) {
    // Fetch page content
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const pageContent = [];
    const links = new Set();

    // Extract metadata
    const metaTitle = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';

    pageContent.push(`Title: ${metaTitle}`);
    pageContent.push(`Description: ${metaDescription}`);

    // Create an array to store elements in their DOM order
    const orderedElements = [];

    // Extract all headings and paragraphs in their original order
    $('h1, h2, h3, h4, h5, h6, p, li, img').each((i, el) => {
        if ($(el).is('h1, h2, h3, h4, h5, h6')) {
            orderedElements.push({
                type: 'heading',
                tag: $(el).prop('tagName'),
                content: $(el).text().trim()
            });
        } else if ($(el).is('p')) {
            const text = $(el).text().trim();
            if (text) {
                orderedElements.push({
                    type: 'paragraph',
                    content: text
                });
            }
        } else if ($(el).is('li')) {
            const text = $(el).text().trim();
            if (text) {
                orderedElements.push({
                    type: 'list',
                    content: `• ${text}`
                });
            }
        } else if ($(el).is('img')) {
            const alt = $(el).attr('alt');
            if (alt && alt.trim()) {
                orderedElements.push({
                    type: 'image',
                    content: `[Image: ${alt.trim()}]`
                });
            }
        }
    });

    // Now add all elements to pageContent in their original order
    for (const element of orderedElements) {
        if (element.type === 'heading') {
            pageContent.push(`${element.tag}: ${element.content}`);
        } else {
            pageContent.push(element.content);
        }
    }

    // Find all links
    $('a[href]').each((i, el) => {
        let href = $(el).attr('href');

        // Skip non-HTTP links and anchors
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }

        // Create absolute URL if it's relative
        let absoluteUrl;
        try {
            absoluteUrl = new URL(href, url).href;
        } catch (e) {
            return; // Skip invalid URLs
        }

        // Only include links from the same domain
        if (absoluteUrl.startsWith(BASE_URL)) {
            // Skip files with ignored extensions
            const extension = path.extname(absoluteUrl.split('?')[0]).toLowerCase();
            if (!IGNORE_EXTENSIONS.includes(extension)) {
                // Remove hash and query params for URL deduplication
                const cleanUrl = absoluteUrl.split('#')[0].split('?')[0];
                // Add trailing slash for consistency if needed
                links.add(cleanUrl);
            }
        }
    });

    return {
        links: Array.from(links),
        content: pageContent.join('\n\n')
    };
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});