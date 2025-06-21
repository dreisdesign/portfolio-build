#!/usr/bin/env node

/**
 * Unified Site Audit Tool
 *
 * A single script that handles all audit functionality:
 * - Generate site audits
 * - Compare audit reports
 * - Update audit baselines
 * - Provide intelligent recommendations
 * - Auto-detect what you probably want to do
 *
 * Usage: node audit.mjs [options] [directory]
 *
 * Options:
 *   --build              Run build before audit (swift build)
 *   --build-full         Run full build before audit
 *   --compare [N]        Compare last N audits (default: 3 for baseline/previous/current)
 *   --update-baseline    Update the audit baseline after confirmation
 *   --auto-baseline      Automatically update baseline if significant changes
 *   --quiet             Minimal output mode
 *   --help              Show this help message
 *
 * Examples:
 *   node audit.mjs                           # Smart audit with recommendations
 *   node audit.mjs --build                   # Build + smart audit (most common)
 *   node audit.mjs --build-full              # Full build + smart audit
 *   node audit.mjs --compare                 # Compare last 3 audits
 *   node audit.mjs --compare 5               # Compare last 5 audits
 *   node audit.mjs --update-baseline         # Update baseline with confirmation
 *   node audit.mjs --auto-baseline           # Auto-update baseline if needed
 *   node audit.mjs build/temp/public_html    # Audit specific directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color constants for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  white: '\x1b[37m'
};

// Configuration paths
const AUDIT_DIR = path.join(__dirname, '../../../../../logs/audit');
const BASELINE_CONFIG_PATH = path.join(AUDIT_DIR, 'baseline-audits.json');

// Default configuration
const config = {
  imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'],
  videoExtensions: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'],
  ignoreFiles: ['.DS_Store', 'Thumbs.db', '.gitkeep'],
  ignoreDirs: ['node_modules', '.git'],
  textContentTypes: ['.html']
};

class UnifiedAudit {
  constructor(options = {}) {
    this.options = {
      build: options.build || false,
      buildFull: options.buildFull || false,
      compare: options.compare || false,
      updateBaseline: options.updateBaseline || false,
      autoBaseline: options.autoBaseline || false,
      quiet: options.quiet || false,
      directory: options.directory || null,
      ...options
    };

    this.siteStats = {
      images: { total: 0, byType: {}, source: 0, publicHtml: 0 },
      videos: { total: 0, byType: {}, totalSize: 0 },
      text: { totalWords: 0, totalCharacters: 0 },
      pages: [],
      pageCategories: {}
    };

    this.auditFiles = [];
    this.baselineData = null;
  }

  log(message, color = 'reset') {
    if (!this.options.quiet) {
      console.log(`${colors[color]}${message}${colors.reset}`);
    }
  }

  async run() {
    try {
      // Step 1: Build if requested
      if (this.options.build || this.options.buildFull) {
        await this.runBuild();
      }

      // Step 2: Determine what to do based on options
      if (this.options.compare) {
        await this.compareAudits();
      } else if (this.options.updateBaseline) {
        await this.updateBaseline();
      } else {
        // Default: Smart audit workflow
        await this.smartAudit();
      }

      // Step 3: Show simple completion message if this was a build + audit workflow
      if ((this.options.build || this.options.buildFull) && !this.options.quiet) {
        this.log('\n✓ Build & Audit Complete!', 'green');
      }

    } catch (error) {
      this.log(`\n❌ ${this.options.build || this.options.buildFull ? 'Build & Audit' : 'Audit'} Failed: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  async smartAudit() {
    this.log('🔍 Smart Audit Starting...', 'bright');

    // Step 1: Generate new audit
    await this.generateAudit();

    // Step 2: Auto-compare with recent audits
    await this.compareAudits(3);

    // Step 3: Provide recommendations
    await this.provideRecommendations();

    this.log('\n✅ Smart Audit Complete!', 'green');
  }

  async generateAudit() {
    this.log('📊 Running site audit...', 'blue');

    // Determine target directory
    let targetDir = this.options.directory;
    if (!targetDir) {
      const projectRoot = path.resolve(__dirname, '../../../../..');
      targetDir = path.join(projectRoot, 'build/temp/public_html');

      if (!fs.existsSync(targetDir)) {
        this.log('⚠️  No build directory found. Please run a build first.', 'yellow');
        this.log('   Try: npm run build:swift:fast', 'dim');
        return;
      }
    }

    // Reset stats
    this.siteStats = {
      images: { total: 0, byType: {}, source: 0, publicHtml: 0 },
      videos: { total: 0, byType: {}, totalSize: 0 },
      text: { totalWords: 0, totalCharacters: 0 },
      pages: [],
      pageCategories: {}
    };

    // Scan directory
    this.scanDirectory(targetDir);

    // Count source images (use public_html/assets as "source" since it's more meaningful)
    const publicHtmlAssetsPath = path.resolve(__dirname, '../../../../../public_html/assets');
    this.siteStats.images.source = this.countImagesInDir(publicHtmlAssetsPath);

    // Count public_html images (keep for backwards compatibility in reports)
    this.siteStats.images.publicHtml = this.siteStats.images.source;

    // Generate and save report
    const report = this.generateReport();
    this.saveReport(report);

    // Only show full report in verbose mode
    if (this.options.verbose && !this.options.quiet) {
      console.log(report);
    }

    this.log('✓ Site audit completed', 'green');
  }

  scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        if (config.ignoreFiles.includes(item)) continue;

        const itemPath = path.join(dir, item);
        const itemStats = fs.statSync(itemPath);

        if (itemStats.isDirectory()) {
          if (config.ignoreDirs.includes(item)) continue;
          this.scanDirectory(itemPath);
        } else {
          const extension = path.extname(itemPath).toLowerCase();

          // Count images
          if (config.imageExtensions.includes(extension)) {
            this.siteStats.images.total++;
            const type = extension.slice(1); // Remove the dot
            this.siteStats.images.byType[type] = (this.siteStats.images.byType[type] || 0) + 1;
          }

          // Count videos
          if (config.videoExtensions.includes(extension)) {
            this.siteStats.videos.total++;
            const type = extension.slice(1);
            this.siteStats.videos.byType[type] = (this.siteStats.videos.byType[type] || 0) + 1;
            this.siteStats.videos.totalSize += itemStats.size;
          }

          // Analyze HTML files
          if (config.textContentTypes.includes(extension)) {
            const pageData = this.analyzeHtmlFile(itemPath);
            this.siteStats.pages.push(pageData);
          }
        }
      }
    } catch (error) {
      this.log(`Warning: Could not scan ${dir}: ${error.message}`, 'yellow');
    }
  }

  analyzeHtmlFile(filePath) {
    try {
      const html = fs.readFileSync(filePath, 'utf8');

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath);

      // Extract body content for word counting
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : html;

      // Clean content for counting
      const textContent = bodyContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const wordCount = textContent ? textContent.split(' ').length : 0;
      const charCount = textContent.length;

      // Update global totals
      this.siteStats.text.totalWords += wordCount;
      this.siteStats.text.totalCharacters += charCount;

      // Categorize page
      const relativePath = filePath.split('public_html/').pop() || filePath;
      let category = 'Other';

      if (relativePath === 'index.html') category = 'Homepage';
      else if (relativePath === '404.html') category = 'Error';
      else if (relativePath.startsWith('about/')) category = 'About';
      else if (relativePath.startsWith('portfolio/')) category = 'Portfolio';
      else if (relativePath.startsWith('legal/')) category = 'Legal';
      else if (relativePath.startsWith('blog/')) category = 'Blog';

      this.siteStats.pageCategories[category] = (this.siteStats.pageCategories[category] || 0) + 1;

      return {
        path: filePath,
        title: title,
        wordCount: wordCount,
        charCount: charCount,
        category: category
      };

    } catch (error) {
      this.log(`Warning: Could not analyze ${filePath}: ${error.message}`, 'yellow');
      return {
        path: filePath,
        error: error.message,
        wordCount: 0,
        charCount: 0,
        category: 'Error'
      };
    }
  }

  countImagesInDir(targetDir) {
    let count = 0;

    const walk = (dir) => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              walk(filePath);
            } else if (config.imageExtensions.includes(path.extname(file).toLowerCase())) {
              count++;
            }
          } catch (error) {
            // Skip files that can't be accessed
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    if (fs.existsSync(targetDir)) {
      walk(targetDir);
    }

    return count;
  }

  generateReport() {
    let report = `${colors.bright}Site Audit Tool${colors.reset}\n`;
    report += `Scanning directory: ${this.options.directory || 'build/temp/public_html'}\n`;
    report += `${colors.bright} SITE AUDIT REPORT ${colors.reset}\n\n`;

    // Images summary
    report += `${colors.bright}IMAGES SUMMARY${colors.reset}\n`;
    report += `Total Images: ${this.siteStats.images.total}\n`;
    report += `Source Images: ${this.siteStats.images.source}\n`;
    report += `Public HTML Images: ${this.siteStats.images.publicHtml}\n`;

    const sortedImageTypes = Object.entries(this.siteStats.images.byType).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedImageTypes) {
      report += `${count} ${type.toUpperCase()}\n`;
    }

    // Videos summary
    report += `\n${colors.bright}VIDEOS SUMMARY${colors.reset}\n`;
    report += `Total Videos: ${this.siteStats.videos.total}\n`;
    report += `Total Video Size: ${this.formatBytes(this.siteStats.videos.totalSize)}\n`;

    const sortedVideoTypes = Object.entries(this.siteStats.videos.byType).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedVideoTypes) {
      report += `${count} ${type.toUpperCase()}\n`;
    }

    // Text summary
    report += `\n${colors.bright}TEXT CONTENT SUMMARY${colors.reset}\n`;
    report += `Total Words: ${this.siteStats.text.totalWords}\n`;
    report += `Total Characters: ${this.siteStats.text.totalCharacters}\n`;

    // Pages summary
    const totalPages = this.siteStats.pages.length;
    report += `\n${colors.bright}${totalPages} PAGES${colors.reset}\n`;

    const sortedCategories = Object.entries(this.siteStats.pageCategories).sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sortedCategories) {
      report += `${count} ${category.toLowerCase()}\n`;
    }

    return report;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  saveReport(report) {
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }

    // Format date for filename
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const reportFilename = `site-audit-${dateStr}-${timeStr}.txt`;
    const reportPath = path.join(AUDIT_DIR, reportFilename);

    // Write report with ANSI color codes stripped
    const plainReport = report.replace(/\x1b\[\d+m/g, '');
    fs.writeFileSync(reportPath, plainReport);

    this.log(`Report saved to: ${reportPath}`, 'dim');
  }

  async compareAudits(numAudits = null) {
    // Use the provided number or the compare option value
    const compareCount = numAudits || this.options.compare || 3;

    if (!this.options.quiet) {
      this.log(`\n📈 Analyzing audit history...`, 'blue');
    }

    if (!fs.existsSync(AUDIT_DIR)) {
      this.log('⚠️  No audit history found', 'yellow');
      return;
    }

    // Get audit files
    this.auditFiles = fs.readdirSync(AUDIT_DIR)
      .filter(file => file.startsWith('site-audit-') && file.endsWith('.txt'))
      .sort()
      .reverse(); // Most recent first

    if (this.auditFiles.length === 0) {
      this.log('⚠️  No audit reports found', 'yellow');
      return;
    }

    if (!this.options.quiet) {
      this.log(`📁 Found ${this.auditFiles.length} audit reports`, 'dim');
    }

    // Load baseline configuration
    this.loadBaselineConfig();

    // Select audits to compare - ensure baseline is always included if it exists
    let auditsToCompare = this.auditFiles.slice(0, compareCount);

    // If we have a baseline configured, make sure it's included
    if (this.baselineData && this.baselineData.baselines && this.baselineData.baselines.length > 0) {
      const baselineFilename = path.basename(this.baselineData.baselines[0].path);

      // If baseline is not in the recent audits, add it and adjust the count
      if (!auditsToCompare.includes(baselineFilename)) {
        // Add baseline and keep only the most recent (compareCount - 1) others
        auditsToCompare = [baselineFilename, ...auditsToCompare.slice(0, compareCount - 1)];
      }
    }

    const auditData = [];

    // Load audit data
    for (const filename of auditsToCompare) {
      const filePath = path.join(AUDIT_DIR, filename);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = this.parseAuditReport(content, filename);
        auditData.push(data);
      }
    }

    if (!this.options.quiet) {
      this.log(`\n🔄 Comparing with baseline and recent audits...`, 'blue');
    }

    // Display comparison table
    this.displayComparisonTable(auditData);

    // Only show completion in verbose mode
    if (this.options.verbose && !this.options.quiet) {
      this.log('✓ Comparison completed', 'green');
    }
  }

  loadBaselineConfig() {
    try {
      if (fs.existsSync(BASELINE_CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(BASELINE_CONFIG_PATH, 'utf8'));
        this.baselineData = config;
      }
    } catch (error) {
      this.log(`⚠️  Could not load baseline config: ${error.message}`, 'yellow');
    }
  }

  parseAuditReport(content, filename) {
    const data = {
      filename: filename,
      date: this.extractDateFromFilename(filename),
      pages: 0,
      images: 0,
      sourceImages: 0,
      videos: 0,
      words: 0,
      chars: 0,
      isBaseline: false
    };

    // Check if this is a baseline
    if (this.baselineData && this.baselineData.baselines) {
      data.isBaseline = this.baselineData.baselines.some(baseline =>
        baseline.path.includes(filename) || filename.includes(path.basename(baseline.path, '.txt'))
      );
    }

    // Parse content
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('Total Images:')) {
        data.images = parseInt(line.split(':')[1].trim()) || 0;
      } else if (line.includes('Source Images:')) {
        data.sourceImages = parseInt(line.split(':')[1].trim()) || 0;
      } else if (line.includes('Total Videos:')) {
        data.videos = parseInt(line.split(':')[1].trim()) || 0;
      } else if (line.includes('Total Words:')) {
        data.words = parseInt(line.split(':')[1].trim()) || 0;
      } else if (line.includes('Total Characters:')) {
        data.chars = parseInt(line.split(':')[1].trim()) || 0;
      } else if (line.match(/^\d+ PAGES$/)) {
        data.pages = parseInt(line.split(' ')[0]) || 0;
      }
    }

    return data;
  }

  displayComparisonTable(auditData) {
    if (auditData.length === 0) return;

    console.log(`\n${colors.bright}📊 AUDIT COMPARISON${colors.reset}\n`);

    // Sort audits properly: Baseline first, then chronological order (oldest to newest)
    const sortedAudits = [...auditData];
    sortedAudits.sort((a, b) => {
      // Baseline always comes first
      if (a.isBaseline && !b.isBaseline) return -1;
      if (!a.isBaseline && b.isBaseline) return 1;
      // For non-baseline audits, sort by date (oldest first)
      return a.date.getTime() - b.date.getTime();
    });

    // Generate headers: Baseline, Previous, Current (in that order)
    const headers = [];
    let baselineIndex = -1;
    let nonBaselineAudits = [];

    sortedAudits.forEach((audit, index) => {
      if (audit.isBaseline) {
        baselineIndex = index;
      } else {
        nonBaselineAudits.push({ audit, originalIndex: index });
      }
    });

    sortedAudits.forEach((data, index) => {
      if (data.isBaseline) {
        headers.push('Baseline');
      } else {
        // For non-baseline audits, determine if Previous or Current
        const nonBaselinePosition = nonBaselineAudits.findIndex(item => item.originalIndex === index);
        if (nonBaselineAudits.length === 1) {
          headers.push('Current');
        } else if (nonBaselinePosition === nonBaselineAudits.length - 1) {
          headers.push('Current');
        } else if (nonBaselinePosition === nonBaselineAudits.length - 2) {
          headers.push('Previous');
        } else {
          headers.push(`Audit ${nonBaselinePosition + 1}`);
        }
      }
    });

    const colWidth = 19;

    // Header row
    let headerRow = 'Metric'.padEnd(12);
    headers.forEach((header, index) => {
      if (header === 'Current') {
        headerRow += `${colors.blue}${header}${colors.reset}`.padEnd(colWidth + 9); // +9 for color codes
      } else {
        headerRow += header.padEnd(colWidth);
      }
    });
    console.log(headerRow);
    console.log('-'.repeat(12 + (headers.length * colWidth)));

    // Date row
    let dateRow = 'Date'.padEnd(12);
    sortedAudits.forEach((data, index) => {
      const dateStr = data.date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      if (headers[index] === 'Current') {
        dateRow += `${colors.blue}${dateStr}${colors.reset}`.padEnd(colWidth + 9); // +9 for color codes
      } else {
        dateRow += dateStr.padEnd(colWidth);
      }
    });
    console.log(dateRow);

    // Metrics rows
    const metrics = [
      { label: 'Pages', getValue: (data) => String(data.pages) },
      {
        label: 'Images',
        getValue: (data) => data.sourceImages > 0 ? `${data.images} (${data.sourceImages})` : String(data.images)
      },
      { label: 'Videos', getValue: (data) => String(data.videos) },
      { label: 'Words', getValue: (data) => String(data.words).replace(/\B(?=(\d{3})+(?!\d))/g, ',') },
      { label: 'Chars', getValue: (data) => String(data.chars).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
    ];

    metrics.forEach(metric => {
      let row = metric.label.padEnd(12);
      sortedAudits.forEach((data, index) => {
        const value = metric.getValue(data);
        if (headers[index] === 'Current') {
          row += `${colors.blue}${value}${colors.reset}`.padEnd(colWidth + 9); // +9 for color codes
        } else {
          row += value.padEnd(colWidth);
        }
      });
      console.log(row);
    });

    console.log(`\n${colors.dim}Compared ${auditData.length} reports${colors.reset}`);
  }

  extractDateFromFilename(filename) {
    const match = filename.match(/site-audit-(\d{4}-\d{2}-\d{2})-(\d{2}-\d{2}-\d{2})\.txt/);
    if (match) {
      const dateStr = match[1];
      const timeStr = match[2].replace(/-/g, ':');
      return new Date(`${dateStr}T${timeStr}`);
    }
    return new Date(0);
  }

  async provideRecommendations() {
    const recommendations = [];

    // Check if baseline exists
    if (!this.baselineData || !this.baselineData.baselines || this.baselineData.baselines.length === 0) {
      recommendations.push({
        type: 'warning',
        message: 'No baseline audit found',
        action: 'Consider setting a baseline for meaningful comparisons',
        command: 'node audit.mjs --update-baseline'
      });
    } else {
      // Check baseline age
      const baselineDate = new Date(this.baselineData.baselines[0].timestamp);
      const daysSinceBaseline = Math.floor((Date.now() - baselineDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceBaseline > 30) {
        recommendations.push({
          type: 'suggestion',
          message: `Baseline is ${daysSinceBaseline} days old`,
          action: 'Consider updating if significant changes have been made',
          command: 'node audit.mjs --update-baseline'
        });
      }
    }

    // Display recommendations only if there are any
    if (recommendations.length === 0) {
      // No recommendations - just continue silently
    } else {
      this.log('\n💡 Recommendations:', 'cyan');

      for (const rec of recommendations) {
        const icon = rec.type === 'warning' ? '⚠️' : '💡';
        const color = rec.type === 'warning' ? 'yellow' : 'cyan';

        this.log(`\n${icon} ${rec.message}`, color);
        this.log(`   ${rec.action}`, 'dim');
        if (rec.command) {
          this.log(`   Command: ${rec.command}`, 'dim');
        }
      }

      // Interactive baseline update if needed
      if (recommendations.some(r => r.command && r.command.includes('--update-baseline')) && !this.options.quiet) {
        await this.promptBaselineUpdate();
      }
    }
  }

  async promptBaselineUpdate() {
    const { shouldUpdate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldUpdate',
        message: 'Would you like to update the audit baseline now?',
        default: false
      }
    ]);

    if (shouldUpdate) {
      await this.updateBaseline();
    }
  }

  async updateBaseline() {
    this.log('\n🔄 Updating audit baseline...', 'blue');

    // Get the most recent audit
    if (!fs.existsSync(AUDIT_DIR)) {
      this.log('❌ No audit directory found. Run an audit first.', 'red');
      return;
    }

    const auditFiles = fs.readdirSync(AUDIT_DIR)
      .filter(file => file.startsWith('site-audit-') && file.endsWith('.txt'))
      .sort()
      .reverse();

    if (auditFiles.length === 0) {
      this.log('❌ No audit reports found. Run an audit first.', 'red');
      return;
    }

    const latestAudit = auditFiles[0];
    const latestAuditPath = path.join(AUDIT_DIR, latestAudit);

    // Show what will become the new baseline
    this.log(`\nCandidate baseline: ${latestAudit}`, 'dim');

    // Load current baseline for comparison
    let hasBaseline = false;
    if (this.baselineData && this.baselineData.baselines && this.baselineData.baselines.length > 0) {
      hasBaseline = true;
      this.log(`Current baseline: ${path.basename(this.baselineData.baselines[0].path)}`, 'dim');
    }

    // Confirm update
    if (!this.options.autoBaseline) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: hasBaseline ? 'Replace current baseline with latest audit?' : 'Set latest audit as baseline?',
          default: false
        }
      ]);

      if (!confirmed) {
        this.log('Baseline update cancelled.', 'yellow');
        return;
      }
    }

    // Backup old baseline
    if (hasBaseline) {
      const oldBaseline = this.baselineData.baselines[0];
      const backupFilename = `baseline-backup-${Date.now()}.txt`;
      const backupPath = path.join(AUDIT_DIR, backupFilename);

      try {
        fs.copyFileSync(oldBaseline.path, backupPath);
        this.log(`✓ Old baseline backed up to: ${backupFilename}`, 'green');
      } catch (error) {
        this.log(`⚠️  Could not backup old baseline: ${error.message}`, 'yellow');
      }
    }

    // Update baseline configuration
    const newBaselineConfig = {
      baselines: [
        {
          path: latestAuditPath,
          timestamp: new Date().toISOString(),
          description: `Updated via audit.mjs on ${new Date().toLocaleDateString()}`
        }
      ]
    };

    try {
      fs.writeFileSync(BASELINE_CONFIG_PATH, JSON.stringify(newBaselineConfig, null, 2));
      this.log('✅ Baseline updated successfully!', 'green');
    } catch (error) {
      this.log(`❌ Failed to update baseline: ${error.message}`, 'red');
    }
  }

  async runBuild() {
    this.log('🔨 Building site...', 'bright');

    // Determine build command
    const buildCommand = this.options.buildFull ? 'npm run build:full' : 'npm run build:swift:fast';

    if (!this.options.quiet) {
      this.log(`Running: ${buildCommand}`, 'dim');
    }

    // Change to project root for build
    const originalDir = process.cwd();
    const projectRoot = path.resolve(__dirname, '../../../../..');

    try {
      process.chdir(projectRoot);

      const startTime = Date.now();
      execSync(buildCommand, { stdio: this.options.quiet ? 'pipe' : 'inherit' });
      const buildTime = Math.round((Date.now() - startTime) / 1000);

      this.log(`✅ Build completed in ${buildTime}s`, 'green');
    } finally {
      // Always restore original directory
      process.chdir(originalDir);
    }
  }

}

// Command line interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bright}Unified Site Audit Tool${colors.reset}

A single script that handles all audit functionality:
• Build sites (swift or full)
• Generate site audits
• Compare audit reports
• Update audit baselines
• Provide intelligent recommendations

${colors.bright}Usage:${colors.reset}
  node audit.mjs [options] [directory]

${colors.bright}Options:${colors.reset}
  --build              Run build before audit (swift build)
  --build-full         Run full build before audit
  --compare [N]        Compare last N audits (default: 3)
  --update-baseline    Update the audit baseline after confirmation
  --auto-baseline      Automatically update baseline if significant changes
  --quiet             Minimal output mode
  --help              Show this help message

${colors.bright}Examples:${colors.reset}
  node audit.mjs                           # Smart audit with recommendations
  node audit.mjs --build                   # Build + smart audit (most common)
  node audit.mjs --build-full              # Full build + smart audit
  node audit.mjs --compare                 # Compare last 3 audits
  node audit.mjs --compare 5               # Compare last 5 audits
  node audit.mjs --update-baseline         # Update baseline with confirmation
  node audit.mjs --auto-baseline           # Auto-update baseline if needed
  node audit.mjs build/temp/public_html    # Audit specific directory
`);
    return;
  }

  // Parse options
  const options = {
    build: args.includes('--build'),
    buildFull: args.includes('--build-full'),
    compare: false,
    updateBaseline: args.includes('--update-baseline'),
    autoBaseline: args.includes('--auto-baseline'),
    quiet: args.includes('--quiet'),
    directory: null
  };

  // Handle --compare option
  const compareIndex = args.findIndex(arg => arg === '--compare');
  if (compareIndex !== -1) {
    const nextArg = args[compareIndex + 1];
    options.compare = (nextArg && !nextArg.startsWith('--')) ? parseInt(nextArg) : 3;
  }

  // Find directory argument (non-option argument)
  const directoryArg = args.find(arg => !arg.startsWith('--') && arg !== String(options.compare));
  if (directoryArg) {
    options.directory = path.resolve(directoryArg);
  }

  const audit = new UnifiedAudit(options);
  await audit.run();
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { UnifiedAudit };
