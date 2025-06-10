#!/usr/bin/env node

/**
 * menu.mjs
 * An interactive menu for running common npm commands.
 * 
 * Usage: node menu.mjs
 * 
 * This script will:
 * 1. Show a menu of common commands
 * 2. Let user select command by number
 * 3. Confirm before running
 * 4. Execute the selected command
 */

import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';

// Define the project root directory (works from any location)
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ANSI color codes for terminal styling
const styles = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    brightBlue: '\x1b[94m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Configuration for menu items
const menuItems = [
    {
        name: 'Utilities',
        command: 'utilities',
        subtext: 'Run utility scripts (insert section, scrape site, etc.)',
        description: 'Open the utilities submenu',
        isUtilities: true
    },
    {
        name: 'New Piece',
        command: 'npm run create-new',
        subtext: 'Create a new portfolio project with templates',
        description: 'Create a new portfolio project with automated setup'
    },
    {
        name: 'Build',
        command: 'npm run build:full',
        subtext: 'Complete build with validation & images',
        description: 'Full build with validation, image processing, and preview server'
    },
    {
        name: 'Swift Build',
        command: 'npm run build:swift',
        subtext: 'Full build pipeline, preserving processed assets',
        description: 'Fast build that reuses existing processed assets from previous complete build'
    },
    {
        name: 'Quick Preview',
        command: 'npm run preview:quick',
        subtext: 'Fast preview without image processing',
        description: 'Quick preview without full image processing'
    },
    {
        name: 'Deploy',
        command: 'npm run deploy',
        subtext: 'Deploy site to production server',
        description: 'Deploy the project to production'
    },
    {
        name: 'Exit',
        command: null,
        description: 'Exit the menu',
        isExit: true
    }
];

// Utility submenu items
const utilityItems = [
    {
        name: 'Insert Section (HTML)',
        command: 'bash bin/insert-section.sh',
        description: 'Insert a new section into an HTML file'
    },
    {
        name: 'Scrape Site Content',
        command: 'node dev/scripts/deploy/deploy-support/utils/scrape-site-content.mjs',
        description: 'Crawl and extract all text content from the live site'
    },
    {
        name: 'Back to Main Menu',
        command: null,
        isBack: true
    }
];

async function utilitiesMenu() {
    console.clear();
    console.log(`\n${styles.bold}UTILITIES MENU${styles.reset}`);
    console.log(`${styles.dim}${'─'.repeat(40)}${styles.reset}\n`);
    const choices = utilityItems.map((item, idx) => ({
        name: `${item.name}${item.description ? ' — ' + item.description : ''}`,
        value: idx
    }));
    const { selection } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selection',
            message: 'Select a utility:',
            choices
        }
    ]);
    const selected = utilityItems[selection];
    if (selected.isBack) return main();
    try {
        process.chdir(projectRoot);
        const { spawnSync } = await import('child_process');
        const [cmd, ...args] = selected.command.split(' ');
        const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`Process exited with code ${result.status}`);
        console.log(`\n${styles.green}Command completed successfully!${styles.reset}\n`);
    } catch (error) {
        console.error(`\n${styles.red}Command failed with error:${styles.reset}`, error.message);
    }
    return utilitiesMenu();
}

/**
 * Main function
 */
async function main() {
    console.clear();
    console.log(`\n${styles.bold}DANRTZAQ MENU${styles.reset}`);
    console.log(`${styles.dim}${'─'.repeat(40)}${styles.reset}\n`);
    const choices = menuItems.map((item, idx) => ({
        name: `${item.name}${item.subtext ? ' — ' + item.subtext : ''}`,
        value: idx
    }));
    const { selection } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selection',
            message: 'Select a command:',
            choices
        }
    ]);
    const selectedItem = menuItems[selection];
    if (selectedItem.isExit || !selectedItem.command) {
        console.log(`\n${styles.green}Exiting menu. Goodbye!${styles.reset}\n`);
        return;
    }
    if (selectedItem.isUtilities) {
        return utilitiesMenu();
    }
    try {
        process.chdir(projectRoot);
        execSync(selectedItem.command, { stdio: 'inherit' });
        console.log(`\n${styles.green}Command completed successfully!${styles.reset}\n`);
    } catch (error) {
        console.error(`\n${styles.red}Command failed with error:${styles.reset}`, error.message);
    }
    return main();
}

// Run the main function
main().catch(console.error);