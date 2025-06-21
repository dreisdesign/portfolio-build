/**
 * Git-Based Image Processing Script
 * 
 * A simple, fast approach that only processes images that have actually changed
 * according to git, plus any missing output files (self-healing).
 * 
 * Created: 2025-06-17
 * Version: 2.0.0 (Clean rewrite)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';

const SIZES = [320, 640, 960, 1200, 1800];

// Get CLI arguments
const buildPath = process.argv[2] || 'build/temp';
const forceAll = process.argv.includes('--force-all');

// Set up paths
const workingDir = process.cwd();
const buildDir = path.resolve(workingDir, buildPath);
const sourceImagesDir = path.join(workingDir, 'public_html/assets/images');
const buildImagesDir = path.join(buildDir, 'public_html/assets/images');

console.log('🚀 Starting git-based image processing...');
console.log(`📁 Source: ${path.relative(workingDir, sourceImagesDir)}`);
console.log(`🏗️  Build: ${path.relative(workingDir, buildDir)}`);

// Get changed images from git
function getChangedImages() {
    if (forceAll) {
        console.log('🔄 Force mode: Processing all images');
        return null; // null means process all
    }

    try {
        // Get list of changed image files from git (both committed and uncommitted changes)
        const commands = [
            'git diff --name-only',           // Unstaged changes
            'git diff --name-only --cached',  // Staged changes  
            'git diff --name-only HEAD~1 HEAD' // Last commit changes
        ];

        const allChangedFiles = new Set();

        for (const command of commands) {
            const gitOutput = execSync(command, {
                encoding: 'utf8',
                cwd: workingDir
            }).trim();

            if (gitOutput) {
                gitOutput.split('\n').forEach(file => allChangedFiles.add(file));
            }
        }

        if (allChangedFiles.size === 0) {
            console.log('📋 No changes detected by git');
            return [];
        }

        const changedFiles = Array.from(allChangedFiles)
            .filter(file => file.startsWith('public_html/assets/images/'))
            .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file));

        console.log(`🔍 Git detected ${changedFiles.length} changed image(s):`);
        changedFiles.forEach(file => console.log(`   • ${file}`));

        return changedFiles;
    } catch (error) {
        console.log('⚠️  Git detection failed, processing all images');
        return null;
    }
}

// Check if an image needs processing
function needsProcessing(imagePath, changedImages) {
    const relativePath = path.relative(workingDir, imagePath);

    // If we're in force-all mode, process everything
    if (forceAll || changedImages === null) return true;

    // If git says it changed, process it
    if (changedImages.includes(relativePath)) return true;

    // Check if any output files are missing (self-healing)
    const imageDir = path.dirname(imagePath.replace(sourceImagesDir, buildImagesDir));
    const baseName = path.basename(imagePath, path.extname(imagePath));

    // Check for missing responsive variants
    for (const size of SIZES) {
        const webpPath = path.join(imageDir, `${baseName}-${size}w.webp`);
        const pngPath = path.join(imageDir, `${baseName}-${size}w.png`);

        if (!fs.existsSync(webpPath) || !fs.existsSync(pngPath)) {
            console.log(`🔧 Missing output for ${path.basename(imagePath)} - regenerating`);
            return true;
        }
    }

    return false;
}

// Process a single image
async function processImage(imagePath) {
    const imageDir = path.dirname(imagePath.replace(sourceImagesDir, buildImagesDir));
    const baseName = path.basename(imagePath, path.extname(imagePath));

    // Ensure output directory exists
    fs.mkdirSync(imageDir, { recursive: true });

    console.log(`🔄 Processing: ${path.basename(imagePath)}`);

    try {
        // Copy and sharpen original
        const sharpOriginalPath = path.join(imageDir, path.basename(imagePath));
        await sharp(imagePath)
            .sharpen(0.5, 0.8, 1.0)
            .toFile(sharpOriginalPath);
        console.log(`  Creating sharpened original`);

        // Create responsive variants
        for (const size of SIZES) {
            const webpPath = path.join(imageDir, `${baseName}-${size}w.webp`);
            const pngPath = path.join(imageDir, `${baseName}-${size}w.png`);

            console.log(`  Creating webp@${size}px`);
            await sharp(imagePath)
                .resize(size, null, { withoutEnlargement: true })
                .sharpen(0.5, 0.8, 1.0)
                .webp({ quality: 90 })
                .toFile(webpPath);

            console.log(`  Creating png@${size}px`);
            await sharp(imagePath)
                .resize(size, null, { withoutEnlargement: true })
                .sharpen(0.5, 0.8, 1.0)
                .png({ quality: 90 })
                .toFile(pngPath);
        }

        console.log(`✅ Completed: ${path.basename(imagePath)}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to process ${path.basename(imagePath)}:`, error.message);
        return false;
    }
}

// Recursively find all image files
function findImages(dir) {
    const images = [];

    if (!fs.existsSync(dir)) return images;

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            images.push(...findImages(fullPath));
        } else if (/\.(png|jpg|jpeg)$/i.test(item)) {
            // Skip favicon files
            if (item.startsWith('favicon') ||
                item.startsWith('apple-touch-icon') ||
                item.startsWith('android-chrome') ||
                item.startsWith('mstile') ||
                item === 'safari-pinned-tab.svg') {
                continue;
            }
            images.push(fullPath);
        }
    }

    return images;
}

// Main processing function
async function processImages() {
    const startTime = Date.now();

    // Get changed images from git
    const changedImages = getChangedImages();

    // Find all images in source
    const allImages = findImages(sourceImagesDir);
    console.log(`\n📊 Found ${allImages.length} total images`);

    // Filter to only images that need processing
    const imagesToProcess = allImages.filter(imagePath => needsProcessing(imagePath, changedImages));

    if (imagesToProcess.length === 0) {
        console.log('✅ No images need processing');
        return;
    }

    console.log(`🎯 Processing ${imagesToProcess.length} images:\n`);

    let processed = 0;
    let failed = 0;

    for (const imagePath of imagesToProcess) {
        const success = await processImage(imagePath);
        if (success) {
            processed++;
        } else {
            failed++;
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Image processing complete!`);
    console.log(`   Processed: ${processed} images`);
    console.log(`   Failed: ${failed} images`);
    console.log(`   Time: ${elapsed}s`);
}

// Run the processing
processImages().catch(error => {
    console.error('💥 Image processing failed:', error);
    process.exit(1);
});
