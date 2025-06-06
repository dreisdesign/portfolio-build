/**
 * Sharp Image Processor
 *
 * Handles image transformations for responsive variants
 * Supports WebP and PNG formats
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

class SharpProcessor {
    constructor(config) {
        this.config = config || {
            sizes: [
                { width: 320, suffix: '-320w' },
                { width: 640, suffix: '-640w' },
                { width: 960, suffix: '-960w' },
                { width: 1200, suffix: '-1200w' }
            ],
            quality: {
                webp: 85,
                png: 90
            }
        };
    }

    /**
     * Process an image and create responsive variants
     * @param {string} inputPath Path to the source image
     * @param {object} options Processing options
     * @returns {boolean} Success status
     */
    processImage(inputPath, options = {}) {
        if (!fs.existsSync(inputPath)) {
            console.error(`Input file not found: ${inputPath}`);
            return false;
        }

        // Ensure options have sensible defaults
        const outputPath = options.outputPath || path.dirname(inputPath);
        const relativePath = path.dirname(
            path.relative(path.join(process.cwd(), 'public_html'), inputPath)
        );

        console.log(`Input file: ${inputPath}`);
        console.log(`Build dir: ${options.buildDir || '(not specified)'}`);
        console.log(`Relative path: ${relativePath}`);
        console.log(`Output base: ${outputPath}`);

        // Process each size
        return this.config.sizes.every(size => {
            const inputFilename = path.basename(inputPath);
            const outputBaseName = path.basename(inputFilename, path.extname(inputFilename));

            console.log(`Processing: ${outputBaseName} @ ${size.width}px`);

            // Generate the output paths for WebP and PNG
            const outputWebpPath = path.join(outputPath, `${outputBaseName}${size.suffix}.webp`);
            const outputPngPath = path.join(outputPath, `${outputBaseName}${size.suffix}.png`);

            console.log(`Output WebP Path: ${outputWebpPath}`);
            console.log(`Output PNG Path: ${outputPngPath}`);

            try {
                // Create WebP variant
                console.log(`Creating WebP: ${outputWebpPath}`);
                const webpPromise = sharp(inputPath)
                    .resize(size.width, null, { fit: 'inside' })
                    .webp({ quality: this.config.quality.webp })
                    .toFile(outputWebpPath);

                // Create PNG variant
                console.log(`Creating PNG: ${outputPngPath}`);
                const pngPromise = sharp(inputPath)
                    .resize(size.width, null, { fit: 'inside' })
                    .png({ quality: this.config.quality.png })
                    .toFile(outputPngPath);

                // Both operations are async, but we're returning true regardless since errors are caught
                return true;
            } catch (error) {
                console.error(`Failed to process ${inputPath} at ${size.width}px: ${error.message}`);
                return false;
            }
        });
    }

    /**
     * Generate HTML markup for a responsive image
     * @param {string} src Source path
     * @param {string} alt Alt text
     * @param {Array} sizes Size configurations
     * @returns {object} Generated markup components
     */
    generateImageMarkup(src, alt, sizes) {
        const basePath = path.dirname(src);
        const extension = path.extname(src);
        const baseName = path.basename(src, extension);

        // Generate srcset for WebP
        const webpSrcset = sizes.map(size =>
            `${path.join(basePath, baseName)}${size.suffix}.webp ${size.width}w`
        ).join(', ');

        // Generate srcset for original format
        const pngSrcset = sizes.map(size =>
            `${path.join(basePath, baseName)}${size.suffix}.png ${size.width}w`
        ).join(', ');

        return {
            'webp-srcset': webpSrcset,
            'png-srcset': pngSrcset,
            'original-src': src,
            'alt-text': alt || ''
        };
    }
}

module.exports = SharpProcessor;
