# Build Pipeline Documentation

## Overview

The Portfolio Build System is a comprehensive static site generator designed specifically for portfolio websites. It provides automated build processes, responsive image optimization, content validation, and deployment automation.

## Architecture

### Core Components

```
build-system/
├── deploy/                    # Main build scripts
│   ├── build.mjs             # Primary build orchestrator
│   └── deploy-support/       # Supporting modules
│       ├── scripts/          # Individual build steps
│       ├── head-templates/   # HTML head templates
│       ├── validation/       # Content validation
│       └── utils/           # Utility functions
├── server/                   # Development servers
└── package.json             # Dependencies and scripts
```

## Build Process

### 1. Initialization
- Loads configuration from environment variables
- Validates project structure and dependencies
- Sets up build directories

### 2. Content Processing
- **HTML Processing**: Validates and processes HTML files
- **Image Optimization**: Generates responsive images with intelligent change detection
- **Smart Processing**: Only processes changed or missing images for maximum efficiency
- **Tag Processing**: Processes portfolio tags and categorization
- **Content Validation**: Ensures content integrity and standards

### 3. Asset Management
- **Change Detection**: Compares source timestamps against processed outputs
- **Selective Processing**: Only processes images that need updating (99%+ time savings)
- **Image Resizing**: Creates multiple sizes for responsive design
- **Optimization**: Compresses images without quality loss
- **Format Conversion**: Converts to modern formats (WebP, AVIF)
- **Manifest Generation**: Creates image manifests for lazy loading

### 4. Portfolio Generation
- **Project Indexing**: Builds portfolio project index
- **Tag System**: Generates tag-based navigation
- **Metadata Extraction**: Processes project metadata
- **Template Application**: Applies consistent templates

### 5. Validation & Quality Assurance
- **HTML Validation**: Checks HTML syntax and structure
- **Link Validation**: Verifies internal and external links
- **Image Validation**: Ensures proper image optimization
- **Performance Checks**: Validates build performance metrics

### 6. Deployment Preparation
- **File Staging**: Prepares files for deployment
- **Manifest Creation**: Generates deployment manifests
- **Backup Management**: Creates incremental backups
- **Deployment Verification**: Pre-deployment checks

## Key Features

### Responsive Image System
```javascript
// Automatic responsive image generation
const imageSizes = [400, 800, 1200, 1600];
const formats = ['webp', 'avif', 'jpg'];

// Generates optimized images for all combinations
generateResponsiveImages(imageSizes, formats);
```

### Intelligent Image Change Detection
The build system includes smart change detection that dramatically improves performance:

```javascript
// Only processes changed or missing images
const shouldProcess = await checkImageChanges(sourcePath, outputDir);
if (shouldProcess) {
  await processImage(sourcePath);
  console.log('🔄 Processing: image.png');
} else {
  console.log('⏭️ Skipping: image.png (up to date)');
}
```

**Performance Benefits:**
- **No changes**: 0 images processed, 151 skipped → ~0.1 seconds
- **Few changes**: Only modified images → ~3-5 seconds per image  
- **Typical workflow**: 99%+ build time savings

**How it works:**
1. Compares source image timestamp against processed outputs
2. Processes if any outputs missing or source is newer
3. Skips if all outputs exist and are up-to-date
4. Never modifies source images - maintains clean separation

### Portfolio Tag System
```html
<!-- Automatic tag processing -->
<div class="portfolio-tags">
  <span class="tag" data-category="web-design">Web Design</span>
  <span class="tag" data-category="branding">Branding</span>
</div>
```

### Content Validation
- HTML syntax validation
- Image optimization verification
- Link integrity checking
- Performance benchmarking

### Development Tools
- Live reload development server
- Build watch mode
- Error reporting and debugging
- Performance profiling

## Build Scripts

### Primary Commands

```bash
# Full production build
npm run build

# Development build with watch
npm run dev

# Build with validation
npm run build:validate

# Deploy to production
npm run deploy

# Run development server
npm run serve
```

### Custom Build Steps

```bash
# Image optimization only
npm run build:images

# Portfolio generation only  
npm run build:portfolio

# Validation only
npm run validate

# Clean build artifacts
npm run clean
```

## Configuration

### Environment Variables

```bash
# Core Configuration
PROJECT_ROOT=/path/to/project
BUILD_OUTPUT=public_html
TEMP_DIR=build/temp

# Image Processing
IMAGE_QUALITY=85
RESPONSIVE_SIZES=400,800,1200,1600
IMAGE_FORMATS=webp,avif,jpg

# Validation
HTML_VALIDATION=true
LINK_CHECKING=true
PERFORMANCE_BUDGET=true

# Development
DEV_SERVER_PORT=8080
LIVE_RELOAD=true
```

### Build Configuration

```json
{
  "build": {
    "input": "src",
    "output": "public_html",
    "assets": "assets",
    "images": "assets/images"
  },
  "optimization": {
    "images": true,
    "minification": true,
    "compression": true
  },
  "validation": {
    "html": true,
    "links": true,
    "images": true,
    "performance": true
  }
}
```

## Performance

### Build Optimization
- **Parallel Processing**: Images and content processed simultaneously
- **Incremental Builds**: Only processes changed files
- **Caching**: Intelligent caching of processed assets
- **Memory Management**: Efficient memory usage for large portfolios

### Benchmarks
- **Small Portfolio** (10 projects): ~15 seconds
- **Medium Portfolio** (50 projects): ~45 seconds  
- **Large Portfolio** (100+ projects): ~90 seconds

## Customization

### Adding Build Steps
```javascript
// custom-build-step.mjs
export async function customBuildStep(config, logger) {
  logger.info('Running custom build step');
  // Your custom logic here
}
```

### Custom Validation Rules
```javascript
// custom-validator.mjs
export function validateCustomContent(content) {
  // Your validation logic
  return { valid: true, errors: [] };
}
```

### Template Customization
```html
<!-- custom-head-template.html -->
<meta name="custom-meta" content="{{CUSTOM_VALUE}}">
<link rel="custom-stylesheet" href="{{CUSTOM_CSS}}">
```

## Troubleshooting

### Common Build Issues

**Memory Errors**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

**Image Processing Failures**
```bash
# Check image dependencies
npm list sharp
npm install --save sharp
```

**Permission Errors**
```bash
# Fix directory permissions
chmod -R 755 build/
chmod -R 755 public_html/
```

### Debug Mode
```bash
# Enable detailed logging
DEBUG=true npm run build

# Verbose output
npm run build -- --verbose

# Dry run (no file changes)
npm run build -- --dry-run
```

## Integration

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Build Portfolio
  run: |
    cd build-system
    npm ci
    npm run build:validate
    npm run deploy
```

### Pre-commit Hooks
```bash
# .git/hooks/pre-commit
#!/bin/bash
npm run validate
if [ $? -ne 0 ]; then
  echo "Build validation failed"
  exit 1
fi
```

## Monitoring

### Build Metrics
- Build time tracking
- Asset size optimization
- Performance budget monitoring
- Error rate tracking

### Logging
```bash
# Build logs location
build/logs/build-$(date +%Y%m%d).log

# Error logs
build/logs/errors-$(date +%Y%m%d).log
```

This build system provides a robust foundation for professional portfolio websites with modern development practices and comprehensive automation.
