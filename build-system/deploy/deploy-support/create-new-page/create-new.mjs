#!/usr/bin/env node

/**
 * create-new.mjs
 * A script to create new portfolio projects in the {{DEPLOY_USER}} website.
 * 
 * Usage: node dev/scripts/deploy/deploy-support/create-new-page/create-new.mjs
 * 
 * This script will:
 * 1. Ask for company selection from predefined options
 * 2. Ask for project name
 * 3. Create project directory with URL-friendly name
 * 4. Create index.html based on template
 * 5. Create asset directories (images, videos, documents)
 * 6. Add placeholder files (image, video)
 * 7. Open the created index.html in VS Code for immediate editing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { exec } from 'child_process';

// Define paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../../../');
const publicHtmlDir = path.join(rootDir, 'public_html');

// Directories containing template and placeholder files
const templatesDir = path.join(__dirname, 'templates');
const placeholdersDir = path.join(__dirname, 'placeholders');

// Company options
const COMPANIES = [
    { value: 'mikmak', label: 'MikMak', logoAlt: 'MikMak Company Logo' },
    { value: 'logmein', label: 'LogMeIn', logoAlt: 'LogMeIn Company Logo' },
    { value: 'dataxu', label: 'DataXu', logoAlt: 'DataXu Company Logo' }
];

// Path to template file
const TEMPLATE_PATH = path.join(templatesDir, 'index-blank.html');

// Paths to placeholder files
const PLACEHOLDER_FILES = {
    primaryImage: path.join(placeholdersDir, 'placeholder-image.png'),
    featuredCover: path.join(placeholdersDir, 'featured--cover.png'),
    video: path.join(placeholdersDir, 'placeholder-video.mp4')
};

/**
 * Main function to execute the script
 */
async function main() {
    console.clear();
    console.log('\n=== CREATE NEW PORTFOLIO PROJECT ===\n');

    // Check if template file exists
    if (!fs.existsSync(TEMPLATE_PATH)) {
        console.error(`Template file not found: ${TEMPLATE_PATH}`);
        process.exit(1);
    }

    // Check if placeholder files exist
    const missingFiles = [];
    for (const [key, filePath] of Object.entries(PLACEHOLDER_FILES)) {
        if (!fs.existsSync(filePath)) {
            missingFiles.push(`${key}: ${filePath}`);
        }
    }

    if (missingFiles.length > 0) {
        console.warn(`Warning: Some placeholder files are missing:`);
        missingFiles.forEach(file => console.warn(`  - ${file}`));
    }

    try {
        // Create readline interface for user input
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Get company selection
        console.log('Select company:');
        COMPANIES.forEach((company, index) => {
            console.log(`  ${index + 1}. ${company.label}`);
        });

        const companyIndex = await new Promise((resolve) => {
            rl.question('\nEnter number (1-3): ', (answer) => {
                const index = parseInt(answer, 10) - 1;
                if (isNaN(index) || index < 0 || index >= COMPANIES.length) {
                    console.log('\nInvalid selection. Please try again.\n');
                    resolve(-1);
                } else {
                    resolve(index);
                }
            });
        });

        if (companyIndex === -1) {
            rl.close();
            return main(); // Restart if invalid selection
        }

        const company = COMPANIES[companyIndex];
        console.log(`\nSelected: ${company.label}`);

        // Get project name
        const projectName = await new Promise((resolve) => {
            rl.question('\nEnter project name: ', (answer) => {
                if (!answer.trim()) {
                    console.log('\nProject name cannot be empty. Please try again.');
                    rl.close();
                    resolve('');
                } else {
                    resolve(answer.trim());
                }
            });
        });

        if (projectName === '') {
            return main(); // Restart if empty name
        }

        // Create project URL slug
        const projectSlug = sanitizeForUrl(projectName);

        // Confirm the slug with user
        const confirmation = await new Promise((resolve) => {
            console.log(`\nProject name: "${projectName}"`);
            console.log(`URL slug:     "${projectSlug}"`);

            rl.question('\nIs this correct? [Y]es / [N]ew name / [C]ancel: ', (answer) => {
                const response = answer.trim().toLowerCase();
                if (response === '' || response === 'y' || response === 'yes') {
                    resolve('yes');
                } else if (response === 'n' || response === 'new') {
                    resolve('new');
                } else {
                    resolve('cancel');
                }
                rl.close();
            });
        });

        if (confirmation === 'cancel') {
            console.log('\nProject creation cancelled.');
            return;
        } else if (confirmation === 'new') {
            console.log('\nLet\'s try a different project name.\n');
            return main(); // Restart to enter a new name
        }

        // Create project structure
        await createProjectStructure(company, projectName, projectSlug);

        console.log('\n✅ Project created successfully!');
        console.log(`\nProject location: /public_html/portfolio/${company.value}/${projectSlug}/`);
        console.log('Assets created:');
        console.log(`  - /assets/images/portfolio/${company.value}/${projectSlug}/`);
        console.log(`  - /assets/videos/portfolio/${company.value}/${projectSlug}/`);
        console.log(`  - /assets/documents/portfolio/${company.value}/${projectSlug}/`);

    } catch (error) {
        console.error('\nError creating project:', error.message);
    }
}

/**
 * Convert string to URL-friendly slug
 * @param {string} string - Input string
 * @returns {string} - URL-friendly slug
 */
function sanitizeForUrl(string) {
    return string
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
        .replace(/\s+/g, '-')          // Replace spaces with hyphens
        .replace(/-+/g, '-')           // Remove consecutive hyphens
        .trim();
}

/**
 * Create project structure including directories and files
 * @param {Object} company - Company object with value and label
 * @param {string} projectName - Project name
 * @param {string} projectSlug - URL-friendly project slug
 */
async function createProjectStructure(company, projectName, projectSlug) {
    console.log('\nCreating project...');

    // Define paths
    const projectDir = path.join(publicHtmlDir, 'portfolio', company.value, projectSlug);
    const assetsBaseDir = path.join(publicHtmlDir, 'assets');

    // Check if project directory already exists
    if (fs.existsSync(projectDir)) {
        throw new Error(`Project directory already exists: ${projectDir}`);
    }

    // Create project directory
    fs.mkdirSync(projectDir, { recursive: true });
    console.log(`✓ Created directory: ${projectDir}`);

    // Create asset directories
    const assetTypes = ['images', 'videos', 'documents'];
    const assetDirs = {};

    for (const assetType of assetTypes) {
        const assetDir = path.join(assetsBaseDir, assetType, 'portfolio', company.value, projectSlug);
        fs.mkdirSync(assetDir, { recursive: true });
        assetDirs[assetType] = assetDir;
    }
    console.log('✓ Created asset directories');

    // Create index.html from template
    await createIndexFile(company, projectName, projectSlug, projectDir);

    // Add placeholder files
    await addPlaceholderFiles(assetDirs, company.value, projectSlug);

    // Open the created index.html in VS Code
    openIndexFileInVSCode(projectDir);
}

/**
 * Create index.html file from template
 * @param {Object} company - Company object
 * @param {string} projectName - Project name
 * @param {string} projectSlug - URL-friendly project slug
 * @param {string} projectDir - Project directory path
 */
async function createIndexFile(company, projectName, projectSlug, projectDir) {
    // Read template file
    let templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    // Replace placeholders
    const replacements = {
        'UPDATEmeta-description': `Explore the ${projectName} project by Dan Reis.`,
        'UPDATEtitle': `${projectName} | Dan Reis`,
        'UPDATEh1': projectName,
        'UPDATE, UPDATE, UPDATE': 'UX/UI Design, Product Design',
        'company-logo--mikmak.svg': `company-logo--${company.value}.svg`,
        'MikMak Company Logo': company.logoAlt,
        'mikmak/custom-report-builder': `${company.value}/${projectSlug}`,
        'UPDATEsummary-heading': 'Summary',
        'UPDATEsummary': 'Project summary goes here.',
        'UPDATEchallenges-heading': 'Challenge',
        'UPDATEchallenges': 'Project challenges go here.',
        'UPDATEsolution-heading': 'Solution',
        'UPDATEsolution': 'Project solution goes here.',
        'UPDATEcontent-card-title': 'Content Title',
        'UPDATEcontent-card-description': 'Content description goes here.',
        'UPDATEcarousel-aria-label': 'Project Process',
        'UPDATEcarousel-item-title': 'Carousel Item Title',
        'UPDATEcarousel-item-description': 'Carousel item description goes here.',
        'UPDATEcarousel-item-alt-text': 'Carousel image description',
        'UPDATEresults-heading': 'Results',
        'UPDATEresults-description': 'Project results go here.',
        'UPDATEkey-result-1-title': 'Key Result 1',
        'UPDATEkey-result-1-description': 'Description of key result 1.',
        'UPDATEkey-result-2-title': 'Key Result 2',
        'UPDATEkey-result-2-description': 'Description of key result 2.',
        'UPDATEkey-result-3-title': 'Key Result 3',
        'UPDATEkey-result-3-description': 'Description of key result 3.',
        'UPDATElearnings-heading': 'Learnings & Next Steps',
        'UPDATElearnings-description': 'Project learnings and next steps go here.'
    };

    // Apply all replacements
    for (const [placeholder, replacement] of Object.entries(replacements)) {
        templateContent = templateContent.replace(new RegExp(placeholder, 'g'), replacement);
    }

    // Fix asset paths for standard content
    templateContent = templateContent.replace(
        /\/assets\/images\/portfolio\/mikmak\/custom-report-builder\/placeholder-image\.png/g,
        `/assets/images/portfolio/${company.value}/${projectSlug}/placeholder-image.png`
    );

    templateContent = templateContent.replace(
        /\/assets\/videos\/portfolio\/mikmak\/custom-report-builder\/placeholder-video\.mp4/g,
        `/assets/videos/portfolio/${company.value}/${projectSlug}/placeholder-video.mp4`
    );

    // Fix asset paths for carousel content - this handles paths without company name
    templateContent = templateContent.replace(
        /\/assets\/videos\/portfolio\/custom-report-builder\/placeholder-video\.mp4/g,
        `/assets/videos/portfolio/${company.value}/${projectSlug}/placeholder-video.mp4`
    );

    templateContent = templateContent.replace(
        /\/assets\/images\/portfolio\/custom-report-builder\/placeholder-image\.png/g,
        `/assets/images/portfolio/${company.value}/${projectSlug}/placeholder-image.png`
    );

    // Fix the featured cover image path
    templateContent = templateContent.replace(
        /\/assets\/images\/portfolio\/mikmak\/custom-report-builder\/featured--cover\.png/g,
        `/assets/images/portfolio/${company.value}/${projectSlug}/featured--cover.png`
    );

    // Write the new index.html
    const indexPath = path.join(projectDir, 'index.html');
    fs.writeFileSync(indexPath, templateContent, 'utf8');
    console.log(`✓ Created index.html: ${indexPath}`);
}

/**
 * Add placeholder files to asset directories
 * @param {Object} assetDirs - Asset directories object
 * @param {string} company - Company value
 * @param {string} projectSlug - Project slug
 */
async function addPlaceholderFiles(assetDirs, company, projectSlug) {
    // Helper function to get the best available file path
    function getBestFilePath(key) {
        return PLACEHOLDER_FILES[key] || null;
    }

    // Copy placeholder image if available
    const placeholderImageSource = getBestFilePath('primaryImage');
    if (placeholderImageSource) {
        const placeholderImagePath = path.join(assetDirs.images, 'placeholder-image.png');
        fs.copyFileSync(placeholderImageSource, placeholderImagePath);
        console.log(`✓ Added placeholder image: ${placeholderImagePath}`);
    } else {
        console.warn('Warning: Could not copy placeholder image. Source file not found.');
    }

    // Copy featured cover image if available
    const featuredCoverSource = getBestFilePath('featuredCover');
    if (featuredCoverSource) {
        const featuredCoverPath = path.join(assetDirs.images, 'featured--cover.png');
        fs.copyFileSync(featuredCoverSource, featuredCoverPath);
        console.log(`✓ Added featured cover image: ${featuredCoverPath}`);
    } else {
        console.warn('Warning: Could not copy featured cover image. Source file not found.');
    }

    // Copy placeholder video if available
    const videoSource = getBestFilePath('video');
    if (videoSource) {
        const placeholderVideoPath = path.join(assetDirs.videos, 'placeholder-video.mp4');
        fs.copyFileSync(videoSource, placeholderVideoPath);
        console.log(`✓ Added placeholder video: ${placeholderVideoPath}`);
    } else {
        console.warn('Warning: Could not copy placeholder video. Source file not found.');
    }
}

/**
 * Open the created index.html file in VS Code
 * @param {string} projectDir - Project directory path
 */
function openIndexFileInVSCode(projectDir) {
    const indexPath = path.join(projectDir, 'index.html');
    exec(`code "${indexPath}"`, (error) => {
        if (error) {
            console.error('Error opening index.html in VS Code:', error.message);
        } else {
            console.log(`✓ Opened index.html in VS Code: ${indexPath}`);
        }
    });
}

// Execute the script
main().catch(console.error);