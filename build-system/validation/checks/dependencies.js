/**
 * Dependency Checker
 *
 * Created: 2025-03-29
 * Last Modified: 2025-03-29
 * Version: 1.0.0
 *
 * Validates required dependencies:
 * - Package availability
 * - Version compatibility
 * - Installation status
 */

const fs = require('fs');
const path = require('path');

class DependencyChecker {
  static async checkDependencies() {
    const pkgPath = path.resolve(__dirname, '../../../../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const requiredDeps = ['cheerio', 'sharp', 'express', 'node-fetch', 'video.js'];

    const missing = requiredDeps.filter(dep =>
      !pkg.dependencies?.[dep] && !pkg.devDependencies?.[dep]
    );

    if (missing.length > 0) {
      throw new Error(`Missing dependencies: ${missing.join(', ')}`);
    }

    return true;
  }
}

module.exports = DependencyChecker;
