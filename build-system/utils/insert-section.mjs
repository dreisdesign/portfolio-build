#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to extract project path from HTML file path
function getProjectPath(htmlPath) {
    // Extract the project-specific path from the HTML file
    // E.g., /Users/.../portfolio/mikmak/vip-user-testing/index.html -> mikmak/vip-user-testing
    const portfolioMatch = htmlPath.match(/\/portfolio\/(.+?)\/index\.html$/);
    return portfolioMatch ? portfolioMatch[1] : 'placeholder';
}

// Function to ensure placeholder assets exist
async function ensurePlaceholderAssets(projectPath) {
    const publicRoot = path.resolve(__dirname, '../../../../../public_html');
    const imagePath = path.join(publicRoot, 'assets', 'images', 'portfolio', projectPath, 'placeholder-image.png');
    const videoPath = path.join(publicRoot, 'assets', 'videos', 'portfolio', projectPath, 'placeholder-video.mp4');

    const imageDir = path.dirname(imagePath);
    const videoDir = path.dirname(videoPath);

    // Create directories if they don't exist
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
        console.log(`📁 Created directory: ${imageDir}`);
    }
    if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
        console.log(`📁 Created directory: ${videoDir}`);
    }

    // Create placeholder image if it doesn't exist
    if (!fs.existsSync(imagePath)) {
        try {
            // Try to copy from a global placeholder if it exists
            const globalImagePlaceholder = path.join(publicRoot, 'assets', 'images', 'portfolio', 'placeholder-image.png');
            if (fs.existsSync(globalImagePlaceholder)) {
                fs.copyFileSync(globalImagePlaceholder, imagePath);
                console.log(`📋 Copied placeholder image to: ${imagePath}`);
            } else {
                // Create a simple text file as placeholder
                const placeholderContent = `Placeholder image for ${projectPath}\nReplace this file with actual image content.`;
                fs.writeFileSync(imagePath.replace('.png', '.txt'), placeholderContent);
                console.log(`📝 Created placeholder text file: ${imagePath.replace('.png', '.txt')}`);
                console.log(`⚠️  Note: Add actual placeholder-image.png to ${imageDir}`);
            }
        } catch (error) {
            console.log(`⚠️  Could not create image placeholder: ${error.message}`);
        }
    } else {
        console.log(`✅ Placeholder image already exists: ${imagePath}`);
    }

    // Create placeholder video if it doesn't exist
    if (!fs.existsSync(videoPath)) {
        try {
            // Try to copy from a global placeholder if it exists
            const globalVideoPlaceholder = path.join(publicRoot, 'assets', 'videos', 'portfolio', 'placeholder-video.mp4');
            if (fs.existsSync(globalVideoPlaceholder)) {
                fs.copyFileSync(globalVideoPlaceholder, videoPath);
                console.log(`📋 Copied placeholder video to: ${videoPath}`);
            } else {
                // Create a simple text file as placeholder
                const placeholderContent = `Placeholder video for ${projectPath}\nReplace this file with actual video content.`;
                fs.writeFileSync(videoPath.replace('.mp4', '.txt'), placeholderContent);
                console.log(`📝 Created placeholder text file: ${videoPath.replace('.mp4', '.txt')}`);
                console.log(`⚠️  Note: Add actual placeholder-video.mp4 to ${videoDir}`);
            }
        } catch (error) {
            console.log(`⚠️  Could not create video placeholder: ${error.message}`);
        }
    } else {
        console.log(`✅ Placeholder video already exists: ${videoPath}`);
    }

    return { imagePath, videoPath };
}

// Function to generate sections with project-specific paths
function generateSections(projectPath) {
    const imageSrc = `/assets/images/portfolio/${projectPath}/placeholder-image.png`;
    const videoSrc = `/assets/videos/portfolio/${projectPath}/placeholder-video.mp4`;

    return {
        image: `                <!-- CASE STUDY CONTENT CARD (Image) -->\n                <section class="content">\n                    <picture>\n                        <img src="${imageSrc}" alt=""\n                            width="1200" height="648" loading="lazy" data-responsive="true" />\n                    </picture>\n                    <p class="content-caption">\n                        <b>UPDATEcontent-card-title</b>\n                        <span class="spacer"></span> UPDATEcontent-card-description\n                    </p>\n                </section>`,
        video: `                <!-- CASE STUDY CONTENT CARD (VIDEO) -->\n                <section class="content">\n                    <div class="video-wrapper">\n                        <div class="overlay"></div>\n                        <video class="standard-video" playsinline muted loop preload="none" width="100%" height="auto">\n                            <source src="${videoSrc}"\n                                type="video/mp4">\n                            Your browser does not support the video tag.\n                        </video>\n                    </div>\n                    <p class="content-caption">\n                        <b>UPDATEcontent-card-title</b>\n                        <span class="spacer"></span> UPDATEcontent-card-description\n                    </p>\n                </section>`,
        carousel: `                <!-- CASE STUDY CONTENT Card (CAROUSEL) -->\n                <section class="content">\n                    <div class="carousel-source" aria-label="UPDATEcarousel-aria-label">\n                        <div class="carousel-slide-source">\n                            <div class="video-wrapper">\n                                <div class="overlay"></div>\n                                <video class="standard-video" playsinline muted loop preload="none" width="100%"\n                                    height="auto">\n                                    <source src="${videoSrc}"\n                                        type="video/mp4">\n                                    Your browser does not support the video tag.\n                                </video>\n                            </div>\n                            <div class="carousel-caption-source"><b>UPDATEcarousel-item-title:</b>\n                                UPDATEcarousel-item-description-or-bulleted-list\n                            </div>\n                        </div>\n                        <div class="carousel-slide-source">\n                            <img src="${imageSrc}"\n                                alt="UPDATEcarousel-item-alt-text" data-responsive="true" />\n                            <div class="carousel-caption-source"><b>UPDATEcarousel-item-title:</b>\n                                UPDATEcarousel-item-description-or-bulleted-list\n                            </div>\n                        </div>\n                        <div class="carousel-slide-source">\n                            <img src="${imageSrc}"\n                                alt="UPDATEcarousel-item-alt-text" data-responsive="true" />\n                            <div class="carousel-caption-source"><b>UPDATEcarousel-item-title:</b>\n                                UPDATEcarousel-item-description-or-bulleted-list\n                            </div>\n                        </div>\n                        <div class="carousel-slide-source">\n                            <img src="${imageSrc}"\n                                alt="UPDATEcarousel-item-alt-text" data-responsive="true" />\n                            <div class="carousel-caption-source"><b>UPDATEcarousel-item-title:</b>\n                                UPDATEcarousel-item-description-or-bulleted-list\n                            </div>\n                        </div>\n                        <div class="carousel-slide-source">\n                            <img src="${imageSrc}"\n                                alt="UPDATEcarousel-item-alt-text" data-responsive="true" />\n                            <div class="carousel-caption-source"><b>UPDATEcarousel-item-title:</b>\n                                UPDATEcarousel-item-description-or-bulleted-list\n                            </div>\n                        </div>\n                    </div>\n                </section>`
    };
}

// Polyfills for Node.js versions < 18
if (!Array.prototype.findLastIndex) {
    Array.prototype.findLastIndex = function (predicate) {
        for (let i = this.length - 1; i >= 0; i--) {
            if (predicate(this[i], i, this)) return i;
        }
        return -1;
    };
}
if (!Array.prototype.findLast) {
    Array.prototype.findLast = function (predicate) {
        const index = this.findLastIndex(predicate);
        return index !== -1 ? this[index] : undefined;
    };
}
if (!Array.prototype.at) {
    Array.prototype.at = function (index) {
        return index >= 0 ? this[index] : this[this.length + index];
    };
}

// Old hardcoded sections removed - now using generateSections() function

async function main() {
    console.log(`\n[insert-section]`);
    let defaultHtmlPath = process.env.VSCODE_ACTIVE_FILE;
    if (!defaultHtmlPath) {
        const projectRoot = path.resolve(__dirname, '../../../../../public_html');
        defaultHtmlPath = path.join(projectRoot, 'index.html');
    }

    // Check if we're in VS Code and handle unsaved changes
    if (process.env.VSCODE_ACTIVE_FILE) {
        console.log('⚠️  IMPORTANT: This script will modify the file externally.');
        console.log('   Any unsaved changes in VS Code could cause conflicts.');
        console.log('');

        const { saveOption } = await inquirer.prompt([
            {
                type: 'list',
                name: 'saveOption',
                message: 'How would you like to handle this?',
                choices: [
                    { name: '💾 Auto-save the file in VS Code and continue', value: 'auto' },
                    { name: '✅ I already saved - continue', value: 'saved' },
                    { name: '🚪 Cancel and let me save manually', value: 'cancel' }
                ],
                default: 'auto'
            }
        ]);

        if (saveOption === 'cancel') {
            console.log('👍 Please save your changes in VS Code and run the script again.');
            process.exit(0);
        } else if (saveOption === 'auto') {
            try {
                const { execSync } = await import('child_process');
                console.log('💾 Attempting to save file in VS Code...');
                // Use AppleScript to trigger save in VS Code on macOS
                execSync(`osascript -e 'tell application "Visual Studio Code" to activate' -e 'tell application "System Events" to keystroke "s" using command down'`);
                console.log('✅ Save command sent to VS Code');

                // Wait a moment for the save to complete
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.log('❌ Could not auto-save. Please save manually in VS Code.');
                const { manualSave } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'manualSave',
                        message: 'Have you now saved the file manually?',
                        default: false
                    }
                ]);

                if (!manualSave) {
                    console.log('👍 Please save your changes and run the script again.');
                    process.exit(0);
                }
            }
        }

        console.log('🚀 Proceeding with file modification...\n');
    }

    const { htmlPath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'htmlPath',
            message: 'Path to HTML file to modify:',
            default: defaultHtmlPath,
            validate: p => fs.existsSync(p) && fs.statSync(p).isFile() ? true : 'File does not exist.'
        }
    ]);

    // Extract project path and ensure assets exist
    const projectPath = getProjectPath(htmlPath);
    console.log(`🎯 Detected project: ${projectPath}`);

    await ensurePlaceholderAssets(projectPath);

    // Generate sections with project-specific paths
    const sections = generateSections(projectPath);

    const htmlLines = fs.readFileSync(htmlPath, 'utf8').split('\n');
    const { insertLine } = await inquirer.prompt([
        {
            type: 'number',
            name: 'insertLine',
            message: `Insert after which line number? (1-${htmlLines.length})`,
            default: htmlLines.length,
            validate: n => n > 0 && n <= htmlLines.length ? true : `Must be between 1 and ${htmlLines.length}`
        }
    ]);

    const { sectionType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'sectionType',
            message: 'Section type to insert:',
            choices: [
                { name: 'Image', value: 'image' },
                { name: 'Video', value: 'video' },
                { name: 'Carousel', value: 'carousel' }
            ]
        }
    ]);

    const snippet = sections[sectionType];
    htmlLines.splice(insertLine, 0, snippet);
    fs.writeFileSync(htmlPath, htmlLines.join('\n'), 'utf8');

    console.log('Section inserted!');
    console.log(`✅ Added ${sectionType} section after line ${insertLine}`);
    console.log(`📁 Using assets from: /assets/images/portfolio/${projectPath}/`);

    // Force VS Code to reload the file by touching it with a newer timestamp
    if (process.env.VSCODE_ACTIVE_FILE) {
        try {
            const { execSync } = await import('child_process');
            // Touch the file to update its timestamp and trigger VS Code reload
            execSync(`touch "${htmlPath}"`);
            console.log('🔄 File timestamp updated - VS Code should reload automatically');
            console.log('💡 If you see an "overwrite/revert" dialog:');
            console.log('   → Choose "Overwrite" to keep the new content');
            console.log('   → The script has successfully added your section');
        } catch (error) {
            console.log('📝 Please reload the file in VS Code to see the changes.');
            console.log('💡 If you see an "overwrite/revert" dialog, choose "Overwrite"');
        }
    } else {
        console.log('📝 Please reload the file in VS Code to see the changes.');
    }
}

main().catch(console.error);
