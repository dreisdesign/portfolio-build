import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process'; // Make sure this is imported
import sharp from 'sharp';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the __dirname variable when resolving paths
function resolvePath(relativePath) {
    return path.resolve(__dirname, relativePath);
}

/**
 * Recursively find files with a specific extension in a directory
 * @param {string} dir - Directory to search in
 * @param {string} extension - File extension to look for (e.g., '.mp4')
 * @returns {Promise<string[]>} - Array of file paths
 */
async function findFiles(dir, extension) {
    let results = [];

    // Read directory contents
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            // If it's a directory, recursively search it
            const subResults = await findFiles(fullPath, extension);
            results = results.concat(subResults);
        } else if (item.isFile() && item.name.toLowerCase().endsWith(extension)) {
            // If it's a file with the target extension, add it to results
            results.push(fullPath);
        }
    }

    return results;
}

const VERBOSE = true; // Set to true to see detailed logs

// Main function to create static placeholders
async function createVideoPlaceholders(buildDir = 'build/temp') {
    console.log("Creating video placeholders...");

    // Fix: Use absolute path resolution that correctly includes {{DEPLOY_USER}} directory
    const videosDir = path.resolve(process.cwd(), buildDir, 'public_html/assets/videos');

    console.log(`Searching for videos in: ${videosDir}`);

    // Check if directory exists
    if (!fs.existsSync(videosDir)) {
        console.error(`⚠️ Videos directory not found: ${videosDir}`);
        return;
    }

    // Find all MP4 files recursively
    const videoFiles = await findFiles(videosDir, '.mp4');

    console.log(`Found ${videoFiles.length} MP4 video files`);

    if (videoFiles.length === 0) {
        console.warn("⚠️ No MP4 video files found. Check your directory structure.");
        return;
    }

    // Process each video file
    let successCount = 0;
    let errorCount = 0;

    for (const videoFile of videoFiles) {
        try {
            const webpPath = videoFile.replace('.mp4', '.webp');
            const tempJpgPath = videoFile.replace('.mp4', '_temp.jpg');
            const videoName = path.basename(videoFile, '.mp4');

            if (VERBOSE) {
                console.log(`Processing: ${path.basename(videoFile)}`);
                console.log(`  Creating WebP poster: ${path.basename(webpPath)}`);
            }

            // Check if the WebP already exists
            if (!fs.existsSync(webpPath) || fs.statSync(webpPath).size === 0) {
                try {
                    // Extract frame from video using ffmpeg
                    // Use 0.5 seconds to avoid black frames at the start
                    console.log(`  Extracting frame from video...`);
                    execSync(`ffmpeg -i "${videoFile}" -ss 00:00:00.5 -vframes 1 -q:v 2 "${tempJpgPath}" -y`,
                        { stdio: VERBOSE ? 'inherit' : 'ignore' });

                    if (!fs.existsSync(tempJpgPath)) {
                        throw new Error("Failed to extract frame with ffmpeg");
                    }

                    // Convert JPG to WebP using sharp for best quality
                    console.log(`  Converting to WebP format...`);
                    await sharp(tempJpgPath)
                        .webp({ quality: 90 })
                        .toFile(webpPath);

                    // Clean up temp file
                    if (fs.existsSync(tempJpgPath)) {
                        fs.unlinkSync(tempJpgPath);
                    }

                    console.log(`  ✅ Created real poster from video frame`);
                } catch (ffmpegError) {
                    console.log(`  ⚠️ Could not extract frame with ffmpeg: ${ffmpegError.message}`);
                    console.log(`  ℹ️ Creating a fallback poster instead`);

                    // Fallback to Sharp method if ffmpeg fails
                    try {
                        // Create a simple colored gradient with video name
                        const width = 640;
                        const height = 360;

                        const svgImage = Buffer.from(`
                        <svg width="${width}" height="${height}">
                            <defs>
                                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#1a237e;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#0288d1;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                            <rect width="${width}" height="${height}" fill="url(#grad)" />
                            <text x="50%" y="50%" font-family="sans-serif" font-size="24" 
                                fill="white" text-anchor="middle" dominant-baseline="middle">
                                ${videoName}
                            </text>
                            <text x="50%" y="${height - 20}" font-family="sans-serif" font-size="16" 
                                fill="white" text-anchor="middle" opacity="0.7">
                                Click to play video
                            </text>
                        </svg>`);

                        await sharp(svgImage)
                            .webp({ quality: 90 })
                            .toFile(webpPath);

                        console.log(`  ✅ Created fallback poster using Sharp`);
                    } catch (fallbackError) {
                        console.error(`  ❌ Failed to create any poster: ${fallbackError.message}`);
                        // Last resort: Create a non-empty file
                        fs.writeFileSync(webpPath, '0');
                    }
                }
            } else {
                console.log(`  ✓ Poster already exists`);
            }

            successCount++;
        } catch (error) {
            console.error(`❌ Error processing ${videoFile}: ${error.message}`);
            errorCount++;
        }
    }

    console.log("\nPlaceholder creation complete:");
    console.log(`✅ Successfully created ${successCount} video placeholders`);
    if (errorCount > 0) {
        console.log(`❌ Failed to create ${errorCount} video placeholders`);
    }
}

// Get the build directory from command line argument or use default
const buildDir = process.argv[2] || 'build/temp';

// Run the function
createVideoPlaceholders(buildDir).catch(console.error);
