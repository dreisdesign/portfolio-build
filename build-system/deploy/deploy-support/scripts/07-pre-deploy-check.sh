#!/bin/bash

# Consolidated Pre-deployment Validation Script
# This script validates the build for deployment by checking:
# - Required files existence
# - Portfolio data integrity
# - HTML validation using Node.js validator
# - Portfolio structure and next-project functionality
# - JSON data format and consistency

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../../../../../" && pwd)"
BUILD_DIR="$BASE_DIR/build/temp/public_html"
VALIDATION_LOG="$BASE_DIR/build/validation-log.txt"

# Clear previous validation log
if [ -f "$VALIDATION_LOG" ]; then
  rm "$VALIDATION_LOG"
fi
touch "$VALIDATION_LOG"

echo "Consolidated Build Validation"
echo "============================"

# Function to log errors
log_error() {
  echo "❌ $1"
  echo "$1" >> "$VALIDATION_LOG"
}

# Check build directory
if [ ! -d "$BUILD_DIR" ]; then
  log_error "Build directory missing: $BUILD_DIR"
  exit 1
fi

echo "1. Checking required files..."
REQUIRED_FILES=(
  "data/next-project.json"
  "data/portfolio-items.json"
  "portfolio/index.html"
)

HAS_ERRORS=0

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$BUILD_DIR/$file" ]; then
    log_error "Missing required file: $file"
    HAS_ERRORS=1
  else
    echo "✅ Found: $file"
  fi
done

# Check portfolio data integrity
echo -e "\n2. Checking portfolio data..."
if [ -f "$BUILD_DIR/data/next-project.json" ]; then
  # Check for empty JSON objects - should have at least 5 portfolio items
  PORTFOLIO_COUNT=$(grep -o "path" "$BUILD_DIR/data/next-project.json" | wc -l | tr -d '[:space:]')
  if [ "$PORTFOLIO_COUNT" -lt 1 ]; then
    log_error "Portfolio data appears incomplete: only $PORTFOLIO_COUNT items found"
    HAS_ERRORS=1
  else
    echo "✅ Portfolio data looks good: $PORTFOLIO_COUNT items found"
  fi
  
  # Validate JSON data format
  if ! jq empty "$BUILD_DIR/data/next-project.json" 2>/dev/null; then
    log_error "Invalid next-project.json format"
    HAS_ERRORS=1
  else
    echo "✅ next-project.json format is valid"
  fi
fi

# Count portfolio files and validate against JSON mappings
echo -e "\n3. Validating portfolio structure..."
PORTFOLIO_PAGES_COUNT=$(find "$BUILD_DIR/portfolio" -mindepth 2 -name "index.html" | sort -u | wc -l | tr -d '[:space:]')
echo "✅ Found $PORTFOLIO_PAGES_COUNT portfolio pages"

JSON_MAPPINGS_COUNT=$(jq '. | length' "$BUILD_DIR/data/next-project.json" | tr -d '[:space:]')
echo "✅ Found $JSON_MAPPINGS_COUNT next project mappings"

if [ "$PORTFOLIO_PAGES_COUNT" != "$JSON_MAPPINGS_COUNT" ]; then
    log_error "Mismatch between portfolio pages ($PORTFOLIO_PAGES_COUNT) and JSON mappings ($JSON_MAPPINGS_COUNT)"
    echo "Portfolio files:"
    find "$BUILD_DIR/portfolio" -mindepth 2 -name "index.html" -exec dirname {} \;
    echo "\nJSON mappings:"
    jq -r 'keys[]' "$BUILD_DIR/data/next-project.json"
    HAS_ERRORS=1
fi

# Check HTML structure for next-project containers
echo -e "\n4. Validating HTML structure..."
for file in $(find "$BUILD_DIR/portfolio" -name "index.html"); do
  # Skip portfolio root index.html
  if [ "$file" = "$BUILD_DIR/portfolio/index.html" ]; then
    continue
  fi
  
  if ! grep -q 'class="next-project-container"' "$file"; then
    log_error "Missing next-project container in: $file"
    HAS_ERRORS=1
  else
    basename_file=$(basename "$(dirname "$file")")
    echo "✅ next-project container found in: $basename_file"
  fi
done

# Run Node.js validator on all HTML files in portfolio directory
echo -e "\n5. Running HTML validation..."

# Define the correct path to the validate.mjs module
UTILS_DIR="$SCRIPT_DIR/../utils"
VALIDATE_MODULE="$UTILS_DIR/validate.mjs"

# Make sure utils directory exists
if [ ! -d "$UTILS_DIR" ]; then
  mkdir -p "$UTILS_DIR"
fi

if [ -f "$VALIDATE_MODULE" ]; then
  # Create and run a simple validation script
  TEMP_SCRIPT="$BASE_DIR/build/temp/validate-runner.mjs"
  cat > "$TEMP_SCRIPT" << EOF
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import validation module with correct path
import { validateHtml } from '${VALIDATE_MODULE.replace(/'/g, "\\'")}';

const BASE_DIR = "${BASE_DIR.replace(/'/g, "\\'")}";
const BUILD_DIR = "${BUILD_DIR.replace(/'/g, "\\'")}";
const VALIDATION_LOG = "${VALIDATION_LOG.replace(/'/g, "\\'")}";

function validateDirectory(dir) {
  const items = fs.readdirSync(dir);
  let hasErrors = false;
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (validateDirectory(fullPath)) {
        hasErrors = true;
      }
    } else if (item === 'index.html') {
      try {
        const html = fs.readFileSync(fullPath, 'utf8');
        if (!validateHtml(html, fullPath)) {
          fs.appendFileSync(VALIDATION_LOG, \`HTML validation failed: \${fullPath}\n\`);
          hasErrors = true;
        } else {
          console.log(\`✅ Validated: \${fullPath}\`);
        }
      } catch (err) {
        fs.appendFileSync(VALIDATION_LOG, \`Error processing \${fullPath}: \${err.message}\n\`);
        hasErrors = true;
      }
    }
  }
  
  return hasErrors;
}

const portfolioDir = path.join(BUILD_DIR, 'portfolio');
const hasErrors = validateDirectory(portfolioDir);
process.exit(hasErrors ? 1 : 0);
EOF

  # Run the validation script
  if ! node "$TEMP_SCRIPT"; then
    log_error "HTML validation failed - see $VALIDATION_LOG for details"
    HAS_ERRORS=1
  else
    echo "✅ HTML validation successful"
  fi
  
  # Clean up temp script
  rm "$TEMP_SCRIPT"
else
  log_error "Validation module not found: $VALIDATE_MODULE"
  HAS_ERRORS=1
fi

# Final validation result
if [ $HAS_ERRORS -eq 1 ]; then
  echo -e "\n❌ Validation failed - see $VALIDATION_LOG for details"
  exit 1
else
  echo -e "\n✅ All checks passed - build is ready for deployment!"
fi
