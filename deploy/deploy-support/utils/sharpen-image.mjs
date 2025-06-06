#!/usr/bin/env node

/**
 * sharpen-image.mjs
 * 
 * A utility to sharpen images for better clarity
 * 
 * Created: 2025-05-15
 * Author: Daniel Reis
 * 
 * Usage:
 *   node sharpen-image.mjs <imagePath> [options]
 * 
 * Options:
 *   --sigma=<value>    Controls the size of the mask (default: 0.8, range: 0.3-3.0)
 *   --flat=<value>     Controls flat areas (default: 1.0, range: 0.3-1.5)
 *   --jagged=<value>   Controls jagged areas (default: 1.2, range: 0.7-2.0)
 *   --suffix=<text>    Custom suffix for output filename (default: 'sharp')
 *   --overwrite        Overwrite the original file
 * 
 * Examples:
 *   node sharpen-image.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder/featured--cover.png
 *   node sharpen-image.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder/featured--cover.png --sigma=1.0 --flat=1.2 --jagged=1.5
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sharp from 'sharp';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default sharpening options
const DEFAULT_OPTIONS = {
  sigma: 0.8,   // Standard deviation of the Gaussian mask (0.3-3.0)
  flat: 1.0,    // Level of flat areas (0.3-1.5)
  jagged: 1.2,  // Level of jagged areas (0.7-2.0)
  suffix: 'sharp',
  overwrite: false
};

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const options = { ...DEFAULT_OPTIONS };
  
  // Extract the image path (first non-option argument)
  let imagePath = null;
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      // Parse option
      const [key, value] = arg.slice(2).split('=');
      
      if (key === 'overwrite') {
        options.overwrite = true;
      } else if (value !== undefined) {
        // For options with values
        if (['sigma', 'flat', 'jagged'].includes(key)) {
          options[key] = parseFloat(value);
        } else if (key === 'suffix') {
          options.suffix = value;
        }
      }
    } else {
      // This is the image path
      imagePath = arg;
    }
  }
  
  return { imagePath, options };
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

// Display help information
function showHelp() {
  console.log(`
Image Sharpening Utility

Usage:
  node sharpen-image.mjs <imagePath> [options]

Options:
  --sigma=<value>    Controls the size of the mask (default: 0.8, range: 0.3-3.0)
  --flat=<value>     Controls flat areas (default: 1.0, range: 0.3-1.5)
  --jagged=<value>   Controls jagged areas (default: 1.2, range: 0.7-2.0) 
  --suffix=<text>    Custom suffix for output filename (default: 'sharp')
  --overwrite        Overwrite the original file

Examples:
  node sharpen-image.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder/featured--cover.png
  node sharpen-image.mjs public_html/assets/images/portfolio/mikmak/custom-report-builder/featured--cover.png --sigma=1.0 --flat=1.2 --jagged=1.5
  `);
}

// Main function to sharpen an image
async function sharpenImage(imagePath, outputPath, options) {
  console.log('🔍 Image Sharpening Utility');
  console.log(`📄 Input:  ${imagePath}`);
  console.log(`📝 Output: ${outputPath}`);
  console.log(`⚙️  Settings: sigma=${options.sigma}, flat=${options.flat}, jagged=${options.jagged}`);
  
  try {
    // Check if input file exists
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Error: Input file doesn't exist: ${imagePath}`);
      process.exit(1);
    }
    
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get image info
    const imageInfo = await sharp(imagePath).metadata();
    console.log(`📊 Processing: ${imageInfo.width}x${imageInfo.height} ${imageInfo.format}`);
    
    // Apply sharpening
    console.log('✨ Applying sharpening...');
    await sharp(imagePath)
      .sharpen({
        sigma: options.sigma,
        flat: options.flat,
        jagged: options.jagged
      })
      .toFile(outputPath);
    
    console.log('✅ Image sharpened successfully!');
    console.log(`💾 Saved to: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error processing image: ${error.message}`);
    process.exit(1);
  }
}

// Main execution
(async () => {
  const { imagePath, options } = parseArguments();
  
  // Show help if no path provided
  if (!imagePath) {
    showHelp();
    process.exit(0);
  }
  
  // Resolve to absolute path if not already
  const absoluteImagePath = path.isAbsolute(imagePath) 
    ? imagePath 
    : path.resolve(process.cwd(), imagePath);
  
  // Get output path
  const outputPath = getOutputPath(absoluteImagePath, options);
  
  // Sharpen the image
  await sharpenImage(absoluteImagePath, outputPath, options);
})();
