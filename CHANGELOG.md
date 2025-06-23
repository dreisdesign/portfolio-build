# Changelog

> **Note**: This documentation has been developed with AI assistance as part of a collaborative development workflow. The build system represents real-world production code enhanced through human-AI collaboration.

All notable changes to the Portfolio Build System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2025-06-23 - Major Image Pipeline & Build System Improvements

### Added
- **Automatic Image Dimension Injection** - Revolutionary build pipeline enhancement
  - Sharp-based automatic width/height attribute injection for all images
  - Eliminates need for manual dimension attributes in source HTML
  - Improves layout stability and performance with proper aspect ratios
  - Seamless integration with existing responsive image workflow

- **Comprehensive Image Pipeline Cleanup**
  - `cleanup-build-images.sh`: Removes unwanted upscayl variants and duplicate files
  - Cleans both active build and backup directories to prevent slow deploys
  - Solves build asset preservation issues that caused 242+ unwanted files
  - Significant deploy performance improvements

- **Enhanced Utility Scripts Organization**
  - `batch-upscayl.sh`: Safe batch upscaling workflow with duplicate filename handling
  - `compress-pngs.js`: Sharp-based PNG compression utility for batch testing
  - All utility scripts moved to organized `/dev/scripts/utilities/` directory

### Enhanced
- **Build Pipeline Performance** - Major improvements to build speed and reliability
  - Automatic image dimension detection and injection using Sharp
  - Standardized image attributes (loading, fetchpriority, decoding) based on image type
  - Improved zoomable image logic to always use full-res original files
  - Enhanced insert-section template for clean, minimal HTML generation

- **Image Processing Workflow** - Complete standardization and optimization
  - Removed all manual width/height attributes from source HTML files
  - Eliminated redundant image attributes across all portfolio pages
  - Updated build scripts to use `audit.mjs --compare` for validation
  - Improved Sharp-based image processing with better error handling

### Fixed
- **Layout and Accessibility Consistency** - Perfect alignment across all portfolio pages
  - Refactored CSS for full-width backgrounds with proper content wrappers
  - Standardized spacing using rem units for better accessibility
  - Removed conflicting width rules and simplified container responsibilities
  - Enhanced responsive behavior across all screen sizes

- **Zoomable Image System** - Cross-browser consistency and sharpness improvements
  - Fixed zoomable image logic to avoid nested `<picture>` elements
  - Improved JavaScript for better loading and Safari compatibility
  - Enhanced image sharpness and resolution handling
  - Removed all image sharpening from build scripts for cleaner output

- **Build Output Management** - Solved persistent asset preservation issues
  - Fixed upscayl images being preserved in `swift-assets-backup` directory
  - Eliminated slow deploy times caused by hundreds of unwanted processed images
  - Improved build cleanup to prevent accumulation of duplicate files
  - Enhanced build validation and error reporting

### Technical Improvements
- **CSS Architecture** - Complete layout system overhaul
  - Updated `main-layout.css`, `main-responsiveness.css`, `main-utilities.css`
  - Enhanced `page-home.css` and `feature-zoom.css` for better performance
  - Improved spacing, accessibility, and cross-browser compatibility

- **Build Scripts** - Enhanced reliability and feature set
  - Updated image transformation scripts with dimension injection
  - Improved utility organization and documentation
  - Enhanced error handling and validation workflows
  - Better integration between build steps and asset management

### Migration Notes
- Source HTML files no longer need manual width/height attributes on images
- Build pipeline automatically injects correct dimensions during processing
- Utility scripts moved to `/dev/scripts/utilities/` for better organization
- New cleanup script available for maintaining clean build outputs

## [1.5.0] - 2025-01-07 - Complete Layout & Cross-Browser Improvements Sync

### Added
- **Comprehensive Layout System Updates**: Synced complete layout consistency and spacing improvements
  - Refactored wrapper container architecture for full-width backgrounds with centered content
  - Implemented semantic spacing system using rem units for better accessibility
  - Added Safari-specific CSS fixes for card sizing and layout issues
  - Enhanced footer responsiveness with improved mobile behavior
- **Advanced Build Pipeline Features**: Updated build scripts with latest improvements
  - Git-based image processing with smart change detection
  - Company logo injection system with automatic detection
  - Enhanced portfolio tagging and categorization
  - Improved cross-browser compatibility handling
- **Modern CSS Architecture**: Complete CSS system overhaul
  - Standardized content spacing with margin-based approach
  - Removed conflicting width rules and simplified container responsibilities
  - Added proper spacing rules for all content elements
  - Improved maintainability and code organization

### Changed
- **Build System Architecture**: Updated all core build scripts to latest versions
  - Enhanced image processing with git-based change detection
  - Improved HTML validation and processing pipeline
  - Updated head templates with company logo injection
  - Streamlined utility scripts and audit functionality
- **Development Tools**: Refreshed development servers and configuration
  - Updated multi-server setup for better development workflow
  - Enhanced package.json configuration with latest dependencies
  - Improved ESLint, Prettier, and EditorConfig integration

### Fixed
- **Cross-Browser Compatibility**: Resolved Safari and iOS rendering issues
  - Fixed Safari "Up Next" card sizing problems on initial page load
  - Resolved persistent iOS Safari footer link color issues
  - Added Safari-specific transforms and layout fixes
- **Layout Consistency**: Achieved perfect alignment across all sections
  - Eliminated width inconsistencies between Summary and content sections
  - Fixed responsive behavior across all screen sizes
  - Improved touch interface optimization for mobile devices

### Technical Details
- **Private Repository Sync**: Updated sync script to use correct source paths
- **Sanitization**: All sensitive information properly replaced with placeholder variables
- **Version Management**: Automated sync metadata tracking for better maintenance
- **22 Files Updated**: Comprehensive update including all build scripts, utilities, and configuration

## [1.4.0] - 2025-06-19

### Fixed
- **Critical Tag Page Generation Issue** - Resolved empty tag pages bug
  - Fixed build script to extract tag data from source files instead of processed build files
  - Corrected path processing for accurate company names and image paths
  - All 32 tag pages now display portfolio cards correctly with proper headers and content
  
- **Tag Page Template Issues** - Multiple template and build fixes
  - Removed double colon issue in "My Role::" labels (now displays as "My Role:")
  - Fixed placeholder matching between template and build script regex
  - Corrected card insertion point indentation in tag-listing-template.html
  
### Enhanced
- **Portfolio Data Generation** - Improved tag data handling
  - Enhanced portfolio-items.json to include complete tag data for all projects
  - Fixed tag categorization and grouping across all portfolio projects
  - Validated tag system works correctly with Role, Platform, and Audience categories

### Technical Improvements
- **Build Script Reliability** - Enhanced error handling and path resolution
  - Improved regex matching for card insertion in tag pages
  - Better file path processing in metadata extraction
  - More robust template processing to ensure consistent card insertion

### Validation
- **Complete Tag System Testing** - Verified all components working
  - All 32 tag pages properly generated with correct portfolio cards
  - Tag index categorization working as intended
  - Portfolio card display consistent across main index, tag pages, and "Up Next" sections

## [1.3.0] - 2025-06-16

### Added
- **Intelligent Image Change Detection System** - Revolutionary performance improvement
  - Smart timestamp-based change detection for image processing
  - Only processes images that have actually changed or are missing outputs
  - Achieves 99%+ build time savings for typical development workflows
  - Clear debug output showing which images are processed vs skipped

### Enhanced
- **Build Performance** - Dramatic speed improvements
  - No image changes: ~0.1 seconds processing time (vs 2-3 minutes)
  - Few image changes: Only processes modified images (~3-5s per image)
  - Typical development workflow: 99%+ faster builds
  
### Technical Implementation
- **Change Detection Logic** - Compares source modification time against processed outputs
- **File Safety** - Never modifies source images, maintains clean source/build separation
- **Selective Processing** - Processes only when outputs missing or source is newer
- **Debug Logging** - Clear feedback on processing decisions

### Performance Examples
```
📊 Image processing complete:
   • 0 images processed
   • 151 images skipped  
   • 0.1s total time
   • 99% build time saved
```

## [1.2.0] - 2025-05-15

### Added
- **Automatic Image Sharpening** - Enhanced image clarity
  - Applied subtle sharpening to all processed images
  - Conservative parameters: sigma=0.5, flat=0.8, jagged=1.0
  - Improves visual quality without artifacts

### Enhanced
- **Image Processing Pipeline** - More robust and reliable
- **Favicon Handling** - Better exclusion logic for icon files

## [1.1.0] - 2025-04-14

### Added
- **Favicon Exclusion Logic** - Prevents processing of icon files
- **Better File Filtering** - More accurate file type detection

## [1.0.0] - 2025-03-29

### Added
- **Initial Release** - Complete portfolio build system
- **Responsive Image Processing** - Multi-format, multi-size generation
- **WebP Conversion** - Modern format support
- **Portfolio Structure** - Three-category tagging system
- **Build Pipeline** - Complete validation and processing workflow

### Features
- HTML validation and processing
- Responsive image generation (320px to 1800px)
- WebP and PNG format support
- Portfolio tagging and categorization
- Automated deployment scripts
- Development server integration

## [2025-06-22-v18] - June 22, 2025

### Fixed
- **Image Rendering**: Removed global `img` CSS rules from `feature-zoom.css` that were causing aliasing issues on regular (non-zoomable) images, especially on the portfolio index page. Image rendering improvements are now scoped only to zoomable images.
- **Zoomable Images**: Reverted zoom detection logic in favor of upscaling source images for better zoom quality and simpler code.

### Technical
- Scoped image-rendering CSS properties to `.zoomable-image` selectors only
- Simplified zoomable-image.js to mark all `picture img` elements as zoomable by default
- Maintained all existing zoom functionality and image quality improvements
