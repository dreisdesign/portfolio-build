# Changelog

> **Note**: This documentation has been developed with AI assistance as part of a collaborative development workflow. The build system represents real-world production code enhanced through human-AI collaboration.

All notable changes to the Portfolio Build System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
