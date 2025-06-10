/**
 * Image Processing Script
 *
 * Created: 2025-03-29
 * Last Modified: 2025-05-15
 * Version: 1.2.0
 * Author: Daniel Reis
 * License: MIT
 *
 * Change History:
 * - 1.2.0 (2025-05-15): Added automatic light image sharpening
 *   - Applied subtle sharpening to all processed images
 *   - Used conservative params: sigma=0.5, flat=0.8, jagged=1.0
 * - 1.1.0 (2025-04-14): Added favicon exclusion logic
 * - 1.0.0 (2025-03-29): Initial implementation
 *   - Added responsive image processing
 *   - Implemented WebP conversion
 *   - Added HTML structure updates
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sharp from 'sharp';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sizes for responsive images
const SIZES = [320, 640, 960, 1200, 1800];

// Cache of processed images
const processedCache = new Set();

// Helper to check if a file should be skipped (favicon files, SVG, GIF)
function shouldSkipFile(filePath) {
    // Get the filename
    const filename = path.basename(filePath);

    // Skip all favicon and related icon files
    if (
        filename.startsWith('favicon') ||
        filename.startsWith('apple-touch-icon') ||
        filename.startsWith('android-chrome') ||
        filename.startsWith('mstile') ||
        filename === 'safari-pinned-tab.svg'
    ) {
        console.log(`Skipping favicon file: ${filename}`);
        return true;
    }

    // Skip existing formats that shouldn't be processed
    const extension = path.extname(filePath).toLowerCase();
    return extension === '.gif' || extension === '.svg';
}

// Helper to generate a unique key for each image processing task
function getImageKey(inputPath, width, format) {
    return `${inputPath}-${width}-${format}`;
}

async function processImage(inputPath, options = {}) {
    const {
        width,
        format = 'webp',
        quality = 80,
        outputDir,
        outputBase
    } = options;

    // Use more specific cache key that includes width and format
    const cacheKey = getImageKey(inputPath, width, format);
    if (processedCache.has(cacheKey)) {
        console.log(`Skipping ${format}@${width}px: ${path.basename(inputPath)}`);
        return null;
    }
    processedCache.add(cacheKey);

    // Generate output paths
    const outputPath = path.join(
        outputDir || path.dirname(inputPath),
        `${outputBase || path.basename(inputPath, path.extname(inputPath))}-${width}w.${format}`
    );

    console.log(`Processing ${format}@${width}px: ${path.basename(inputPath)}`);

    try {
        // Apply a light sharpening AFTER resizing for optimal quality
        // Using conservative settings that work well for most images
        await sharp(inputPath)
            .resize(width)
        // Format conversion with quality settings
        [format]({ quality })
            // Apply sharpening at the end of the pipeline
            .sharpen({
                sigma: 0.5,    // Light sharpening (0.5 is subtle)
                flat: 0.8,     // Moderate for flat areas
                jagged: 1.0    // Standard for edges
            })
            .toFile(outputPath);

        return outputPath;
    } catch (err) {
        console.error(`Error processing ${inputPath}:`, err);
        processedCache.delete(cacheKey);
        return null;
    }
}

/**
 * Sharpen original image without resizing it
 * This is important for zoom view which uses the original image
 */
async function processOriginalImage(inputPath, options = {}) {
    const {
        format = path.extname(inputPath).slice(1),
        quality = 85
    } = options;

    // Create a unique key for the cache
    const cacheKey = `original-${inputPath}-${format}`;
    if (processedCache.has(cacheKey)) {
        console.log(`Skipping original sharpening: ${path.basename(inputPath)}`);
        return null;
    }
    processedCache.add(cacheKey);

    // Output path will be same as input (overwrite original)
    const outputPath = inputPath;

    console.log(`Processing original for zoom view: ${path.basename(inputPath)}`);

    try {
        // Apply sharpening to the original image without resizing
        await sharp(inputPath)
        // Apply format conversion if needed
        [format]({ quality })
            // Apply sharpening at the end of the pipeline
            .sharpen({
                sigma: 0.5,    // Light sharpening
                flat: 0.8,     // Moderate for flat areas
                jagged: 1.0    // Standard for edges
            })
            .toFile(outputPath + '.temp');

        // Replace the original file with the sharpened version
        await fs.promises.rename(outputPath + '.temp', outputPath);

        return outputPath;
    } catch (err) {
        console.error(`Error processing original ${inputPath}:`, err);
        processedCache.delete(cacheKey);

        // Clean up temp file if it exists
        try {
            if (fs.existsSync(outputPath + '.temp')) {
                await fs.promises.unlink(outputPath + '.temp');
            }
        } catch (cleanupErr) {
            console.error(`Error cleaning up temp file: ${cleanupErr.message}`);
        }

        return null;
    }
}

async function processDirectory(dirPath, options = {}) {
    console.log(`[SCANNING] ${dirPath}`);
    try {
        const files = await fs.promises.readdir(dirPath);
        const imagePattern = /\.(png|jpe?g|webp)$/i;

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = await fs.promises.stat(fullPath);

            if (stat.isDirectory()) {
                await processDirectory(fullPath, options);
            } else if (imagePattern.test(file)) {
                if (shouldSkipFile(fullPath)) {
                    continue;
                }

                const baseName = path.basename(file, path.extname(file));
                if (/-\d+w/.test(baseName)) {
                    continue;
                }

                // First sharpen the original image for zoom view
                await processOriginalImage(fullPath);

                // Then create responsive versions
                for (const size of SIZES) {
                    await processImage(fullPath, { width: size, format: 'webp', quality: 85 });
                    await processImage(fullPath, { width: size, format: path.extname(file).slice(1), quality: 85 });
                }
            }
        }
    } catch (err) {
        console.error(`Error processing directory ${dirPath}:`, err);
    }
}

// Main execution
const [, , targetPath] = process.argv;
if (targetPath) {
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
        await processDirectory(targetPath);
    } else {
        if (!shouldSkipFile(targetPath)) {
            // First sharpen the original image for zoom view
            await processOriginalImage(targetPath);

            // Then create responsive versions
            for (const size of SIZES) {
                await processImage(targetPath, { width: size, format: 'webp', quality: 85 });
                await processImage(targetPath, { width: size, format: path.extname(targetPath).slice(1), quality: 85 });
            }
        }
    }
} else {
    console.error('Please provide a target path');
    process.exit(1);
}