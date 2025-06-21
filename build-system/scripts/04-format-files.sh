#!/bin/bash

# File Formatting Script
#
# Created: 2025-03-29
# Last Modified: 2025-04-17
# Version: 1.4.0
#
# Formats various file types:
# - CSS minification
# - CSS concatenation into main.min.css
# - HTML formatting
# - Common HTML elements injection (favicons, scripts, etc.)
# - JSON formatting
#
# Note: Timestamp updating has been moved to the validation script (00-validate-html.mjs)

# Get script paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../../../.." && pwd )"  # Fix: Added one more level up
BUILD_DIR="${1:-$PROJECT_ROOT/build/temp/public_html}"
HEAD_TEMPLATES_DIR="$SCRIPT_DIR/../head-templates"

# Add verbosity control
VERBOSE=${VERBOSE:-false}
function log() {
    if [ "$VERBOSE" = true ] || [ "$2" = "always" ]; then
        echo "$1"
    fi
}

# Path validation function
function validate_paths() {
    log "Validating paths..." "always"
    log "Project root: $PROJECT_ROOT" "always"
    log "Build dir: $BUILD_DIR" "always"
    log "Head templates dir: $HEAD_TEMPLATES_DIR" "always"
    
    if [ ! -d "$PROJECT_ROOT/public_html" ]; then
        log "Error: public_html directory not found" "always"
        return 1
    fi
    
    if [ ! -d "$HEAD_TEMPLATES_DIR" ]; then
        log "Error: head-templates directory not found" "always"
        return 1
    fi
    return 0
}

# Check for required dependencies
function check_dependencies {
    if ! [ -f "$PROJECT_ROOT/node_modules/.bin/cleancss" ]; then
        log "Error: cleancss not found" "always"
        log "Installing required dependencies..." "always"
        if ! (cd "$PROJECT_ROOT" && npm install clean-css clean-css-cli prettier --save-dev); then
            log "Failed to install dependencies. Please run manually:" "always"
            return 1
        fi
    fi
    return 0
}

# Minify CSS files
function minify_css_files() {
    log "Processing CSS files..." "always"
    if [ ! -d "$BUILD_DIR/styles" ]; then
        log "Warning: Styles directory not found" "always"
        return 1
    fi

    # First process main.css which contains all main-* imports
    MAIN_CSS="$BUILD_DIR/styles/main.css"
    if [ -f "$MAIN_CSS" ]; then
        echo "Processing main.css which imports all main-* modules..."
        OUTPUT_FILE="$BUILD_DIR/styles/main.min.css"
        
        # Add header to minified file
        echo "/* {{AUTHOR_NAME}} Portfolio - Combined CSS - Generated: $(date) */" > "$OUTPUT_FILE"
        
        # Minify main.css which includes all main-* imports
        npx clean-css-cli -o "$OUTPUT_FILE" "$MAIN_CSS"
    else
        log "Error: main.css not found" "always"
        return 1
    fi

    # Then process other standalone CSS files (feature-*, page-*, etc.)
    echo "Processing other CSS files..."
    CSS_FILES=$(find "$BUILD_DIR/styles" -name "*.css" ! -name "main*.css" ! -name "*.min.css" | sort)
    CSS_COUNT=$(echo "$CSS_FILES" | grep -c "." || echo "0")
    
    if [ "$CSS_COUNT" -gt 0 ]; then
        echo "Found $CSS_COUNT additional CSS files to minify"
        for file in $CSS_FILES; do
            filename=$(basename "$file")
            echo "Minifying $filename..."
            OUTPUT_FILE="${file%.css}.min.css"
            npx clean-css-cli -o "$OUTPUT_FILE" "$file"
        done
        echo "Successfully minified $CSS_COUNT additional CSS files"
    fi

    return 0
}

# Validate paths
validate_paths || exit 1

# Check dependencies
check_dependencies || exit 1

# Minify and concatenate CSS files
minify_css_files

# Inject common HTML head elements
echo "Injecting common HTML head elements..."
node "$HEAD_TEMPLATES_DIR/inject-head.mjs" "$BUILD_DIR"
echo "HTML head injection completed successfully"

# Format HTML files
echo "Checking HTML files..."
HTML_FILES=$(find "$BUILD_DIR" -name "*.html" | sort -u)
HTML_COUNT=$(echo "$HTML_FILES" | grep -c "." || echo "0")

if [ "$HTML_COUNT" -gt 0 ]; then
    echo "Found $HTML_COUNT unique HTML files to format"
    
    count=0
    for file in $HTML_FILES; do
        filename=$(basename "$file")
        relpath="${file#$BUILD_DIR/}"
        printf "Formatting (%2d/%2d): %-60s\r" $count $HTML_COUNT "$relpath"
        
        # Pre-process to protect </source> tags
        # Replace </source> with a unique placeholder that prettier won't touch
        TEMP_FILE=$(mktemp)
        sed 's/<\/source>/<!--SOURCE_CLOSING_TAG_PLACEHOLDER-->/g' "$file" > "$TEMP_FILE"
        
        # Format HTML file with prettier
        npx prettier --write "$TEMP_FILE" --parser html --print-width 100 --tab-width 2 --no-config >/dev/null 2>&1
        
        # Restore </source> tags from placeholders and save back to original file
        sed 's/<!--SOURCE_CLOSING_TAG_PLACEHOLDER-->/<\/source>/g' "$TEMP_FILE" > "$file"
        
        # Clean up temp file
        rm -f "$TEMP_FILE"
        
        count=$((count+1))
    done
    
    echo ""
    echo "Successfully formatted $HTML_COUNT HTML files"
    echo "Note: Timestamps are now updated during the validation step"
else
    echo "No HTML files found to format"
fi

# Format JSON files
if [ -d "$BUILD_DIR/data" ]; then
    JSON_FILES=$(find "$BUILD_DIR/data" -name "*.json")
    JSON_COUNT=$(echo "$JSON_FILES" | grep -c "." || echo "0")
    
    if [ "$JSON_COUNT" -gt 0 ]; then
        echo "Found $JSON_COUNT JSON files to format"
        
        count=0
        for file in $JSON_FILES; do
            filename=$(basename "$file")
            echo "Formatting JSON ($count/$JSON_COUNT): $filename"
            
            # Format JSON file
            npx prettier --write "$file" --parser json --print-width 100 --tab-width 2 --no-config >/dev/null 2>&1
            
            count=$((count+1))
        done
        
        echo "Successfully formatted $JSON_COUNT JSON files"
    else
        echo "No JSON files found to format"
    fi
fi

echo "File formatting completed successfully."
