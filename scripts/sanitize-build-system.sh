#!/bin/bash

# Sanitization script to replace sensitive information with placeholders
# This script sanitizes all build system files in the public repository

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_REPO="$SCRIPT_DIR/.."
BUILD_SYSTEM_DIR="$PUBLIC_REPO/build-system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting sanitization of build system files...${NC}"

# Function to sanitize a single file
sanitize_file() {
    local file="$1"
    local temp_file="${file}.tmp"
    
    echo -e "  ${YELLOW}Sanitizing:${NC} $(basename "$file")"
    
    # Start with the original file
    cp "$file" "$temp_file"
    
    # Apply all pattern replacements using sed - be more comprehensive
    # Replace usernames and hostnames
    sed -i.bak 's/danrtzaq/{{DEPLOY_USER}}/g' "$temp_file"
    sed -i.bak 's/danreisdesign\.com/{{DEPLOY_HOST}}/g' "$temp_file"
    sed -i.bak 's/danreisdesign.com/{{DEPLOY_HOST}}/g' "$temp_file"
    
    # Replace ports
    sed -i.bak 's/21098/{{DEPLOY_PORT}}/g' "$temp_file"
    
    # Replace file paths
    sed -i.bak 's|/home/danrtzaq/public_html|{{DEPLOY_PATH}}|g' "$temp_file"
    sed -i.bak 's|/Users/danielreis/web/danrtzaq|{{PROJECT_ROOT}}|g' "$temp_file"
    sed -i.bak 's|~/.ssh/id_rsa|{{SSH_KEY_PATH}}|g' "$temp_file"
    
    # Replace author information
    sed -i.bak 's/Dan Reis/{{AUTHOR_NAME}}/g' "$temp_file"
    sed -i.bak 's/danreisdesign@gmail\.com/{{AUTHOR_EMAIL}}/g' "$temp_file"
    sed -i.bak 's/danreisdesign@gmail.com/{{AUTHOR_EMAIL}}/g' "$temp_file"
    
    # Replace variable assignments that might have been missed
    sed -i.bak 's/REMOTE_USER="{{DEPLOY_USER}}"/REMOTE_USER="{{DEPLOY_USER}}"/g' "$temp_file"
    sed -i.bak 's/REMOTE_HOST="{{DEPLOY_HOST}}"/REMOTE_HOST="{{DEPLOY_HOST}}"/g' "$temp_file"
    sed -i.bak 's/REMOTE_PORT="{{DEPLOY_PORT}}"/REMOTE_PORT="{{DEPLOY_PORT}}"/g' "$temp_file"
    
    # Clean up backup files
    rm -f "${temp_file}.bak"
    
    # Move sanitized file back
    mv "$temp_file" "$file"
    
    echo -e "    ${GREEN}✓${NC} Sanitized $(basename "$file")"
}

# Function to sanitize directory
sanitize_directory() {
    local dir="$1"
    local pattern="$2"
    local description="$3"
    
    if [ ! -d "$dir" ]; then
        echo -e "${RED}Directory not found:${NC} $dir"
        return 1
    fi
    
    echo -e "\n${BLUE}Sanitizing $description...${NC}"
    
    # Find files matching pattern and sanitize them
    find "$dir" -type f \( $pattern \) | while read -r file; do
        sanitize_file "$file"
    done
    
    echo -e "  ${GREEN}✓${NC} Completed: $description"
}

# Sanitize different file types
echo -e "${BLUE}Sanitizing build system files...${NC}"

# Sanitize JavaScript/Node.js files
sanitize_directory "$BUILD_SYSTEM_DIR" "-name '*.mjs' -o -name '*.js'" "JavaScript files"

# Sanitize shell scripts
sanitize_directory "$BUILD_SYSTEM_DIR" "-name '*.sh'" "Shell scripts"

# Sanitize JSON configuration files
sanitize_directory "$BUILD_SYSTEM_DIR" "-name '*.json'" "JSON configuration files"

# Sanitize specific file types that might contain sensitive data
sanitize_directory "$BUILD_SYSTEM_DIR" "-name '*.md'" "Markdown files"

# Special handling for package.json to ensure it's properly formatted
if [ -f "$BUILD_SYSTEM_DIR/package.json" ]; then
    echo -e "\n${BLUE}Special handling for package.json...${NC}"
    
    # Use Node.js to properly format JSON after sanitization
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('$BUILD_SYSTEM_DIR/package.json', 'utf8'));
        
        // Additional sanitization for package.json specific fields
        if (pkg.name === '{{DEPLOY_USER}}') {
            pkg.name = 'portfolio-build-system';
        }
        
        if (pkg.author && pkg.author.includes('{{AUTHOR_NAME}}')) {
            pkg.author = '{{AUTHOR_NAME}} <{{AUTHOR_EMAIL}}>';
        }
        
        if (pkg.repository && pkg.repository.url) {
            pkg.repository.url = 'https://github.com/dreisdesign/portfolio-build.git';
        }
        
        fs.writeFileSync('$BUILD_SYSTEM_DIR/package.json', JSON.stringify(pkg, null, 2));
    "
    
    echo -e "  ${GREEN}✓${NC} Formatted package.json"
fi

# Create a sanitization log
SANITIZATION_LOG="$PUBLIC_REPO/.sanitization.log"
echo "Sanitization completed on $(date)" > "$SANITIZATION_LOG"
echo "Files sanitized:" >> "$SANITIZATION_LOG"
find "$BUILD_SYSTEM_DIR" -type f \( -name "*.mjs" -o -name "*.js" -o -name "*.sh" -o -name "*.json" -o -name "*.md" \) >> "$SANITIZATION_LOG"

echo -e "\n${GREEN}Sanitization completed successfully!${NC}"
echo -e "${BLUE}Files processed:${NC}"
find "$BUILD_SYSTEM_DIR" -type f \( -name "*.mjs" -o -name "*.js" -o -name "*.sh" -o -name "*.json" -o -name "*.md" \) | wc -l | xargs echo "  Files:"

echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Review sanitized files for any remaining sensitive content"
echo "2. Test the build system to ensure it still works"
echo "3. Commit the sanitized changes"
echo "4. Update documentation if needed"

# Validate that sanitization was successful
echo -e "\n${BLUE}Validation:${NC}"
SENSITIVE_FOUND=$(find "$BUILD_SYSTEM_DIR" -type f \( -name "*.mjs" -o -name "*.js" -o -name "*.sh" -o -name "*.json" \) -exec grep -l "danrtzaq\|danreisdesign\\.com\|21098\|/home/danrtzaq\|/Users/danielreis/web/danrtzaq" {} \; 2>/dev/null || true)

if [ -n "$SENSITIVE_FOUND" ]; then
    echo -e "${RED}⚠️  Warning: Some files may still contain sensitive information:${NC}"
    echo "$SENSITIVE_FOUND"
else
    echo -e "${GREEN}✓${NC} No obvious sensitive patterns found in sanitized files"
fi
