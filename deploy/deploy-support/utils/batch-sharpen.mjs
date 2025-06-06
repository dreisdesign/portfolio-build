#!/usr/bin/env node

/**
 * batch-sharpen.mjs
 * 
 * A utility to batch sharpen multiple images in a directory
 * 
 * Created: 2025-05-15
 * Author: Daniel Reis
 * 
 * Usage:
 *   node batch-sharpen.mjs <directoryPath> [options]
 * 
 * Options:
 *   --sigma=<value>    Controls the size of the mask (default: 0.8, range: 0.3-3.0)
 *   --flat=<value>     Controls flat areas (default: 1.0, range: 0.3-1.5)
 *   --jagged=<value>   Controls jagged areas (default: 1.2, range: 0.7-2.0)
 *   --suffix=<text>    Custom suffix for output filename (default: 'sharp')
 *   --overwrite        Overwrite the original files
 *   --extensions=jpg,png,jpeg  Comma-separated list of extensions to process
 *   --dry-run          Show which files would be processed without processing them
 * 
 * Examples:
 *   node batch-sharpen.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder
 *   node batch-sharpen.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder --sigma=1.0 --flat=1.2 --jagged=1.5
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sharp from 'sharp';
import { promisify } from 'util';
import glob from 'glob';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const globPromise = promisify(glob);

// Default options
const DEFAULT_OPTIONS = {
    sigma: 0.8,
    flat: 1.0,
    jagged: 1.2,
    suffix: 'sharp',
    overwrite: false,
    extensions: ['jpg', 'jpeg', 'png'],
    dryRun: false
};

// Parse command line arguments
function parseArguments() {
    const args = process.argv.slice(2);
    const options = { ...DEFAULT_OPTIONS };

    // Extract the directory path (first non-option argument)
    let directoryPath = null;

    for (const arg of args) {
        if (arg.startsWith('--')) {
            // Parse option
            const [key, value] = arg.slice(2).split('=');

            if (key === 'overwrite') {
                options.overwrite = true;
            } else if (key === 'dry-run') {
                options.dryRun = true;
            } else if (value !== undefined) {
                // For options with values
                if (['sigma', 'flat', 'jagged'].includes(key)) {
                    options[key] = parseFloat(value);
                } else if (key === 'suffix') {
                    options.suffix = value;
                } else if (key === 'extensions') {
                    options.extensions = value.split(',').map(ext => ext.trim().toLowerCase());
                }
            }
        } else {
            // This is the directory path
            directoryPath = arg;
        }
    }

    return { directoryPath, options };
}

// Generate output path based on input path and options
function getOutputPath(imagePath, options) {
    const ext = path.extname(imagePath);
    const baseName = path.basename(imagePath, ext);
    const dirName = path.dirname(imagePath);

    if (options.overwrite) {
        return imagePath;
    }

    return path.join(dirName, `${baseName}--${options.suffix}${ext}`);
}

// Sharpen a single image
async function sharpenImage(imagePath, options) {
    const outputPath = getOutputPath(imagePath, options);

    console.log(`📄 Processing: ${path.basename(imagePath)}`);

    if (options.dryRun) {
        console.log(`   Would save to: ${path.basename(outputPath)}`);
        return;
    }

    try {
        // Get image info
        const imageInfo = await sharp(imagePath).metadata();

        // Apply sharpening
        await sharp(imagePath)
            .sharpen({
                sigma: options.sigma,
                flat: options.flat,
                jagged: options.jagged
            })
            .toFile(outputPath);

        console.log(`   ✅ Saved to: ${path.basename(outputPath)}`);
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
    }
}

// Process all images in a directory
async function processDirectory(directoryPath, options) {
    try {
        // Make sure the directory exists
        if (!fs.existsSync(directoryPath)) {
            console.error(`❌ Error: Directory doesn't exist: ${directoryPath}`);
            process.exit(1);
        }

        // Create the pattern for matching files
        const extensionPattern = options.extensions.map(ext => ext.startsWith('.') ? ext.slice(1) : ext).join(',');
        const pattern = path.join(directoryPath, `**/*.{${extensionPattern}}`);

        console.log('🔍 Image Batch Sharpening Utility');
        console.log(`📁 Searching for images in: ${directoryPath}`);
        console.log(`🔎 Pattern: ${pattern}`);
        console.log(`⚙️  Settings: sigma=${options.sigma}, flat=${options.flat}, jagged=${options.jagged}`);

        if (options.dryRun) {
            console.log('📋 DRY RUN: No files will be modified');
        }

        // Find all matching files
        const files = await globPromise(pattern, { nodir: true });

        // Filter out files that already have the suffix
        const filesToProcess = files.filter(file => {
            const basename = path.basename(file, path.extname(file));
            return !basename.endsWith(`--${options.suffix}`);
        });

        console.log(`\n🖼️  Found ${filesToProcess.length} images to process\n`);

        // Process each file
        for (const file of filesToProcess) {
            await sharpenImage(file, options);
        }

        console.log('\n✅ Batch processing complete!');
        console.log(`📊 Processed ${filesToProcess.length} images\n`);
    } catch (error) {
        console.error(`\n❌ Error during batch processing: ${error.message}`);
        process.exit(1);
    }
}

// Display help information
function showHelp() {
    console.log(`
Image Batch Sharpening Utility

Usage:
  node batch-sharpen.mjs <directoryPath> [options]

Options:
  --sigma=<value>          Controls the size of the mask (default: 0.8, range: 0.3-3.0)
  --flat=<value>           Controls flat areas (default: 1.0, range: 0.3-1.5)
  --jagged=<value>         Controls jagged areas (default: 1.2, range: 0.7-2.0)
  --suffix=<text>          Custom suffix for output filename (default: 'sharp')
  --overwrite              Overwrite the original files
  --extensions=jpg,png,jpeg Comma-separated list of extensions to process (default: jpg,jpeg,png)
  --dry-run                Show which files would be processed without actually processing them

Examples:
  node batch-sharpen.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder
  node batch-sharpen.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder --sigma=1.0 --flat=1.2 --jagged=1.5 --suffix=enhanced
  `);
}

// Main execution
(async () => {
    const { directoryPath, options } = parseArguments();

    // Show help if no path provided
    if (!directoryPath) {
        showHelp();
        process.exit(0);
    }

    // Resolve to absolute path if not already
    const absoluteDirPath = path.isAbsolute(directoryPath)
        ? directoryPath
        : path.resolve(process.cwd(), directoryPath);

    // Process the directory
    await processDirectory(absoluteDirPath, options);
})();
