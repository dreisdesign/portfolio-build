/**
 * Image Processing Script - Source-First Approach
 *
 * Created: 2025-06-16
 * Version: 2.0.0
 * Author: Daniel Reis
 * License: MIT
 *
 * This version uses a much simpler, more robust approach:
 * - Starts from source directory (public_html/assets/images)
 * - Uses file modification times instead of checksums
 * - No cache files to manage or corrupt
 * - Self-healing when build outputs are missing
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sharp from 'sharp';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sizes for responsive images
const SIZES = [320, 640, 960, 1200, 1800];

// Statistics
let processedCount = 0;
let skippedCount = 0;

/**
 * Helper to check if a file should be skipped (favicon files, SVG, GIF)
 */
function shouldSkipFile(filePath) {
    const filename = path.basename(filePath);

    // Skip all favicon and related icon files
    if (
        filename.startsWith('favicon') ||
        filename.startsWith('apple-touch-icon') ||
        filename.startsWith('android-chrome') ||
        filename.startsWith('mstile') ||
        filename.includes('safari-pinned-tab') ||
        filename === 'browserconfig.xml' ||
        filename === 'site.webmanifest'
    ) {
        return true;
    }

    // Skip SVG and GIF files (no responsive processing needed)
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.svg' || ext === '.gif') {
        return true;
    }

    return false;
}

/**
 * Get file modification time
 */
async function getFileTime(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return stats.mtime.getTime();
    } catch {
        return 0; // File doesn't exist
    }
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Calculate all expected build output paths for a source image
 */
function getBuildOutputPaths(sourceImagePath, buildRoot) {
    // Convert source path to build path
    const relativePath = path.relative('public_html', sourceImagePath);
    const buildDir = path.join(buildRoot, 'temp/public_html', path.dirname(relativePath));
    const baseName = path.basename(sourceImagePath, path.extname(sourceImagePath));
    const ext = path.extname(sourceImagePath);

    const outputs = [];

    // Sharpened original
    outputs.push(path.join(buildDir, `${baseName}-original${ext}`));

    // Responsive variants
    for (const size of SIZES) {
        outputs.push(path.join(buildDir, `${baseName}-${size}w.webp`));
        outputs.push(path.join(buildDir, `${baseName}-${size}w${ext}`));
    }

    return outputs;
}

/**
 * Check if source image needs processing
 */
async function needsProcessing(sourceImagePath, buildRoot, buildImagePath = null) {
    const outputPaths = getBuildOutputPaths(sourceImagePath, buildRoot);

    // Check if all outputs exist first
    let oldestOutputTime = Infinity;
    for (const outputPath of outputPaths) {
        const outputTime = await getFileTime(outputPath);
        if (outputTime === 0) {
            // Output missing, need to process
            return true;
        }
        if (outputTime < oldestOutputTime) {
            oldestOutputTime = outputTime;
        }
    }

    // All outputs exist, check if source is newer than oldest output
    const compareTime = await getFileTime(sourceImagePath);

    if (compareTime > oldestOutputTime) {
        return true; // Source is newer, need to process
    }

    return false; // All outputs exist and are newer than source
}

/**
 * Process a single responsive image variant
 */
async function processImageVariant(inputPath, width, format, quality = 85) {
    const outputDir = path.dirname(inputPath);
    const outputBase = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(outputDir, `${outputBase}-${width}w.${format}`);

    console.log(`  Creating ${format}@${width}px`);

    try {
        await sharp(inputPath)
            .resize(width)
        [format]({ quality })
            .sharpen({
                sigma: 0.5,    // Light sharpening
                flat: 0.8,     // Moderate for flat areas  
                jagged: 1.0    // Standard for edges
            })
            .toFile(outputPath);

        return outputPath;
    } catch (err) {
        console.error(`  ❌ Error creating ${format}@${width}px:`, err.message);
        return null;
    }
}

/**
 * Create sharpened original image
 */
async function processOriginalImage(sourceImagePath, buildImagePath) {
    const buildDir = path.dirname(buildImagePath);
    const baseName = path.basename(buildImagePath, path.extname(buildImagePath));
    const ext = path.extname(buildImagePath);
    const outputPath = path.join(buildDir, `${baseName}-original${ext}`);

    console.log(`  Creating sharpened original`);

    try {
        const format = ext.slice(1); // Remove the dot
        await sharp(sourceImagePath)
        [format]({ quality: 85 })
            .sharpen({
                sigma: 0.5,
                flat: 0.8,
                jagged: 1.0
            })
            .toFile(outputPath);

        return outputPath;
    } catch (err) {
        console.error(`  ❌ Error creating sharpened original:`, err.message);
        return null;
    }
}

/**
 * Process all variants for a single source image
 */
async function processImageSet(sourceImagePath, buildRoot) {
    // Calculate build paths
    const relativePath = path.relative('public_html', sourceImagePath);
    const buildImagePath = path.join(buildRoot, 'temp/public_html', relativePath);
    const buildDir = path.dirname(buildImagePath);

    // Ensure build directory exists
    await fs.mkdir(buildDir, { recursive: true });

    // Copy source to build location (unchanged)
    await fs.copyFile(sourceImagePath, buildImagePath);

    // Create sharpened original
    await processOriginalImage(sourceImagePath, buildImagePath);

    // Create responsive variants
    const ext = path.extname(sourceImagePath);
    for (const size of SIZES) {
        await processImageVariant(buildImagePath, size, 'webp');
        await processImageVariant(buildImagePath, size, ext.slice(1));
    }
}

/**
 * Process a single source image if needed
 */
async function processSourceImage(sourceImagePath, buildRoot, buildImagePath = null) {
    if (shouldSkipFile(sourceImagePath)) {
        return;
    }

    // Check if processing is needed
    const needs = await needsProcessing(sourceImagePath, buildRoot, buildImagePath);

    if (!needs) {
        console.log(`⏭️  Skipping: ${path.basename(sourceImagePath)} (up to date)`);
        skippedCount++;
        return;
    }

    console.log(`🔄 Processing: ${path.basename(sourceImagePath)}`);

    try {
        await processImageSet(sourceImagePath, buildRoot);
        processedCount++;
        console.log(`✅ Completed: ${path.basename(sourceImagePath)}`);
    } catch (error) {
        console.error(`❌ Failed: ${path.basename(sourceImagePath)} - ${error.message}`);
        processedCount++; // Count as processed to avoid infinite loops
    }
}

/**
 * Recursively process all images in a source directory
 */
async function processSourceDirectory(sourceDirPath, buildRoot) {
    console.log(`[SCANNING] ${sourceDirPath}`);

    try {
        const files = await fs.readdir(sourceDirPath);
        const imagePattern = /\.(png|jpe?g|webp)$/i;

        for (const file of files) {
            const fullPath = path.join(sourceDirPath, file);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                await processSourceDirectory(fullPath, buildRoot);
            } else if (imagePattern.test(file)) {
                // Skip processed variants that might be in source (shouldn't happen but just in case)
                const baseName = path.basename(file, path.extname(file));
                if (/-\d+w$/.test(baseName) || baseName.endsWith('-original')) {
                    continue;
                }

                await processSourceImage(fullPath, buildRoot);
            }
        }
    } catch (err) {
        console.error(`❌ Error scanning directory ${sourceDirPath}:`, err.message);
    }
}

/**
 * Main execution
 */
async function main() {
    const [, , targetPath] = process.argv;

    if (!targetPath) {
        console.error('❌ Please provide a target path');
        process.exit(1);
    }

    // Determine build root and source path
    let buildRoot, sourcePath, buildImagePath = null;

    if (targetPath.includes('public_html') && !targetPath.includes('build')) {
        // Processing from source directory
        sourcePath = targetPath;
        buildRoot = 'build';
    } else if (targetPath.includes('build')) {
        // Convert build path to source path for backwards compatibility
        buildRoot = targetPath.includes('build/temp')
            ? targetPath.split('build/temp')[0] + 'build'
            : 'build';

        if (targetPath === 'build/temp') {
            // Full directory processing
            sourcePath = 'public_html/assets/images';
        } else {
            // Single file processing  
            const relativePath = targetPath.replace(/.*build\/temp\/public_html\//, '');
            sourcePath = path.join('public_html', relativePath);
        }
        buildImagePath = targetPath; // Keep the build path for timestamp comparison
    } else {
        console.error('❌ Invalid target path. Must be in public_html or build directory.');
        process.exit(1);
    }

    const startTime = Date.now();
    processedCount = 0;
    skippedCount = 0;

    console.log(`🚀 Starting image processing...`);
    console.log(`📁 Source: ${sourcePath}`);
    console.log(`🏗️  Build: ${buildRoot}`);

    try {
        const sourceExists = await fileExists(sourcePath);
        if (!sourceExists) {
            console.error(`❌ Source path does not exist: ${sourcePath}`);
            process.exit(1);
        }

        const stat = await fs.stat(sourcePath);

        if (stat.isDirectory()) {
            await processSourceDirectory(sourcePath, buildRoot);
        } else {
            await processSourceImage(sourcePath, buildRoot, buildImagePath);
        }

    } catch (error) {
        console.error('❌ Error during image processing:', error.message);
        process.exit(1);
    }

    // Report results
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    const total = processedCount + skippedCount;
    const speedup = total > 0 ? Math.round((skippedCount / total) * 100) : 0;

    console.log(`\n📊 Image processing complete:`);
    console.log(`   • ${processedCount} images processed`);
    console.log(`   • ${skippedCount} images skipped`);
    console.log(`   • ${duration}s total time`);
    if (speedup > 0) {
        console.log(`   • ${speedup}% build time saved`);
    }
}

// Run main function
main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});
