import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BuildManager {
    constructor(buildDir) {
        this.buildDir = buildDir;
        this.scriptsDir = path.join(__dirname, 'scripts');
    }

    async build() {
        console.log('\nStarting build process...');

        const steps = [
            { name: 'Process Images', script: '01-process-images.mjs' },
            { name: 'Create Placeholders', script: '02-create-static-placeholder.mjs' },
            { name: 'Process Featured Images', script: '03-preprocess-featured-images.mjs' },
            { name: 'Format Files', script: '04-format-files.sh' },
            { name: 'Transform Responsive Images', script: '05-transform-responsive-images.mjs' },
            { name: 'Build Portfolio', script: '06-build-portfolio.mjs' },
            { name: 'Pre-deploy Check', script: '07-pre-deploy-check.sh' }
        ];

        for (const step of steps) {
            console.log(`\nRunning: ${step.name}`);
            const success = await this.runBuildStep(step.script);
            if (!success) {
                console.error(`Failed at step: ${step.name}`);
                return false;
            }
        }

        return true;
    }

    async runBuildStep(script) {
        const scriptPath = path.join(this.scriptsDir, script);
        const isJs = script.endsWith('.mjs');

        return new Promise((resolve) => {
            const proc = spawn(
                isJs ? 'node' : 'bash',
                [scriptPath, this.buildDir],
                { stdio: 'inherit' }
            );

            proc.on('close', code => resolve(code === 0));
        });
    }

    async preview() {
        const previewScript = path.join(this.scriptsDir, '08-preview-server.mjs');
        return this.runBuildStep(previewScript);
    }
}
