# Changelog

All notable changes to the Portfolio Build System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
