import { ReadableStream } from 'web-streams-polyfill';
globalThis.ReadableStream = ReadableStream;

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Adding validation functions that were previously in validate.mjs
/**
 * Validates HTML structure for portfolio pages
 * @param {string} html - HTML content to validate
 * @param {string} filePath - File path for error reporting
 * @returns {boolean} - Whether validation passed
 */
function validateHtml(html, filePath) {
  // Count doctype declarations
  const doctypeCount = (html.match(/<!DOCTYPE/gi) || []).length;
  if (doctypeCount !== 1) {
    console.error(`Validation failures in ${filePath}: Invalid doctype count: ${doctypeCount}`);
    return false;
  }

  // Basic structure validation
  const hasHtml = html.includes('<html');
  const hasHead = html.includes('<head');
  const hasBody = html.includes('<body');

  if (!hasHtml || !hasHead || !hasBody) {
    console.error(`Validation failures in ${filePath}: Missing required HTML elements`);
    return false;
  }

  const $ = cheerio.load(html);
  const errors = [];

  // Check required meta tags
  const requiredMeta = {
    'charset': 'meta[charset="UTF-8"]',
    'viewport': 'meta[name="viewport"]',
    'description': 'meta[name="description"]'
  };

  Object.entries(requiredMeta).forEach(([name, selector]) => {
    if ($(selector).length === 0) {
      errors.push(`Missing ${name} meta tag`);
    }
  });

  // Check script loading
  const scripts = $('script');
  scripts.each((i, elem) => {
    const src = $(elem).attr('src');
    if (src && !src.startsWith('/')) {
      errors.push(`Invalid script path: ${src}`);
    }
  });

  // Check structural requirements (navigation will be injected later by build system)
  const structureChecks = {
    'main content': 'main',
    'next-project container': '.next-project-container',
    'company logo': '.card--company-logo'
  };

  Object.entries(structureChecks).forEach(([name, selector]) => {
    if ($(selector).length === 0) {
      errors.push(`Missing ${name}`);
    }
  });

  // Log errors if any
  if (errors.length > 0) {
    console.error(`\nValidation failures in ${filePath}:`, errors.join(', '));
    return false;
  }

  return true;
}

/**
 * Fixes common HTML issues
 * @param {string} html - HTML content to fix
 * @returns {string} - Fixed HTML content
 */
function fixHtml(html) {
  // Remove duplicate doctypes
  const firstDoctype = html.match(/<!doctype[^>]*>/i)?.[0] || '<!doctype html>';
  html = html.replace(/<!doctype[^>]*>/gi, '');
  html = firstDoctype + html;

  const $ = cheerio.load(html);

  // Ensure charset is first in head
  if ($('meta[charset]').length === 0) {
    $('head').prepend('<meta charset="UTF-8" />');
  }

  // Add viewport if missing
  if ($('meta[name="viewport"]').length === 0) {
    $('meta[charset]').after('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
  }

  // Fix script paths
  $('script').each((i, elem) => {
    const src = $(elem).attr('src');
    if (src && !src.startsWith('/')) {
      $(elem).attr('src', '/' + src.replace(/^\/+/, ''));
    }
  });

  // Ensure next-project container exists
  if ($('.next-project-container').length === 0) {
    $('main').append('<div class="next-project-container"></div>');
  }

  // Inject required scripts only if carousel or zoomable image is present
  // Also inject zoomable-image.js if there are <picture><img> elements (even if .zoomable-image is not present)
  const needsCarousel = $('.carousel, .carousel-source').length > 0;
  let needsZoomable = $('.zoomable-image').length > 0;
  if (!needsZoomable && $('picture img').length > 0) {
    needsZoomable = true;
  }
  if (needsCarousel || needsZoomable) {
    // Remove any existing duplicate script tags for these features
    $('script[src="/js/zoomable-image.js"]').remove();
    $('script[src="/js/carousel.js"]').remove();
    // Inject scripts before </body>
    $('body').append(`
      <!-- Feature scripts -->
      ${needsZoomable ? '<script src="/js/zoomable-image.js" defer></script>' : ''}
      ${needsCarousel ? '<script src="/js/carousel.js" defer></script>' : ''}
    `);
  }

  return $.html();
}

/**
 * Cleans HTML by removing duplicate doctypes
 * @param {string} filePath - Path to the HTML file
 * @returns {Promise<string>} - Cleaned HTML content
 */
async function cleanHtml(filePath) {
  const html = await fs.promises.readFile(filePath, 'utf8');

  // Remove duplicate doctypes
  const cleanedHtml = html.replace(/(<!DOCTYPE[^>]+>[\s\n]*)+/gi, '$1');

  await fs.promises.writeFile(filePath, cleanedHtml);
  return cleanedHtml;
}

// Configuration - fix paths for build directory
let BUILD_DIR = process.argv[2] || path.join(dirname(__filename), '../../../../../build/temp');
let PORTFOLIO_DIR = path.join(BUILD_DIR, 'public_html/portfolio');
let OUTPUT_FILE = path.join(BUILD_DIR, 'public_html/data/portfolio-items.json');
let PUBLIC_HTML_DIR = path.join(BUILD_DIR, 'public_html');

// Function to update global paths when buildDir changes
function updateGlobalPaths(buildDir) {
  BUILD_DIR = buildDir;
  PORTFOLIO_DIR = path.join(BUILD_DIR, 'public_html/portfolio');
  OUTPUT_FILE = path.join(BUILD_DIR, 'public_html/data/portfolio-items.json');
  PUBLIC_HTML_DIR = path.join(BUILD_DIR, 'public_html');
}

// Ensure the data directory exists
async function ensureDataDir(filepath) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

// Portfolio data collection
const portfolioData = [];

// Function to check for required next project structure
function checkNextProjectStructure(html, filePath) {
  if (!html.includes('next-project-container')) {
    console.error(`Missing next-project-container in: ${filePath}`);
    return false;
  }
  return true;
}

/**
 * Parses all tag categories (Role, Platform, Audience) from HTML content
 * @param {string} html - HTML content to parse
 * @param {string} filePath - File path for error reporting
 * @returns {Array} - Array of tag objects with name and slug
 */
function parseAllTagsFromHtml(html, filePath) {
  try {
    const allTags = [];

    // Check if tags are already converted to clickable tags
    const clickableTagsPattern = /<strong>(Role|Platform|Audience):<\/strong>\s*<a[^>]*class="portfolio-tag"/i;
    const clickableMatch = html.match(clickableTagsPattern);

    if (clickableMatch) {
      // Tags are already converted - extract existing tags from all categories
      const allTagsPattern = /<a[^>]*class="portfolio-tag"[^>]*>([^<]+)<\/a>/g;
      let match;

      while ((match = allTagsPattern.exec(html)) !== null) {
        const tagName = match[1].trim();
        if (tagName) {
          allTags.push({
            name: tagName,
            slug: createTagSlug(tagName)
          });
        }
      }

      if (allTags.length > 0) {
        console.log(`Found ${allTags.length} existing clickable tags in ${filePath}`);
        return allTags;
      }
    }

    // Parse Role tags
    const rolePattern = /<strong>Role:<\/strong>\s*([\s\S]*?)(?=<\/p>|<div|<br|$)/i;
    const roleMatch = html.match(rolePattern);
    if (roleMatch) {
      const roleTags = parseTagText(roleMatch[1].trim(), filePath, 'Role');
      allTags.push(...roleTags);
    }

    // Parse Platform tags  
    const platformPattern = /<strong>Platform:<\/strong>\s*([\s\S]*?)(?=<\/p>|<div|<br|$)/i;
    const platformMatch = html.match(platformPattern);
    if (platformMatch) {
      const platformTags = parseTagText(platformMatch[1].trim(), filePath, 'Platform');
      allTags.push(...platformTags);
    }

    // Parse Audience tags
    const audiencePattern = /<strong>Audience:<\/strong>\s*([\s\S]*?)(?=<\/p>|<div|<br|$)/i;
    const audienceMatch = html.match(audiencePattern);
    if (audienceMatch) {
      const audienceTags = parseTagText(audienceMatch[1].trim(), filePath, 'Audience');
      allTags.push(...audienceTags);
    }

    // Extract company name from file path and add as tag
    const companyMatch = filePath.match(/portfolio\/([^\/]+)\//);
    if (companyMatch) {
      const companyName = companyMatch[1];
      // Convert company name to proper case
      const formattedCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1);
      allTags.push({
        name: formattedCompany,
        slug: createTagSlug(formattedCompany)
      });
    }

    if (allTags.length === 0) {
      console.log(`No tag information found in ${filePath}`);
    }

    return allTags;
  } catch (err) {
    console.warn(`Error parsing tags from ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Parses individual tag text into tag objects
 * @param {string} tagText - Comma-separated tag text
 * @param {string} filePath - File path for error reporting
 * @param {string} category - Tag category (Role, Platform, Audience)
 * @returns {Array} - Array of tag objects
 */
function parseTagText(tagText, filePath, category = 'Role') {
  try {
    // First normalize the text by removing newlines and extra whitespace
    const normalizedText = tagText
      .replace(/\n/g, ' ')           // Replace newlines with spaces
      .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
      .trim();                       // Trim leading/trailing whitespace

    // Smart parsing that respects parentheses
    const tags = [];
    let currentTag = '';
    let parenLevel = 0;

    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText[i];

      if (char === '(') {
        parenLevel++;
        currentTag += char;
      } else if (char === ')') {
        parenLevel--;
        currentTag += char;
      } else if (char === ',' && parenLevel === 0) {
        // Only split on commas that are not inside parentheses
        if (currentTag.trim()) {
          tags.push(currentTag.trim());
        }
        currentTag = '';
      } else {
        currentTag += char;
      }
    }

    // Don't forget the last tag
    if (currentTag.trim()) {
      tags.push(currentTag.trim());
    }

    // Process tags: remove connector words and create tag objects
    const processedTags = tags
      .filter(tag => tag.length > 0)
      // Remove tags that start with connector words like "and", "or", "&"
      .map(tag => {
        // Remove leading connector words
        return tag.replace(/^(and\s+|or\s+|&\s+)/i, '').trim();
      })
      .filter(tag => tag.length > 0) // Filter again after cleanup
      .map(tag => ({
        name: tag,
        slug: createTagSlug(tag),
        category: category
      }));

    if (processedTags.length === 0) {
      console.warn(`Empty ${category} tag text in ${filePath}: "${tagText}"`);
    }

    return processedTags;
  } catch (err) {
    console.warn(`Error parsing ${category} tag text "${tagText}" in ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Creates a URL-friendly slug from a tag name
 * @param {string} tagName - Tag name to convert
 * @returns {string} - URL-friendly slug
 */
function createTagSlug(tagName) {
  return tagName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Determines the category of a tag based on predefined lists
 * @param {string} tagName - The tag name to categorize
 * @returns {string} - The category: 'Role', 'Platform', 'Audience', 'Company', or 'Other'
 */
function getTagCategory(tagName) {
  const normalizedTag = tagName.toLowerCase();

  // Role tags - professional responsibilities and activities
  const roleTags = [
    'ux design', 'ui design', 'visual design', 'design systems',
    'interaction design & prototyping', 'prototyping', 'wireframing',
    'user research', 'usability testing', 'research',
    'information architecture', 'product design lead',
    'product management', 'design strategy', 'product strategy',
    'development', 'front-end development', 'component design',
    'e-commerce', 'accessibility', 'brand design'
  ];

  // Platform tags - technical platforms and device types
  const platformTags = [
    'webapp', 'mobile', 'desktop', 'responsive',
    'ios', 'android', 'web', 'native'
  ];

  // Audience tags - target market and business model
  const audienceTags = [
    'b2b', 'b2c', 'b2b saas', 'enterprise', 'consumer',
    'internal tool', 'internal', 'startup'
  ];

  // Company tags - known company names
  const companyTags = [
    'dataxu', 'mikmak', 'logmein', 'swaven'
  ];

  if (roleTags.includes(normalizedTag)) {
    return 'Role';
  } else if (platformTags.includes(normalizedTag)) {
    return 'Platform';
  } else if (audienceTags.includes(normalizedTag)) {
    return 'Audience';
  } else if (companyTags.includes(normalizedTag)) {
    return 'Company';
  } else {
    return 'Role';
  }
}

/**
 * Injects clickable tags into portfolio HTML for all categories (Role, Platform, Audience)
 * @param {string} html - HTML content
 * @param {Array} tags - Array of tag objects
 * @returns {string} - HTML with tags injected
 */
function injectTagsIntoHtml(html, tags) {
  if (!tags || tags.length === 0) {
    return html;
  }

  // Check if ALL tag categories are already injected (all should have clickable tags)
  const hasRoleClickableTags = /<strong>Role:<\/strong>\s*<a[^>]*class="portfolio-tag"/.test(html);
  const hasPlatformClickableTags = /<strong>Platform:<\/strong>\s*<a[^>]*class="portfolio-tag"/.test(html);
  const hasAudienceClickableTags = /<strong>Audience:<\/strong>\s*<a[^>]*class="portfolio-tag"/.test(html);

  if (hasRoleClickableTags && hasPlatformClickableTags && hasAudienceClickableTags) {
    // All tags already injected, no need to re-inject
    return html;
  }

  let updatedHtml = html;

  // Create a map of tag names to tag objects for quick lookup
  const tagMap = new Map();
  tags.forEach(tag => {
    tagMap.set(tag.name.toLowerCase(), tag);
  });

  // Helper function to replace tags in a category
  const replaceCategoryTags = (categoryName) => {
    const pattern = new RegExp(`(<strong>${categoryName}:<\\/strong>\\s*)([^<]+)`, 'i');
    const match = updatedHtml.match(pattern);

    if (match) {
      const tagText = match[2].trim();
      // Split by comma and process each tag
      const tagNames = tagText.split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0); // Remove empty strings

      const clickableTagsHtml = tagNames.map(tagName => {
        const normalizedName = tagName.toLowerCase();
        const tagObj = tagMap.get(normalizedName);

        if (tagObj) {
          return `<a href="/portfolio/tags/${tagObj.slug}/" class="portfolio-tag">${tagObj.name}</a>`;
        } else {
          // If tag not found in map, create a basic slug for it
          const slug = tagName.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          return `<a href="/portfolio/tags/${slug}/" class="portfolio-tag">${tagName}</a>`;
        }
      }).join(' ');

      updatedHtml = updatedHtml.replace(pattern, `$1${clickableTagsHtml}`);
    }
  };

  // Process each category
  replaceCategoryTags('Role');
  replaceCategoryTags('Platform');
  replaceCategoryTags('Audience');

  // Reduce spacing between tag categories by changing structure
  // Convert multiple paragraph structure to single paragraph with line breaks
  updatedHtml = updatedHtml.replace(
    /(<strong>Role:<\/strong>[^<]*(?:<a[^>]*>[^<]*<\/a>[^<]*)*)<\/p>\s*<p>(<strong>Platform:<\/strong>[^<]*(?:<a[^>]*>[^<]*<\/a>[^<]*)*)<\/p>\s*<p>(<strong>Audience:<\/strong>[^<]*(?:<a[^>]*>[^<]*<\/a>[^<]*)*)/g,
    '$1<br />$2<br />$3'
  );

  return updatedHtml;
}

// Validate portfolio page structure
function validatePortfolioPage(html, filePath) {
  if (!validateHtml(html, filePath)) {
    return false;
  }

  const requirements = {
    companyLogo: html.includes('card--company-logo'),
    featuredImage: html.includes('featured--cover'),
    nextProject: checkNextProjectStructure(html, filePath)
  };

  const missing = Object.entries(requirements)
    .filter(([, exists]) => !exists)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(`\nPortfolio validation failed for: ${filePath}`);
    console.error('Missing requirements:', missing.join(', '));
    return false;
  }

  return true;
}

// Extract metadata from HTML file
function extractMetadata(html, filePath) {
  // Skip the portfolio root index.html
  if (filePath.endsWith('/portfolio/index.html')) {
    return null;
  }

  try {
    // Validate structure first
    if (!validatePortfolioPage(html, filePath)) {
      console.error('Failed validation:', filePath);
      return null;
    }

    // Use <h1> content for title instead of <title> tag
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);

    // Still get the description from meta tag
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    const companyMatch = html.match(/company-logo--([\w-]+)\.svg/);

    // Extract relative path from build directory
    const relativePath = filePath
      .replace(path.join(BUILD_DIR, 'public_html'), '')
      .replace('index.html', '')
      .replace(/\/?$/, '/'); // Ensure trailing slash

    if (!h1Match || !descMatch || !companyMatch) {
      console.error('Missing required metadata in:', filePath);
      console.error('- H1 Title:', !!h1Match);
      console.error('- Description:', !!descMatch);
      console.error('- Company:', !!companyMatch);

      // Track failed metadata extraction
      globalThis.failedMetadata = globalThis.failedMetadata || [];
      globalThis.failedMetadata.push(filePath);

      return null;
    }

    // Clean up h1 content (remove any HTML tags and trim)
    let title = h1Match[1].replace(/<[^>]+>/g, '').trim();

    // Extract company and project from path
    const pathParts = relativePath.split('/').filter(Boolean);
    const company = pathParts[1] || '';
    const project = pathParts[2] || '';

    // Extract and parse all tags (Role, Platform, Audience, Company)
    const tags = parseAllTagsFromHtml(html, filePath);

    return {
      path: relativePath,
      title: title,
      description: descMatch[1].trim(),
      company: company.toLowerCase(),
      imageBase: `/assets/images/portfolio/${company}/${project}/featured--cover`,
      tags: tags
    };
  } catch (err) {
    console.error(`Error extracting metadata from ${filePath}:`, err);
    return null;
  }
}

/**
 * Extracts the H1 content from an HTML string
 * @param {string} htmlContent - The HTML content to parse
 * @returns {string|null} - The text content of the first H1 tag, or null if not found
 */
function readHeadingsFromHtml(htmlContent) {
  try {
    const h1Match = htmlContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      // Clean up the content (remove any HTML tags, trim whitespace)
      return h1Match[1].replace(/<[^>]*>/g, '').trim();
    }
    return null;
  } catch (error) {
    console.warn('Error parsing H1 content:', error.message);
    return null;
  }
}

/**
 * Updates HTML content by replacing a pattern with new content
 * @param {string} filePath - Path to the HTML file
 * @param {string|RegExp} searchPattern - Pattern to search for
 * @param {string} replacement - Content to replace the pattern with
 * @returns {Promise<boolean>} - True if file was updated, false otherwise
 */
async function updateHtmlContent(filePath, searchPattern, replacement) {
  try {
    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf8');

    // Check if pattern exists
    if (!content.match(searchPattern)) {
      console.warn(`Pattern not found in ${filePath}`);
      return false;
    }

    // Replace content
    const updatedContent = content.replace(searchPattern, replacement);

    // Write updated content back to file
    await fs.promises.writeFile(filePath, updatedContent, 'utf8');

    return true;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Verifies that a file exists and has all required responsive sizes
 * @param {string} imagePath - Base path to the image (without size suffix)
 * @param {string[]} formats - Image formats to check (e.g., ['png', 'webp'])
 * @param {number[]} sizes - Sizes to check (e.g., [320, 640, 960, 1200, 1800])
 * @returns {Promise<boolean>} - True if all required files exist
 */
async function verifyResponsiveImages(imagePath, formats = ['png', 'webp'], sizes = [320, 640, 960, 1200, 1800]) {
  try {
    // Check if base file exists
    const baseFilePath = `${imagePath}.png`;
    try {
      await fs.promises.access(path.join(PUBLIC_HTML_DIR, baseFilePath));
    } catch {
      console.warn(`Base image not found: ${baseFilePath}`);
      return false;
    }

    // Check all sizes and formats
    for (const size of sizes) {
      for (const format of formats) {
        const filePath = `${imagePath}-${size}w.${format}`;
        try {
          await fs.promises.access(path.join(PUBLIC_HTML_DIR, filePath));
        } catch {
          console.warn(`Responsive image not found: ${filePath}`);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error verifying responsive images:', error.message);
    return false;
  }
}

/**
 * Generates static HTML for the portfolio index page
 * @param {Array} portfolioData - Array of portfolio items data
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function generatePortfolioIndexPage(portfolioData) {
  try {
    console.log('Generating static portfolio index page...');

    // Path to the index.html file
    const indexPath = path.join(PUBLIC_HTML_DIR, 'portfolio/index.html');

    // Read the index.html template
    let indexHtml = await fs.promises.readFile(indexPath, 'utf8');

    // Sort portfolio data by company first, then alphabetically within each company
    const sortedPortfolioData = [...portfolioData].sort((a, b) => {
      // First sort by company (MikMak first, then LogMeIn, then DataXu)
      const companyOrder = { 'mikmak': 0, 'logmein': 1, 'dataxu': 2 };
      const aCompanyOrder = companyOrder[a.company.toLowerCase()] ?? 999;
      const bCompanyOrder = companyOrder[b.company.toLowerCase()] ?? 999;

      if (aCompanyOrder !== bCompanyOrder) {
        return aCompanyOrder - bCompanyOrder;
      }

      // Within the same company, sort alphabetically by title
      return a.title.localeCompare(b.title);
    });

    // Generate HTML for all portfolio cards
    const cardsHtml = await Promise.all(sortedPortfolioData.map(async section => {
      // Verify that all responsive images exist
      const imageExists = await verifyResponsiveImages(section.imageBase);
      if (!imageExists) {
        console.warn(`Missing responsive images for ${section.path}. Using base image as fallback.`);
      }

      // Generate tags HTML (limit based on estimated line count for consistent heights)
      let tagsHtml = '';
      if (section.tags && section.tags.length > 0) {
        // Estimate character width per line (adjust based on your card width and font size)
        const avgCharsPerLine = 30; // Increased for smaller font size
        const maxLines = 2; // Maximum lines of tags we want
        const maxChars = avgCharsPerLine * maxLines;

        const displayTags = [];
        let currentChars = 0;

        for (const tag of section.tags) {
          const tagLength = tag.name.length + 2; // +2 for spacing/padding
          if (currentChars + tagLength <= maxChars) {
            displayTags.push(tag);
            currentChars += tagLength;
          } else {
            break;
          }
        }

        // Calculate remaining Role tags specifically for "more" indicator
        const remainingRoleTags = section.tags.filter((tag, index) =>
          index >= displayTags.length && tag.category === 'Role'
        ).length;
        const moreIndicator = remainingRoleTags > 0 ? `<span class="portfolio-tag portfolio-tag--more">+${remainingRoleTags} more</span>` : '';

        tagsHtml = `
            <div class="card--tags">
              ${displayTags.map(tag => `<span class="portfolio-tag">${tag.name}</span>`).join('')}${moreIndicator}
            </div>`;
      }

      return `
        <a class="card" href="${section.path}">
          <div class="card--details">
            <h2>${section.title}</h2>
            <div class="card--company-logo">
              <img src="/assets/images/portfolio/company-logo--${section.company}.svg" alt="${section.company} logo">
            </div>${tagsHtml}
          </div>
          <picture>
            <source 
              srcset="${section.imageBase}-320w.webp 320w, ${section.imageBase}-640w.webp 640w, ${section.imageBase}-960w.webp 960w, ${section.imageBase}-1200w.webp 1200w, ${section.imageBase}-1800w.webp 1800w" 
              type="image/webp" 
            />
            <img 
              src="${section.imageBase}.png" 
              alt="${section.description || ''}" 
              width="1200" 
              height="648" 
              loading="lazy" 
              srcset="${section.imageBase}-320w.png 320w, ${section.imageBase}-640w.png 640w, ${section.imageBase}-960w.png 960w, ${section.imageBase}-1200w.png 1200w, ${section.imageBase}-1800w.png 1800w"
              sizes="(max-width: 1200px) 100vw, 1200px" 
            />
          </picture>
        </a>
      `;
    }));

    // Replace the cards container content (use comment marker if available)
    const cardsPlaceholder = /<!-- Cards will be dynamically inserted here -->/;
    const cardsSectionSelector = /<div class="cards staggered-animation">([\s\S]*?)<\/div>/;

    if (indexHtml.match(cardsPlaceholder)) {
      // If there's a placeholder comment, replace it
      indexHtml = indexHtml.replace(cardsPlaceholder, cardsHtml.join('\n'));
    } else if (indexHtml.match(cardsSectionSelector)) {
      // Otherwise, replace the entire cards section
      indexHtml = indexHtml.replace(
        cardsSectionSelector,
        `<div class="cards staggered-animation">\n${cardsHtml.join('\n')}\n</div>`
      );
    } else {
      console.warn('Could not find a suitable injection point for portfolio cards');
      return false;
    }

    // Remove the script tag for portfolio-cards.js
    indexHtml = indexHtml.replace(
      /<script src="\/js\/portfolio-cards\.js[^>]*><\/script>/,
      '<!-- Script removed: portfolio cards are now static -->'
    );

    // Write the modified file
    await fs.promises.writeFile(indexPath, indexHtml, 'utf8');
    console.log('✓ Portfolio index page generated successfully');
    return true;
  } catch (error) {
    console.error('Error generating portfolio index page:', error.message);
    return false;
  }
}

/**
 * Generates static next-project sections for all portfolio pages
 * @param {Object} nextProjectMap - Mapping of current pages to next project data
 * @returns {Promise<number>} - Number of pages successfully processed
 */
async function generateNextProjectSections(nextProjectMap) {
  try {
    console.log('Generating static next-project sections...');

    // Track stats
    let successful = 0;
    let failed = 0;

    // Get all portfolio pages that need next-project sections
    const portfolioPages = Object.keys(nextProjectMap);

    for (const pagePath of portfolioPages) {
      // Skip the main portfolio index page
      if (pagePath === '/portfolio/') {
        continue;
      }

      // Find the file path based on the URL path
      const filePath = path.join(
        PUBLIC_HTML_DIR,
        pagePath.endsWith('/')
          ? `${pagePath.substring(1)}index.html`
          : pagePath.substring(1)
      );

      try {
        // Check if file exists
        await fs.promises.access(filePath);

        // Get the next project data
        const nextProject = nextProjectMap[pagePath];

        // Verify responsive images exist
        const imageExists = await verifyResponsiveImages(nextProject.imageBase);
        if (!imageExists) {
          console.warn(`Missing responsive images for next project: ${nextProject.path}. Will use base image as fallback.`);
        }

        // Define available sizes for responsive images
        const availableSizes = [320, 640, 960, 1200];

        // Create srcset strings
        const webpSrcset = availableSizes
          .map(size => `${nextProject.imageBase}-${size}w.webp ${size}w`)
          .join(', ');

        const pngSrcset = availableSizes
          .map(size => `${nextProject.imageBase}-${size}w.png ${size}w`)
          .join(', ');

        // Generate tags HTML for next project (same logic as main cards)
        let nextProjectTagsHtml = '';
        if (nextProject.tags && nextProject.tags.length > 0) {
          // Estimate character width per line (adjust based on your card width and font size)
          const avgCharsPerLine = 30; // Increased for smaller font size
          const maxLines = 2; // Maximum lines of tags we want
          const maxChars = avgCharsPerLine * maxLines;

          const displayTags = [];
          let currentChars = 0;

          for (const tag of nextProject.tags) {
            const tagLength = tag.name.length + 2; // +2 for spacing/padding
            if (currentChars + tagLength <= maxChars) {
              displayTags.push(tag);
              currentChars += tagLength;
            } else {
              break;
            }
          }

          // Calculate remaining Role tags specifically for "more" indicator
          const remainingRoleTags = nextProject.tags.filter((tag, index) =>
            index >= displayTags.length && tag.category === 'Role'
          ).length;
          const moreIndicator = remainingRoleTags > 0 ? `<span class="portfolio-tag portfolio-tag--more">+${remainingRoleTags} more</span>` : '';

          nextProjectTagsHtml = `
                <div class="card--tags">
                  ${displayTags.map(tag => `<span class="portfolio-tag">${tag.name}</span>`).join('')}${moreIndicator}
                </div>`;
        }

        // Generate the next project card HTML
        const nextProjectHTML = `
          <div class="cards">
            <a class="card" href="${nextProject.path}">
              <div class="card--details">
                <p><strong>Up Next</strong></p>
                <h2>${nextProject.title}</h2>
                <div class="card--company-logo">
                  <img src="/assets/images/portfolio/company-logo--${nextProject.company}.svg" alt="${nextProject.company} logo">
                </div>${nextProjectTagsHtml}
              </div>
              <picture>
                <source
                  srcset="${webpSrcset}"
                  type="image/webp"
                  onerror="this.onerror=null; this.srcset=''; this.parentNode.style.display='none';"
                />
                <img
                  id="featured--image_preview"
                  src="${nextProject.imageBase}.png"
                  alt="Preview of ${nextProject.title}"
                  loading="lazy"
                  width="1880"
                  height="1000"
                  srcset="${pngSrcset}"
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  onerror="this.onerror=null; this.srcset=''; this.src='/assets/images/placeholder-project.png';"
                />
              </picture>
            </a>
          </div>
        `;

        // Replace the next project container content
        const updated = await updateHtmlContent(
          filePath,
          /<div class="next-project-container">[\s\S]*?<\/div>/,
          `<div class="next-project-container">
            <!-- Next project section statically generated -->
            ${nextProjectHTML}
          </div>`
        );

        if (updated) {
          // Also remove the script tag for next-project.js
          let pageHtml = await fs.promises.readFile(filePath, 'utf8');
          pageHtml = pageHtml.replace(
            /<script src="\/js\/next-project\.js[^>]*><\/script>/,
            '<!-- Script removed: next-project is now static -->'
          );
          await fs.promises.writeFile(filePath, pageHtml, 'utf8');

          console.log(`✓ Next project section generated for ${pagePath}`);
          successful++;
        } else {
          console.warn(`Could not update next-project section for ${pagePath}`);
          failed++;
        }
      } catch (error) {
        console.warn(`Error processing next-project for ${pagePath}:`, error.message);
        failed++;
      }
    }

    console.log(`✓ Next project sections generated: ${successful} successful, ${failed} failed`);
    return successful;
  } catch (error) {
    console.error('Error generating next-project sections:', error.message);
    return 0;
  }
}

// === CAROUSEL TRANSFORMATION LOGIC ===
/**
 * Transforms simplified .carousel-source markup into full production carousel HTML
 * @param {string} html - HTML content
 * @returns {string} - HTML with carousels transformed
 */
function transformCarouselsInHtml(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  $('.carousel-source').each(function () {
    const $carousel = $(this);
    const ariaLabel = $carousel.attr('aria-label') || '';
    const slides = [];
    const captions = [];
    $carousel.find('.carousel-slide-source').each(function (i) {
      const $slide = $(this);
      // Find image or video (already processed by build pipeline)
      let mediaHtml = '';
      if ($slide.find('video').length) {
        // Wrap video in .video-wrapper
        mediaHtml = `<div class="video-wrapper"><div class="overlay"></div>${$.html($slide.find('video'))}</div>`;
      } else if ($slide.find('picture').length) {
        mediaHtml = $.html($slide.find('picture'));
      } else if ($slide.find('img').length) {
        mediaHtml = $.html($slide.find('img'));
      }
      // Caption - preserve all HTML structure
      const captionHtml = $.html($slide.find('.carousel-caption-source'));
      // Remove only the outer wrapper if it exists (p or div), but preserve all other HTML
      const cleanedCaption = captionHtml.replace(/^<(p|div)[^>]*>(.*)<\/(p|div)>$/s, '$2');
      captions.push(`<div class="carousel-description${i === 0 ? ' active' : ''}">${cleanedCaption}</div>`);
      // Slide
      slides.push(`<div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${$carousel.find('.carousel-slide-source').length}">${mediaHtml}</div>`);
    });
    // Carousel nav indicators
    const navButtons = slides.map((_, i) => `<button class="carousel-indicator${i === 0 ? ' active' : ''}" aria-label="Go to slide ${i + 1}"${i === 0 ? ' aria-selected="true" role="tab"' : ''}></button>`).join('');
    // Build carousel HTML
    const carouselHtml = `
      <div class="carousel" aria-roledescription="carousel" aria-label="${ariaLabel}">
        <div class="carousel-container">
          <div class="carousel-slides">
            <div class="carousel-track">
              ${slides.join('\n')}
            </div>
          </div>
          <button class="carousel-button prev" aria-label="Previous slide">‹</button>
          <button class="carousel-button next" aria-label="Next slide">›</button>
        </div>
        <div class="content-caption" aria-live="polite">
          ${captions.join('\n')}
        </div>
        <div class="carousel-nav" role="tablist" aria-label="Carousel navigation">
          ${navButtons}
        </div>
      </div>
    `;
    $carousel.replaceWith(carouselHtml);
  });
  return $.html();
}

// === INTEGRATE CAROUSEL TRANSFORMATION INTO BUILD ===
async function transformCarouselsInAllHtmlFiles(dir) {
  const exts = ['.html'];
  const files = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (exts.includes(path.extname(fullPath))) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  for (const file of files) {
    let html = await fs.promises.readFile(file, 'utf8');
    if (html.includes('carousel-source')) {
      const transformed = transformCarouselsInHtml(html);
      await fs.promises.writeFile(file, transformed, 'utf8');
      console.log(`✓ Carousel transformed in ${file}`);
    }
  }
}

/**
 * Applies fixHtml to all HTML files in a directory
 * @param {string} dir - Directory to process
 */
async function fixHtmlInAllFiles(dir) {
  const exts = ['.html'];
  const files = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (exts.includes(path.extname(fullPath))) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);

  let scriptsInjected = 0;
  for (const file of files) {
    let html = await fs.promises.readFile(file, 'utf8');
    const fixedHtml = fixHtml(html);
    if (fixedHtml !== html) {
      await fs.promises.writeFile(file, fixedHtml, 'utf8');
      console.log(`✓ Scripts injected in ${path.relative(dir, file)}`);
      scriptsInjected++;
    }
  }

  console.log(`✓ Feature scripts injected in ${scriptsInjected} files`);
}

// === TAG INJECTION LOGIC ===
/**
 * Injects clickable tags into all portfolio HTML files
 * @param {Array} portfolioData - Array of portfolio items with tags
 * @returns {Promise<number>} - Number of files processed
 */
async function injectTagsInAllHtmlFiles(portfolioData) {
  try {
    console.log('Injecting clickable tags into portfolio pages...');

    let filesProcessed = 0;

    for (const item of portfolioData) {
      if (!item.tags || item.tags.length === 0) {
        continue;
      }

      // Find the file path based on the URL path
      // item.path is relative to public_html (e.g., "/portfolio/company/project/")
      const filePath = path.join(
        PUBLIC_HTML_DIR,
        item.path.endsWith('/')
          ? `${item.path.substring(1)}index.html`
          : item.path.substring(1)
      );

      try {
        // Check if file exists
        await fs.promises.access(filePath);

        // Read the file
        let html = await fs.promises.readFile(filePath, 'utf8');

        // Inject tags
        const updatedHtml = injectTagsIntoHtml(html, item.tags);

        if (updatedHtml !== html) {
          await fs.promises.writeFile(filePath, updatedHtml, 'utf8');
          console.log(`✓ Tags injected in ${item.path}`);
          filesProcessed++;
        }
      } catch (error) {
        console.warn(`Could not process tags for ${item.path}:`, error.message);
      }
    }

    console.log(`✓ Tags injected in ${filesProcessed} portfolio pages`);
    return filesProcessed;

  } catch (err) {
    console.error('Error injecting tags:', err.message);
    return 0;
  }
}

// === TAG PAGE GENERATION ===
/**
 * Generates individual tag pages listing all portfolio items for each tag
 * @param {Array} portfolioData - Array of portfolio items with tags
 * @returns {Promise<number>} - Number of tag pages generated
 */
async function generateTagPages(portfolioData) {
  try {
    console.log('Generating tag pages...');

    // Collect all unique tags across all portfolio items
    const tagMap = new Map();

    for (const item of portfolioData) {
      if (item.tags && item.tags.length > 0) {
        for (const tag of item.tags) {
          if (!tagMap.has(tag.slug)) {
            tagMap.set(tag.slug, {
              name: tag.name,
              slug: tag.slug,
              items: []
            });
          }
          tagMap.get(tag.slug).items.push(item);
        }
      }
    }

    // Read the tag listing template
    const templatePath = path.join(__dirname, '../create-new-page/templates/tag-listing-template.html');
    let template;

    try {
      template = await fs.promises.readFile(templatePath, 'utf8');
    } catch (error) {
      // If template doesn't exist, create a basic one
      console.warn('Tag template not found, creating basic template...');
      template = `<!doctype html>
<html lang="en">
<head>
  <meta name="description" content="Explore Dan Reis's UX design portfolio items tagged with {{TAG_NAME}}." />
  <title>Product Design Portfolio | {{TAG_NAME}} | Dan Reis</title>
  <!-- BUILD_INSERT id="head" -->
  <link rel="stylesheet" href="/styles/page-portfolio.css?v={{VERSION}}" />
</head>
<body class="portfolio-index portfolio-tag-page">
  <!-- HEADER SECTION: Navigation and Title -->
  <div class="wrapper">
    <!-- BUILD_INSERT id="nav" -->
    <header role="banner">
      <h1>{{TAG_CATEGORY}}: {{TAG_NAME}}</h1>
      <a href="/portfolio/tags/" class="tag-index-link">[All tags]</a>
    </header>
  </div>
  <!-- MAIN CONTENT -->
  <main role="main" id="main-content">
    <div class="wrapper">
      <div class="cards staggered-animation">
        <!-- Portfolio cards for this tag will be dynamically inserted here -->
      </div>
    </div>
  </main>
  <!-- BUILD_INSERT id="footer" -->
</body>
</html>`;
    }

    let generatedPages = 0;

    // Generate a page for each tag
    for (const [slug, tagData] of tagMap) {
      const tagDir = path.join(PUBLIC_HTML_DIR, 'portfolio', 'tags', slug);

      // Create directory if it doesn't exist
      await fs.promises.mkdir(tagDir, { recursive: true });

      // Sort tag page items by company order (same as main portfolio)
      const companyOrder = { 'mikmak': 0, 'logmein': 1, 'dataxu': 2 };
      const sortedItems = [...tagData.items].sort((a, b) => {
        // First sort by company (MikMak first, then LogMeIn, then DataXu)
        const aCompanyOrder = companyOrder[a.company.toLowerCase()] ?? 999;
        const bCompanyOrder = companyOrder[b.company.toLowerCase()] ?? 999;

        if (aCompanyOrder !== bCompanyOrder) {
          return aCompanyOrder - bCompanyOrder;
        }

        // Within the same company, sort alphabetically by title
        return a.title.localeCompare(b.title);
      });

      // Generate HTML for portfolio cards
      const cardsHtml = await Promise.all(sortedItems.map(async item => {
        // Verify that all responsive images exist
        const imageExists = await verifyResponsiveImages(item.imageBase);
        if (!imageExists) {
          console.warn(`Missing responsive images for ${item.path}. Using base image as fallback.`);
        }

        // Generate tags HTML (limit based on estimated line count for consistent heights)
        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
          // Estimate character width per line (adjust based on your card width and font size)
          const avgCharsPerLine = 30; // Increased for smaller font size
          const maxLines = 2; // Maximum lines of tags we want
          const maxChars = avgCharsPerLine * maxLines;

          const displayTags = [];
          let currentChars = 0;

          for (const tag of item.tags) {
            const tagLength = tag.name.length + 2; // +2 for spacing/padding
            if (currentChars + tagLength <= maxChars) {
              displayTags.push(tag);
              currentChars += tagLength;
            } else {
              break;
            }
          }

          // Calculate remaining Role tags specifically for "more" indicator
          const remainingRoleTags = item.tags.filter((tag, index) =>
            index >= displayTags.length && tag.category === 'Role'
          ).length;
          const moreIndicator = remainingRoleTags > 0 ? `<span class="portfolio-tag portfolio-tag--more">+${remainingRoleTags} more</span>` : '';

          tagsHtml = `
            <div class="card--tags">
              ${displayTags.map(tag => `<span class="portfolio-tag">${tag.name}</span>`).join('')}${moreIndicator}
            </div>`;
        }

        return `
        <a class="card" href="${item.path}">
          <div class="card--details">
            <h2>${item.title}</h2>
            <div class="card--company-logo">
              <img src="/assets/images/portfolio/company-logo--${item.company}.svg" alt="${item.company} logo">
            </div>${tagsHtml}
          </div>
          <picture>
            <source 
              srcset="${item.imageBase}-320w.webp 320w, ${item.imageBase}-640w.webp 640w, ${item.imageBase}-960w.webp 960w, ${item.imageBase}-1200w.webp 1200w, ${item.imageBase}-1800w.webp 1800w" 
              type="image/webp" 
            />
            <img 
              src="${item.imageBase}.png" 
              alt="${item.description || ''}" 
              width="1200" 
              height="648" 
              loading="lazy" 
              srcset="${item.imageBase}-320w.png 320w, ${item.imageBase}-640w.png 640w, ${item.imageBase}-960w.png 960w, ${item.imageBase}-1200w.png 1200w, ${item.imageBase}-1800w.png 1800w"
              sizes="(max-width: 1200px) 100vw, 1200px" 
            />
          </picture>
        </a>
      `;
      }));

      // Replace template placeholders
      const tagCategory = getTagCategory(tagData.name);
      let tagPageHtml = template
        .replace(/{{TAG_NAME}}/g, tagData.name)
        .replace(/{{TAG_CATEGORY}}/g, tagCategory)
        .replace(/                <!-- Portfolio cards for this tag will be dynamically inserted here -->/, cardsHtml.join('\n                '));

      // Write the tag page
      const tagPagePath = path.join(tagDir, 'index.html');
      await fs.promises.writeFile(tagPagePath, tagPageHtml, 'utf8');

      console.log(`✓ Generated tag page for "${tagData.name}" at ${tagPagePath}`);
      generatedPages++;
    }

    console.log(`✓ Generated ${generatedPages} tag pages`);
    return generatedPages;

  } catch (error) {
    console.error('Error generating tag pages:', error.message);
    return 0;
  }
}

// === TAG INDEX PAGE GENERATION ===
/**
 * Generates a master tag index page listing all available tags
 * @param {Array} portfolioData - Array of portfolio items with tags
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function generateTagIndexPage(portfolioData) {
  try {
    console.log('Generating tag index page...');

    // Collect all unique tags across all portfolio items with counts and categories
    const tagMap = new Map();

    for (const item of portfolioData) {
      if (item.tags && item.tags.length > 0) {
        for (const tag of item.tags) {
          if (!tagMap.has(tag.slug)) {
            tagMap.set(tag.slug, {
              name: tag.name,
              slug: tag.slug,
              category: getTagCategory(tag.name),
              count: 0
            });
          }
          tagMap.get(tag.slug).count++;
        }
      }
    }

    // Group tags by category and sort alphabetically within each category
    const tagsByCategory = {
      'Role': [],
      'Platform': [],
      'Audience': [],
      'Company': []
    };

    Array.from(tagMap.values()).forEach(tag => {
      if (tagsByCategory[tag.category]) {
        tagsByCategory[tag.category].push(tag);
      }
    });

    // Sort tags within each category alphabetically
    Object.keys(tagsByCategory).forEach(category => {
      tagsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Create the tag index HTML using portfolio page template structure
    const tagIndexHtml = `<!doctype html>
<html lang="en">

<head>
    <meta name="description" content="Browse Dan Reis's UX design portfolio by tags and skills including UX Design, Prototyping, User Research, and more." />
    <title>Portfolio Tags & Skills | Dan Reis</title>
    <!-- BUILD_INSERT id="head" -->
    <link rel="stylesheet" href="/styles/page-portfolio.css?v={{VERSION}}" />
</head>

<body>
    <!-- HEADER SECTION: Navigation and Title -->
    <div class="wrapper">
        <!-- BUILD_INSERT id="nav" -->
        <!-- Header -->
        <header role="banner">
            <h1>Portfolio Tags & Skills</h1>
        </header>
    </div>
    <!-- MAIN CONTENT -->
    <main role="main" id="main-content">
        <div class="wrapper">
            <div class="content-wrapper">
                <!-- SECTION: Company Tags -->
                <section class="solution">
                    <h2>Company Tags</h2>
                    <p>Projects organized by company and client work.</p>
                    <ul class="tag-list">
                        ${tagsByCategory.Company.map(tag =>
      `<li><a href="/portfolio/tags/${tag.slug}/">${tag.name}</a> <span class="tag-count">(${tag.count} project${tag.count !== 1 ? 's' : ''})</span></li>`
    ).join('\n                        ')}
                    </ul>
                </section>
                
                <!-- SECTION: Audience Tags -->
                <section class="solution">
                    <h2>Audience Tags</h2>
                    <p>Target market and business model categories.</p>
                    <ul class="tag-list">
                        ${tagsByCategory.Audience.map(tag =>
      `<li><a href="/portfolio/tags/${tag.slug}/">${tag.name}</a> <span class="tag-count">(${tag.count} project${tag.count !== 1 ? 's' : ''})</span></li>`
    ).join('\n                        ')}
                    </ul>
                </section>
                
                <!-- SECTION: Platform Tags -->
                <section class="solution">
                    <h2>Platform Tags</h2>
                    <p>Technical platforms and device types targeted by projects.</p>
                    <ul class="tag-list">
                        ${tagsByCategory.Platform.map(tag =>
      `<li><a href="/portfolio/tags/${tag.slug}/">${tag.name}</a> <span class="tag-count">(${tag.count} project${tag.count !== 1 ? 's' : ''})</span></li>`
    ).join('\n                        ')}
                    </ul>
                </section>
                
                <!-- SECTION: Role Tags -->
                <section class="solution">
                    <h2>Role Tags</h2>
                    <p>Professional responsibilities and activities on projects.</p>
                    <ul class="tag-list">
                        ${tagsByCategory.Role.map(tag =>
      `<li><a href="/portfolio/tags/${tag.slug}/">${tag.name}</a> <span class="tag-count">(${tag.count} project${tag.count !== 1 ? 's' : ''})</span></li>`
    ).join('\n                        ')}
                    </ul>
                </section>
            </div>
        </div>
    </main>
    <!-- BUILD_INSERT id="footer" -->
</body>

</html>`;

    // Write the tag index page
    const tagIndexDir = path.join(PUBLIC_HTML_DIR, 'portfolio', 'tags');
    await fs.promises.mkdir(tagIndexDir, { recursive: true });

    const tagIndexPath = path.join(tagIndexDir, 'index.html');
    await fs.promises.writeFile(tagIndexPath, tagIndexHtml, 'utf8');

    console.log(`✓ Generated tag index page with ${Object.values(tagsByCategory).flat().length} tags organized by category at ${tagIndexPath}`);
    return true;

  } catch (error) {
    console.error('Error generating tag index page:', error.message);
    return false;
  }
}

// === MAIN EXECUTION FUNCTION ===
/**
 * Main function that orchestrates all portfolio processing steps
 * @param {string} buildDir - Build directory path (defaults to './build/temp')
 */
async function main(buildDir = './build/temp') {
  console.log('\n📁 Starting portfolio build process...');

  // Update global paths to use the correct buildDir
  updateGlobalPaths(buildDir);

  try {
    const portfolioDir = path.join(buildDir, 'public_html', 'portfolio');

    if (!fs.existsSync(portfolioDir)) {
      console.error(`Portfolio directory not found: ${portfolioDir}`);
      process.exit(1);
    }

    console.log('✓ Portfolio directory found');

    // Step 1: Collect and validate portfolio data
    console.log('\n1. 📊 Collecting portfolio data...');
    const portfolioData = [];
    const files = fs.readdirSync(portfolioDir, { withFileTypes: true });

    for (const dirent of files) {
      if (dirent.isDirectory() && dirent.name !== 'tags') {
        const companyDir = path.join(portfolioDir, dirent.name);
        const projects = fs.readdirSync(companyDir, { withFileTypes: true });

        for (const projectDirent of projects) {
          if (projectDirent.isDirectory()) {
            const indexPath = path.join(companyDir, projectDirent.name, 'index.html');
            if (fs.existsSync(indexPath)) {
              try {
                const html = await fs.promises.readFile(indexPath, 'utf8');
                const metadata = extractMetadata(html, indexPath);
                if (metadata) {
                  portfolioData.push(metadata);
                }
              } catch (error) {
                console.warn(`Error processing ${indexPath}:`, error.message);
              }
            }
          }
        }
      }
    }

    console.log(`✓ Collected metadata for ${portfolioData.length} portfolio projects`);

    // Step 2: Transform carousel markup
    console.log('\n2. 🎠 Transforming carousel markup...');
    await transformCarouselsInAllHtmlFiles(path.join(buildDir, 'public_html'));

    // Step 2.5: Fix HTML by injecting required scripts (carousel.js, zoomable-image.js)
    console.log('\n2.5 🔧 Injecting required feature scripts...');
    await fixHtmlInAllFiles(path.join(buildDir, 'public_html'));

    // Step 3: Inject tags into portfolio pages
    console.log('\n3. 🏷️ Injecting tags into portfolio pages...');
    const taggedFiles = await injectTagsInAllHtmlFiles(portfolioData);

    // Step 4: Generate portfolio index page
    console.log('\n4. 📄 Generating portfolio index page...');
    await generatePortfolioIndexPage(portfolioData);

    // Step 5: Generate tag pages
    console.log('\n5. 🏷️ Generating tag pages...');
    const tagPagesGenerated = await generateTagPages(portfolioData);

    // Step 6: Generate next-project sections
    console.log('\n6. ➡️ Generating next-project sections...');
    const nextProjectMap = createNextProjectMap(portfolioData);
    const nextProjectsGenerated = await generateNextProjectSections(nextProjectMap);

    // Step 7: Generate tag index page
    console.log('\n7. 🏷️ Generating tag index page...');
    await generateTagIndexPage(portfolioData);

    // Summary
    console.log('\n✅ Portfolio build process complete!');
    console.log(`   - Portfolio projects processed: ${portfolioData.length}`);
    console.log(`   - Tags injected in pages: ${taggedFiles}`);
    console.log(`   - Tag pages generated: ${tagPagesGenerated}`);
    console.log(`   - Next-project sections generated: ${nextProjectsGenerated}`);

  } catch (error) {
    console.error('\n❌ Portfolio build failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Creates a mapping of current project to next project for navigation
 * @param {Array} portfolioData - Array of portfolio items
 * @returns {Object} - Mapping of current project paths to next project data
 */
function createNextProjectMap(portfolioData) {
  const nextProjectMap = {};

  for (let i = 0; i < portfolioData.length; i++) {
    const currentProject = portfolioData[i];
    const nextProject = portfolioData[(i + 1) % portfolioData.length]; // Wrap around to first project

    nextProjectMap[currentProject.path] = {
      title: nextProject.title,
      path: nextProject.path,
      imageBase: nextProject.imageBase,
      company: nextProject.company,
      tags: nextProject.tags
    };
  }

  return nextProjectMap;
}

// Execute if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const buildDir = process.argv[2] || './build/temp';
  main(buildDir).catch(error => {
    console.error('Build failed:', error.message);
    process.exit(1);
  });
}

export { main as default, extractMetadata, generatePortfolioIndexPage, generateTagPages, generateNextProjectSections, transformCarouselsInAllHtmlFiles, injectTagsInAllHtmlFiles };