#!/usr/bin/env node

/**
 * 05-transform-responsive-images.mjs (Repurposed from 05-format-html.sh)
 *
 * This script transforms regular images into responsive picture elements with proper srcsets
 * No longer requires data-responsive="true" attribute - processes all suitable images
 */

// Add polyfill for ReadableStream
import { ReadableStream } from 'web-streams-polyfill';
global.ReadableStream = ReadableStream;

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Fix import for glob which is CommonJS module
import { promisify } from 'util';
import globCallback from 'glob';
const glob = promisify(globCallback);

import * as cheerio from 'cheerio';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../images/config/image-config.json');

// Default build directory
let buildDir = process.argv[2] || path.resolve(__dirname, '../../../../../build/temp');

console.log('\n====== RESPONSIVE IMAGE TRANSFORMATION ======');
console.log('📷 Transform Responsive Images');
console.log('📁 Build directory:', buildDir);

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  console.error(`❌ Error: Build directory doesn't exist: ${buildDir}`);
  process.exit(1);
}

const publicHtmlDir = path.join(buildDir, 'public_html');

if (!fs.existsSync(publicHtmlDir)) {
  console.error(`❌ Error: Public HTML directory doesn't exist: ${publicHtmlDir}`);
  process.exit(1);
}

// Read image configuration
let imageConfig;
try {
  const configData = fs.readFileSync(configPath, 'utf8');
  imageConfig = JSON.parse(configData);
  console.log('✅ Image configuration loaded successfully');
} catch (error) {
  console.error('❌ Error loading image configuration:', error);
  process.exit(1);
}

// Load available sizes from config
const availableSizes = imageConfig.sizes.map(size => size.width);
const sizesAttribute = imageConfig.defaultSizesAttribute || '(max-width: 1200px) 100vw, 1200px';

console.log('🔍 Searching for HTML files with images to transform...');

// Helper function to check if source image and responsive variants exist
function checkImageExists(basePath, srcExt) {
  // Skip SVG images
  if (srcExt.toLowerCase() === '.svg') {
    return false;
  }

  // Check if the original image exists
  const originalPath = path.join(publicHtmlDir, basePath + srcExt);
  if (!fs.existsSync(originalPath)) {
    return false;
  }

  // Always return true - we don't need to check for variants as they will be created later
  return true;
}

// Helper function to check if image should be transformed
function shouldTransformImage($img) {
  const src = $img.attr('src') || '';

  // Skip if no source
  if (!src) {
    return false;
  }

  // Check if image is in a picture element AND the picture already has source elements
  const $parent = $img.parent();
  if ($parent.is('picture')) {
    // If the picture element already has source elements, skip
    if ($parent.find('source').length > 0) {
      return false;
    }
    // If it's in picture but without sources, we should transform it
  }

  // Check for data-responsive attribute first - this takes highest priority
  if ($img.attr('data-responsive') === 'true') {
    return true;
  }

  // Skip SVG and GIF images
  if (src.toLowerCase().includes('.svg') || src.toLowerCase().includes('.gif')) {
    return false;
  }

  // Skip images with skip-responsive attribute
  if ($img.attr('skip-responsive') === 'true') {
    return false;
  }

  // Check if it's a portfolio image or other content image that should be responsive
  const isPortfolioImage = src.includes('/assets/images/portfolio/');
  const isContentImage = src.includes('/assets/images/') && !src.includes('/icons/');

  return (isPortfolioImage || isContentImage);
}

// Process HTML files
(async () => {
  try {
    const startTime = Date.now();
    console.log('🕒 Starting HTML transformation at:', new Date().toLocaleTimeString());

    // Find all HTML files
    const files = await glob('**/*.html', { cwd: publicHtmlDir });

    console.log(`🔎 Found ${files.length} HTML files to process`);
    let totalTransformed = 0;
    let filesWithChanges = 0;
    let skippedImages = 0;

    // Process each HTML file
    for (const file of files) {
      const filePath = path.join(publicHtmlDir, file);

      try {
        // First, check if there are video source elements that need protection
        let content = fs.readFileSync(filePath, 'utf8');

        // Find and temporarily mark video source elements with explicit closing tags
        // to preserve them during Cheerio parsing
        const videoSourceTagsWithClosing = /<source[^>]*>[\s\S]*?<\/source>/g;
        const markedContent = content.replace(videoSourceTagsWithClosing, match => {
          return match.replace('</source>', '<!--PRESERVE_SOURCE_CLOSING_TAG-->');
        });

        // Now load the HTML with Cheerio
        const $ = cheerio.load(markedContent);
        let fileChanged = false;
        let fileTransformCount = 0;

        // Find all images and process them if they meet our criteria
        $('img').each((i, img) => {
          const $img = $(img);

          // Skip if this image shouldn't be transformed
          if (!shouldTransformImage($img)) {
            return;
          }

          const src = $img.attr('src');

          // Extract base path without extension
          const srcExt = path.extname(src);
          const basePath = src.substring(0, src.length - srcExt.length);

          // Check if the responsive variants exist, skip if they don't
          if (!checkImageExists(basePath, srcExt)) {
            console.log(`  ⚠️ Skipping ${src}: responsive variants not found`);
            skippedImages++;
            return;
          }

          // Create source elements for WebP and fallback
          const webpSrcset = availableSizes
            .map(size => `${basePath}-${size}w.webp ${size}w`)
            .join(', ');

          const originalSrcset = availableSizes
            .map(size => `${basePath}-${size}w${srcExt} ${size}w`)
            .join(', ');

          // Create picture element
          const $picture = $('<picture></picture>');
          const $webpSource = $('<source></source>')
            .attr('srcset', webpSrcset)
            .attr('type', 'image/webp');

          // Add original properties to the image
          $img.attr('srcset', originalSrcset);
          $img.attr('sizes', sizesAttribute);

          // Add loading="lazy" if not present
          if (!$img.attr('loading')) {
            $img.attr('loading', 'lazy');
          }

          // Remove data-responsive if present
          $img.removeAttr('data-responsive');

          // Replace the image with picture element containing the source and original image
          $img.wrap($picture);
          $img.before($webpSource);

          totalTransformed++;
          fileTransformCount++;
          fileChanged = true;

          console.log(`  📝 Transformed image: ${src} in ${file}`);
        });

        // Save the file if changes were made
        if (fileChanged) {
          // Get modified HTML
          let modifiedHtml = $.html();

          // Restore the explicit closing tags for source elements in videos
          modifiedHtml = modifiedHtml.replace(/<!--PRESERVE_SOURCE_CLOSING_TAG-->/g, '</source>');

          fs.writeFileSync(filePath, modifiedHtml);
          filesWithChanges++;
          console.log(`  ✅ Updated ${file} with ${fileTransformCount} responsive images`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n====== RESPONSIVE TRANSFORMATION COMPLETE ======');
    console.log(`✅ Transformed ${totalTransformed} responsive images in ${filesWithChanges} files`);
    console.log(`⚠️ Skipped ${skippedImages} images (no responsive variants found)`);
    console.log(`⏱️ Process completed in ${duration} seconds`);
    console.log('📝 HTML files now contain responsive <picture> elements with multiple sources');
    console.log('⚠️ NOTE: These HTML changes require validation to ensure proper tag structure');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Error during HTML processing:', error);
    process.exit(1);
  }
})();
