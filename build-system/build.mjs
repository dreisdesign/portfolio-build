import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUILD_DIR = path.join(__dirname, '../../../build/temp');
const SCRIPTS_DIR = path.join(__dirname, 'deploy-support/scripts');
const LOGS_DIR = path.join(__dirname, '../../../dev/logs/build');
const SOURCE_DIR = path.join(__dirname, '../../../public_html');

// Create timestamp for log file
const timestamp = new Date().toISOString().replace(/[T:]/g, '-').slice(0, 19);
const logFileName = `build-${timestamp}.log`;
const logFilePath = path.join(LOGS_DIR, logFileName);

// Create formatted timestamps for various uses
const dateObj = new Date();
const machineTimestamp = dateObj.toISOString().slice(0, 10).replace(/-/g, '') + '-' +
    dateObj.toTimeString().slice(0, 5).replace(':', '');
const humanReadableDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
});
const humanReadableTime = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
});
const humanReadableTimestamp = `${humanReadableDate} at ${humanReadableTime}`;

// Export timestamps for other scripts to use
export const buildTimestamps = {
    machineTimestamp,  // Format: YYYYMMDD-HHMM (e.g., 20250413-1430)
    humanReadableTimestamp // Format: "Sunday, April 13, 2025 at 2:30 PM"
};

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Setup logging
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Archive old build logs, keeping only the 5 most recent
const archiveOldBuildLogs = () => {
    const archiveDir = path.join(LOGS_DIR, 'archive');
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }
    const logFiles = fs.readdirSync(LOGS_DIR)
        .filter(f => f.startsWith('build-') && f.endsWith('.log'))
        .map(f => ({
            name: f,
            time: fs.statSync(path.join(LOGS_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
    const keep = 5;
    const toArchive = logFiles.slice(keep);
    toArchive.forEach(file => {
        const src = path.join(LOGS_DIR, file.name);
        const dest = path.join(archiveDir, file.name);
        fs.renameSync(src, dest);
        console.log(`Archived old build log: ${file.name}`);
    });
};
archiveOldBuildLogs();

// Override console methods to write to log file
console.log = function (...args) {
    const message = args.join(' ');
    originalConsoleLog.apply(console, args);
    logStream.write(`${message}\n`);
};

console.error = function (...args) {
    const message = args.join(' ');
    originalConsoleError.apply(console, args);
    logStream.write(`[ERROR] ${message}\n`);
};

async function formatHtmlFiles() {
    const htmlDir = path.join(BUILD_DIR, 'public_html');
    try {
        // Use Prettier to format all HTML files
        // Add --html-whitespace-sensitivity=css flag to preserve blank lines around comments and doctype
        execSync(`npx prettier --write "${htmlDir}/**/*.html" --html-whitespace-sensitivity=css --print-width 100 --tab-width 2 --no-config`, { stdio: 'inherit' });

        // Post-process HTML files to ensure blank line between timestamp comment and DOCTYPE
        // and properly format DOCTYPE and html tag
        const htmlFiles = getAllFilesInDirectory(htmlDir, '.html');
        for (const filePath of htmlFiles) {
            let content = fs.readFileSync(filePath, 'utf8');

            // Find timestamp comment followed by possibly compressed DOCTYPE and html tag
            const timestampRegex = /(<!-- Last updated:.*? -->)(<!-- -->)?(\s*)(<!(DOCTYPE|doctype) html>)(<html lang="en">)(<head>)/i;

            if (timestampRegex.test(content)) {
                // Replace with properly formatted structure
                content = content.replace(timestampRegex, '$1\n$4\n<html lang="en">\n\n<head>');
                fs.writeFileSync(filePath, content, 'utf8');
            }
        }

        console.log('✓ Formatted all HTML files in build output');
    } catch (err) {
        console.error('Error formatting HTML files:', err.message);
    }
}

// Helper function to get all files with specific extension in a directory and its subdirectories
function getAllFilesInDirectory(dir, extension) {
    let results = [];
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Recurse into subdirectories
            results = results.concat(getAllFilesInDirectory(filePath, extension));
        } else if (path.extname(filePath) === extension) {
            results.push(filePath);
        }
    }

    return results;
}

async function build() {
    console.log(`=============================================`);
    console.log(`BUILD PROCESS STARTED: ${new Date().toLocaleString()}`);
    console.log(`=============================================`);
    console.log(`Log file: ${logFilePath}`);
    console.log(`Machine timestamp: ${machineTimestamp}`);
    console.log(`Human-readable timestamp: ${humanReadableTimestamp}`);

    try {
        // Check for static-only mode
        const isStaticOnly = process.argv.includes('--static-only');
        if (isStaticOnly) {
            console.log('\n🔄 Running in static-only mode - focusing on portfolio static generation');
        }

        // System check
        console.log('\n🔍 Checking Node.js version and environment');
        console.log(`Node version: ${process.version}`);
        console.log(`Working directory: ${process.cwd()}`);

        // Run pre-build validation on source HTML files
        if (!process.argv.includes('--skip-source-validation') && !isStaticOnly) {
            console.log('\n🔍 Pre-build validation of source HTML files');
            const result = await runBuildStep('validate:source', 'Validating source HTML files');
            if (!result) {
                throw new Error('Source HTML validation failed - build aborted');
            }
        }

        // Create build directory
        console.log('\n📁 Creating build directory');
        if (!fs.existsSync(BUILD_DIR)) {
            fs.mkdirSync(BUILD_DIR, { recursive: true });
        }

        // In static-only mode, check if build directory already exists and contains processed images
        if (isStaticOnly) {
            const publicHtmlDir = path.join(BUILD_DIR, 'public_html');
            const portfolioDir = path.join(publicHtmlDir, 'portfolio');

            if (!fs.existsSync(publicHtmlDir)) {
                console.log('\n📁 No build directory exists, copying source files first');
                await runBuildStep('deploy:copy', 'Copying source files to build directory');
            } else if (!fs.existsSync(portfolioDir)) {
                console.log('\n⚠️ Build directory exists but portfolio directory is missing');
                console.log('\n📁 Refreshing build directory with source files');
                await runBuildStep('deploy:copy', 'Copying source files to build directory');
            } else {
                console.log('\n✅ Using existing build directory with processed files');
            }

            // Skip to portfolio generation
            console.log('\n🔄 Skipping to portfolio static generation');
            await runBuildStep('build:portfolio', 'Building portfolio structure with static HTML generation');

            console.log(`\n✅ STATIC BUILD COMPLETED: ${new Date().toLocaleString()}`);
            console.log(`Build log saved to: ${logFilePath}`);
            console.log(`=============================================`);
            return;
        }

        // Regular build flow for non-static-only mode
        // Copy public_html directory first
        await runBuildStep('deploy:copy', 'Copying source files to build directory');

        // Process assets in correct order (steps 2-3)
        if (!process.argv.includes('--skip-images')) {
            await runBuildStep('process:images', 'Processing images for optimization');
            await runBuildStep('process:videos', 'Creating video placeholders');
            await runBuildStep('process:featured', 'Processing featured images');
            await runBuildStep('process:responsive', 'Transforming responsive images');
        } else {
            console.log('\n⏭️ Skipping image processing as requested with --skip-images flag');
        }

        // Format files and validate
        await runBuildStep('format:files', 'Formatting files and updating timestamps');

        if (!process.argv.includes('--skip-validation')) {
            await runBuildStep('validate:html', 'Validating HTML files');
        }

        // Build portfolio
        await runBuildStep('build:portfolio', 'Building portfolio structure');

        // Re-inject head content into newly generated tag pages
        console.log('\n🔄 Re-injecting head content into newly generated pages...');
        const headInjectPath = path.join(__dirname, 'deploy-support/head-templates/inject-head.mjs');
        const { spawn } = await import('child_process');

        await new Promise((resolve, reject) => {
            const process = spawn('node', [headInjectPath, BUILD_DIR], { stdio: 'inherit' });
            process.on('close', code => {
                if (code === 0) {
                    console.log('✅ Head content re-injection completed successfully');
                    resolve();
                } else {
                    console.warn('⚠️ Head content re-injection completed with warnings');
                    resolve(); // Continue build even if head injection has issues
                }
            });
            process.on('error', reject);
        });

        // Inject navigation into all HTML files
        await runBuildStep('inject:nav', 'Injecting navigation into all HTML files');

        // Inject footer after portfolio build, before formatting
        await runBuildStep('inject:footer', 'Injecting footer into all HTML files');

        // Run site audit
        await runBuildStep('audit:site', 'Running site audit to check images and videos');

        // NEW: Run site audit comparison after the audit is complete
        console.log('\n📊 Comparing with previous site audits...');
        try {
            // Import dynamically to avoid dependency issues
            const { spawn } = await import('child_process');
            const compareProcess = spawn('node', [
                path.join(__dirname, 'deploy-support/utils/compare-audits.mjs'),
                '--last=3'  // Compare with the last 3 audit reports
            ], { stdio: 'inherit' });

            await new Promise((resolve, reject) => {
                compareProcess.on('close', code => {
                    if (code === 0) {
                        console.log('✅ Site audit comparison completed successfully');
                        resolve();
                    } else {
                        console.warn('⚠️ Site audit comparison completed with warnings');
                        resolve(); // Continue build even if comparison has issues
                    }
                });

                compareProcess.on('error', err => {
                    console.warn('⚠️ Site audit comparison error:', err.message);
                    resolve(); // Continue build even if comparison fails
                });
            });
        } catch (error) {
            console.warn('⚠️ Failed to run site audit comparison:', error.message);
            // Continue build even if comparison fails
        }

        // Format HTML as the last step
        await formatHtmlFiles();

        console.log(`\n✅ BUILD COMPLETED SUCCESSFULLY: ${new Date().toLocaleString()}`);
        console.log(`Build log saved to: ${logFilePath}`);
        console.log(`=============================================`);
    } catch (error) {
        console.error(`\n❌ BUILD FAILED: ${error.message}`);
        console.error(`Build log saved to: ${logFilePath}`);
        console.log(`=============================================`);
        process.exit(1);
    } finally {
        // Restore original console methods and close log stream
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        logStream.end();
    }
}

async function runBuildStep(script, description, extraArg) {
    console.log(`\n🔄 ${description}...`);

    // Handle missing scripts gracefully
    const result = await new Promise((resolve, reject) => {
        const args = ['run', script];
        // Add extra argument (typically BUILD_DIR) to scripts that need it
        if (extraArg) {
            args.push('--');
            // Split the extra arguments in case there are multiple
            const extraArgParts = extraArg.split(' ');
            args.push(...extraArgParts);
        }

        // Run the script
        try {
            // Change stdio from 'inherit' to 'pipe' to capture output
            const proc = spawn('npm', args, {
                stdio: ['inherit', 'pipe', 'pipe'],
                shell: true
            });

            // Capture stdout and write to console and log file
            proc.stdout.on('data', (data) => {
                const output = data.toString();
                process.stdout.write(output);
                logStream.write(output);
            });

            // Capture stderr and write to console and log file
            proc.stderr.on('data', (data) => {
                const output = data.toString();
                process.stderr.write(output);
                logStream.write(`[WARN] ${output}`);
            });

            proc.on('close', code => {
                if (code === 0) {
                    resolve(true);
                } else {
                    console.warn(`⚠️ ${script} completed with code ${code}`);
                    // For source validation, abort the build
                    if (script === 'validate:source') {
                        reject(new Error(`HTML validation failed with exit code ${code} - build aborted`));
                    }
                    // For format steps, continue anyway
                    else if (script.startsWith('format:') || script.startsWith('update:')) {
                        console.log(`Continuing build despite non-zero exit code for ${script}`);
                        resolve(true);
                    } else {
                        reject(new Error(`${script} failed with exit code ${code}`));
                    }
                }
            });
        } catch (error) {
            console.warn(`⚠️ Error running ${script}: ${error.message}`);
            // For source validation, always abort the build
            if (script === 'validate:source') {
                reject(new Error(`HTML validation failed: ${error.message} - build aborted`));
            }
            // For format steps, continue anyway
            else if (script.startsWith('format:') || script.startsWith('update:')) {
                resolve(true);
            } else {
                reject(error);
            }
        }
    });

    return result;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    build().catch(console.error);
}

export default build;