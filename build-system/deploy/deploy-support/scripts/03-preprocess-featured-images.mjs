import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the project root by traversing up from the script location
// This ensures consistent paths regardless of where the script is run from
function getProjectRoot() {
    // This script is at: {{PROJECT_ROOT}}/dev/scripts/deploy/deploy-support/scripts/
    // Need to go up 6 levels to reach the project root
    let currentDir = __dirname;
    for (let i = 0; i < 6; i++) {
        currentDir = path.dirname(currentDir);
    }
    return currentDir;
}

const PROJECT_ROOT = getProjectRoot();
// The source directory is directly in the web directory
const SOURCE_DIR = path.join(PROJECT_ROOT, '{{DEPLOY_USER}}/public_html');

import sharp from 'sharp';

const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.log('[ERROR]', ...args),
    warn: (...args) => console.log('[WARN]', ...args),
    success: (...args) => console.log('[SUCCESS]', ...args),
    debug: (...args) => console.log('[DEBUG]', ...args)
};

async function ensureBuildDirectories(buildDir) {
    const publicHtmlDir = path.join(buildDir, 'public_html');
    const dataDir = path.join(publicHtmlDir, 'data');

    logger.debug('Directory structure:', {
        buildDir,
        publicHtmlDir,
        dataDir,
        cwd: process.cwd(),
        projectRoot: PROJECT_ROOT,
        sourceDir: SOURCE_DIR
    });

    fs.mkdirSync(dataDir, { recursive: true });

    // Use the SOURCE_DIR constant for reliable path resolution
    const sourceConfig = path.join(SOURCE_DIR, 'data/next-project.json');
    const targetConfig = path.join(dataDir, 'next-project.json');

    logger.debug('Config paths:', {
        source: sourceConfig,
        target: targetConfig
    });

    if (!fs.existsSync(sourceConfig)) {
        throw new Error(`Source config not found: ${sourceConfig}`);
    }

    fs.copyFileSync(sourceConfig, targetConfig);
    logger.info('Copied next-project.json to build directory');
}

async function findFeaturedImages(buildDir) {
    const configPath = path.join(buildDir, 'public_html/data/next-project.json');
    logger.info('Reading next-project.json from:', configPath);

    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const configData = JSON.parse(configContent);

        // Handle object-based project structure
        if (!configData || typeof configData !== 'object') {
            throw new Error('Invalid config format - expected object');
        }

        const featuredImages = new Set();

        // Extract imageBase from each project
        Object.values(configData).forEach(project => {
            if (project.imageBase) {
                logger.info(`Found featured image base: ${project.imageBase}`);
                featuredImages.add(`${project.imageBase}.png`);
            }
        });

        logger.info(`Found ${featuredImages.size} unique featured images`);
        return Array.from(featuredImages);
    } catch (error) {
        logger.error(`Config error: ${error.message}`);
        return [];
    }
}

async function processFeaturedImage(imagePath, buildDir) {
    logger.info(`Processing featured image: ${imagePath}`);
    const sizes = [320, 640, 960, 1200, 1800];

    // Use SOURCE_DIR for consistent path resolution
    const inputFile = path.join(SOURCE_DIR, imagePath);

    console.log(`Input file: ${inputFile}`);
    console.log(`Build dir: ${buildDir}`);

    const relativePath = path.dirname(imagePath.replace(/^\//, ''));
    console.log(`Relative path: ${relativePath}`);

    const outputBase = path.join(buildDir, 'public_html', relativePath);
    console.log(`Output base: ${outputBase}`);

    for (const size of sizes) {
        console.log(`Processing: ${path.basename(imagePath, path.extname(imagePath))} @ ${size}px`);

        for (const format of ['webp', 'png']) {
            const outputPath = path.join(
                outputBase,
                `${path.basename(imagePath, path.extname(imagePath))}-${size}w.${format}`
            );
            console.log(`Output ${format.toUpperCase()} Path: ${outputPath}`);

            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            console.log(`Creating ${format.toUpperCase()}: ${outputPath}`);

            // Process the image: resize first, then format conversion, then sharpen (optimal order)
            await sharp(inputFile)
                .resize(size, null, { withoutEnlargement: true })
                .toFormat(format)
                .sharpen({
                    sigma: 0.5,    // Light sharpening
                    flat: 0.8,     // Moderate for flat areas
                    jagged: 1.0    // Standard for edges
                })
                .toFile(outputPath);
        }
    }
}

async function main() {
    const buildDir = process.argv[2] || './build/temp';
    logger.info('Processing featured images...');

    try {
        const featuredImages = await findFeaturedImages(buildDir);
        for (const imagePath of featuredImages) {
            await processFeaturedImage(imagePath, buildDir);
        }
        logger.success('Featured image preprocessing complete');
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const buildDir = process.argv[2];
    ensureBuildDirectories(buildDir).then(() => main()).catch(error => {
        logger.error(error.message);
        process.exit(1);
    });
}

export default main;
