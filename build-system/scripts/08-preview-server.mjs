/**
 * Preview Server
 *
 * Created: 2025-03-29
 * Last Modified: 2025-04-25
 * Version: 1.0.2
 *
 * Local development server for previewing changes:
 * - Serves processed images
 * - Provides interactive deployment controls
 * - Supports hot reloading
 */

import express from 'express';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default and alternate ports
const DEFAULT_PORT = parseInt(process.env.PORT || 3001);
const ALTERNATE_PORTS = [3002, 3003, 3004, 3005, 3006]; // Try these ports if default is in use
const BUILD_DIR = process.argv[2] || '.';

// Add logger
const logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`)
};

// Function to check if a port is in use
async function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true); // Port is in use
            } else {
                resolve(false);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(false); // Port is free
        });
        server.listen(port);
    });
}

// Function to find an available port
async function findAvailablePort() {
    // First try the default port
    if (!await isPortInUse(DEFAULT_PORT)) {
        return DEFAULT_PORT;
    }

    // If default port is in use, try alternate ports
    logger.warn(`Default port ${DEFAULT_PORT} is in use, trying alternate ports...`);

    for (const port of ALTERNATE_PORTS) {
        if (!await isPortInUse(port)) {
            logger.info(`Using alternate port ${port}`);
            return port;
        }
    }

    // If all defined ports are in use, pick a random high port (8000-9000)
    const randomPort = Math.floor(Math.random() * 1000) + 8000;
    logger.warn(`All alternate ports are in use, using random port ${randomPort}`);
    return randomPort;
}

// Check Express version
async function checkDependencies() {
    try {
        // Check for express using dynamic import
        try {
            const expressModule = await import('express');
            logger.info(`Express module loaded successfully`);
        } catch (err) {
            logger.error(`Failed to load Express: ${err.message}`);
            logger.info('Make sure Express is installed correctly: npm install express');
            return false;
        }

        // Check if the build directory exists and has content
        const buildDir = path.resolve(process.cwd(), BUILD_DIR);
        if (!fs.existsSync(buildDir)) {
            logger.error(`Build directory not found: ${buildDir}`);
            logger.info('Run "npm run deploy:copy" first to create the build directory');
            return false;
        }

        const publicDir = path.join(buildDir, 'public_html');
        if (!fs.existsSync(publicDir)) {
            logger.error(`Public HTML directory not found: ${publicDir}`);
            logger.info('Run "npm run deploy:copy" first to copy the public_html files');
            return false;
        }

        const indexPath = path.join(publicDir, 'index.html');
        if (!fs.existsSync(indexPath)) {
            logger.error(`Index file not found: ${indexPath}`);
            logger.info('Public directory exists but does not contain index.html');
            return false;
        }

        return true;
    } catch (error) {
        logger.error(`Dependency check failed: ${error.message}`);
        logger.info('Make sure Express is installed correctly: npm install express');
        return false;
    }
}

function startServer(buildDir) {
    return new Promise(async (resolve, reject) => {
        // Validate dependencies and build directory
        const dependenciesOk = await checkDependencies();
        if (!dependenciesOk) {
            logger.error('Preview server cannot start due to missing dependencies or files');
            return resolve(false);
        }

        const app = express();

        // Find an available port
        const port = await findAvailablePort();

        // Set proper MIME types first
        express.static.mime.define({
            'font/woff2': ['woff2'],
            'image/svg+xml': ['svg'],
            'text/css': ['css'],
            'application/javascript': ['js'],
            'video/mp4': ['mp4'],
            'image/webp': ['webp'],
            'image/x-icon': ['ico']
        });

        // Add logging middleware
        app.use((req, res, next) => {
            logger.info(`[REQUEST] ${req.path}`);
            next();
        });

        // Fix paths for static file serving
        const publicDir = path.join(buildDir, 'public_html');

        console.log(`[INFO] Serving assets from: ${publicDir}/assets`);
        console.log(`[INFO] Serving video assets from: ${publicDir}/assets/videos`);

        // Serve static files with proper MIME types
        app.use(express.static(publicDir, {
            extensions: ['html'],
            index: ['index.html']
        }));

        // Special handler for favicon
        app.get('/favicon.ico', (req, res) => {
            const faviconPath = path.join(publicDir, 'favicon.ico');

            if (fs.existsSync(faviconPath)) {
                return res.sendFile(faviconPath);
            } else {
                return res.status(404).end();
            }
        });

        // Handle all other requests
        app.get('*', (req, res) => {
            const filePath = path.join(publicDir, req.path);

            // Check if the path exists as a file
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                return res.sendFile(filePath);
            }

            // Check for index.html in the requested path
            const indexPath = path.join(publicDir, req.path, 'index.html');
            if (fs.existsSync(indexPath)) {
                return res.sendFile(indexPath);
            }

            // If we get here, file wasn't found
            console.warn(`[WARN] 404: ${req.path}`);
            res.status(404).send(`File not found: ${req.path}`);
        });

        const server = app.listen(port, async () => {
            console.log(`\n\x1b[1;36mStarting preview server on port ${port}...\x1b[0m`);
            console.log('\x1b[1mControls:\x1b[0m');
            console.log('\x1b[0;32m[Y]\x1b[0m Proceed with deployment');
            console.log('\x1b[0;31m[Q]\x1b[0m or \x1b[0;31m[N]\x1b[0m Cancel deployment\n');

            try {
                await open(`http://localhost:${port}`);
                console.log(`Browser opened to http://localhost:${port}`);
            } catch (err) {
                console.warn(`Could not open browser automatically: ${err.message}`);
                console.log(`Visit http://localhost:${port} manually in your browser`);
            }
        });

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', (key) => {
            if (key === 'y' || key === 'Y') {
                console.log('\n\x1b[0;32m✓ Proceeding with deployment\x1b[0m');
                server.close();
                process.stdin.setRawMode(false);
                resolve(true);
            } else if (key === 'q' || key === 'Q' || key === 'n' || key === 'N') {
                console.log('\n\x1b[0;31m✗ Deployment cancelled\x1b[0m');
                server.close();
                process.stdin.setRawMode(false);
                resolve(false);
            }
        });
    });
}

// Update the main execution
if (import.meta.url.endsWith(process.argv[1])) {
    startServer(BUILD_DIR).then((proceed) => {
        if (proceed) {
            logger.info('Deployment started...');
            process.exit(0);
        } else {
            logger.info('Deployment aborted.');
            process.exit(1);
        }
    });
}

// Update module exports to return the startServer function
export { startServer as default };
