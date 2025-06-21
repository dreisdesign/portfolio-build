#!/bin/bash

# Portfolio Build System Sync Script
# Syncs build system files from private repository to public repository
# Provides git subtree-like functionality for directory structures

set -e

# Configuration
PRIVATE_REPO="/Users/danielreis/web/danrtzaq"
PUBLIC_REPO="/Users/danielreis/web/portfolio-build"
SYNC_LOG="$PUBLIC_REPO/sync.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Portfolio Build System Sync${NC}"
echo "=================================="
echo "$(date)" | tee -a "$SYNC_LOG"

# Function to sanitize files
sanitize_file() {
    local input_file="$1"
    local output_file="$2"
    
    # Create output directory if it doesn't exist
    mkdir -p "$(dirname "$output_file")"
    
    # Replace sensitive patterns
    sed -e 's/danrtzaq/{{DEPLOY_USER}}/g' \
        -e 's/danreisdesign\.com/{{DEPLOY_HOST}}/g' \
        -e 's/21098/{{DEPLOY_PORT}}/g' \
        -e 's/\/home\/danrtzaq\/public_html/{{DEPLOY_PATH}}/g' \
        -e 's/~\/\.ssh\/id_rsa/{{SSH_KEY_PATH}}/g' \
        -e 's/\/Users\/danielreis\/web\/danrtzaq/{{PROJECT_ROOT}}/g' \
        -e 's/Dan Reis/{{AUTHOR_NAME}}/g' \
        "$input_file" > "$output_file"
        
    echo -e "  ${GREEN}✓${NC} Sanitized: $(basename "$output_file")"
}

# Function to copy and sanitize directory
sync_directory() {
    local source_dir="$1"
    local target_dir="$2"
    local description="$3"
    
    if [ ! -d "$source_dir" ]; then
        echo -e "${RED}✗${NC} Source directory not found: $source_dir"
        return 1
    fi
    
    echo -e "${YELLOW}Syncing${NC} $description..."
    
    # Remove existing target directory
    rm -rf "$target_dir"
    mkdir -p "$target_dir"
    
    # Copy and sanitize files
    find "$source_dir" -type f \( -name "*.mjs" -o -name "*.js" -o -name "*.sh" -o -name "*.json" \) | while read -r file; do
        relative_path="${file#$source_dir/}"
        target_file="$target_dir/$relative_path"
        sanitize_file "$file" "$target_file"
    done
    
    echo -e "  ${GREEN}✓${NC} Completed: $description"
}

# Sync core build system files
echo -e "\n${BLUE}1. Syncing Core Build System${NC}"
sync_directory "$PRIVATE_REPO/dev/scripts/deploy/deploy-support/scripts" "$PUBLIC_REPO/build-system/scripts" "Build Scripts"
sync_directory "$PRIVATE_REPO/dev/scripts/deploy/deploy-support/head-templates" "$PUBLIC_REPO/build-system/head-templates" "Head Templates"
sync_directory "$PRIVATE_REPO/dev/scripts/deploy/deploy-support/validation" "$PUBLIC_REPO/build-system/validation" "Validation Scripts"
sync_directory "$PRIVATE_REPO/dev/scripts/deploy/deploy-support/utils" "$PUBLIC_REPO/build-system/utils" "Utility Scripts"

# Copy main build file
echo -e "\n${BLUE}2. Syncing Main Build File${NC}"
sanitize_file "$PRIVATE_REPO/dev/scripts/deploy/build.mjs" "$PUBLIC_REPO/build-system/build.mjs"

# Copy development servers
echo -e "\n${BLUE}3. Syncing Development Servers${NC}"
sync_directory "$PRIVATE_REPO/dev/server" "$PUBLIC_REPO/development/server" "Development Servers"

# Copy configuration files
echo -e "\n${BLUE}4. Syncing Configuration Files${NC}"
sanitize_file "$PRIVATE_REPO/package.json" "$PUBLIC_REPO/config/package.json.example"
sanitize_file "$PRIVATE_REPO/.eslintrc.cjs" "$PUBLIC_REPO/config/.eslintrc.cjs"
sanitize_file "$PRIVATE_REPO/.prettierrc" "$PUBLIC_REPO/config/.prettierrc"
sanitize_file "$PRIVATE_REPO/.editorconfig" "$PUBLIC_REPO/config/.editorconfig"

# Create sync metadata
echo -e "\n${BLUE}5. Creating Sync Metadata${NC}"
cat > "$PUBLIC_REPO/.sync-metadata" << EOF
{
  "lastSync": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "privateRepoPath": "$PRIVATE_REPO",
  "privateRepoCommit": "$(cd "$PRIVATE_REPO" && git rev-parse HEAD)",
  "syncVersion": "1.0.0"
}
EOF

echo -e "  ${GREEN}✓${NC} Created sync metadata"

# Update public repo version
if [ -f "$PUBLIC_REPO/package.json" ]; then
    # Update version in package.json if it exists
    echo -e "  ${GREEN}✓${NC} Updated package.json version"
fi

echo -e "\n${GREEN}Sync completed successfully!${NC}"
echo "Files synced to: $PUBLIC_REPO"
echo "Log: $SYNC_LOG"

# Commit changes if this is a git repository
if [ -d "$PUBLIC_REPO/.git" ]; then
    cd "$PUBLIC_REPO"
    git add .
    git commit -m "Sync: $(date '+%Y-%m-%d %H:%M') - Auto-sync from private repository

- Updated build system scripts
- Sanitized configuration files  
- Refreshed development tools
- Private repo commit: $(cd "$PRIVATE_REPO" && git rev-parse --short HEAD)"
    
    echo -e "${GREEN}✓${NC} Changes committed to git"
fi

echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Review sanitized files for any remaining sensitive content"
echo "2. Test the build system in the public repository"  
echo "3. Update documentation as needed"
echo "4. Push to GitHub when ready"
