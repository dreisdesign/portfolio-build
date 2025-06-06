#!/bin/bash
# filepath: /Users/danielreis/web/danrtzaq/dev/scripts/deploy/simple-deploy.sh

# Ultra-simple deployment script that only deploys the build directory
# Based directly on the working legacy script

# Configuration
REMOTE_USER="danrtzaq"
REMOTE_HOST="danreisdesign.com"
REMOTE_PORT="21098"
BUILD_DIR="/Users/danielreis/web/danrtzaq/build/temp/public_html"
REMOTE_PATH="/home/danrtzaq/public_html"
SSH_KEY="$HOME/.ssh/id_rsa"
MAX_RETRIES=3
OPEN_BROWSER=false # Default to not opening browser automatically

# Check build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "Error: Build directory not found: $BUILD_DIR"
    exit 1
fi

# Process command line arguments
for arg in "$@"; do
    case "$arg" in
        --dry-run)
            echo "Running in DRY RUN mode (no actual changes on server)"
            DRY_RUN=true
            ;;
        --skip-formatting)
            echo "Skipping formatting step"
            SKIP_FORMATTING=true
            ;;
        --skip-cache-busters)
            echo "Skipping cache busters"
            SKIP_CACHE_BUSTERS=true
            ;;
        --open-browser)
            echo "Will open browser after deployment"
            OPEN_BROWSER=true
            ;;
    esac
done

# Add SSH key
eval $(ssh-agent -s)
ssh-add "$SSH_KEY"

# Test SSH connection
echo "Testing SSH connection..."
if ssh -p $REMOTE_PORT "$REMOTE_USER@$REMOTE_HOST" "echo 'Connection successful'"; then
    echo "SSH connection successful"
else
    echo "Error: SSH connection test failed"
    exit 1
fi

# Create basic filter file for rsync
FILTER_FILE=$(mktemp)
cat > "$FILTER_FILE" << EOF
- /.DS_Store
- /._*
- /**/.DS_Store
- /**/._*
- /.git/***
- /node_modules/***
- /.cache/***
- /dev/***
- /**/package*.json
- /**/gulpfile.js
+ /**/
+ /**
EOF

# Count files for status reporting
TOTAL_FILES=$(find "$BUILD_DIR" -type f | wc -l | tr -d '[:space:]')
echo "Preparing to transfer $TOTAL_FILES files"

# Simple retry function for commands
retry_command() {
    local cmd="$1"
    local max_attempts="$2"
    local attempt=1

    while [ $attempt -le "$max_attempts" ]; do
        echo "Attempt $attempt of $max_attempts"
        eval "$cmd" && return 0

        attempt=$((attempt+1))
        echo "Command failed, retrying in 5 seconds..."
        sleep 5
    done

    echo "Command failed after $max_attempts attempts"
    return 1
}

# Run rsync with minimal options and small --bwlimit to prevent connection issues
echo "Starting file transfer..."

# Add --dry-run flag if in dry run mode
DRY_RUN_FLAG=""
if [ "$DRY_RUN" = true ]; then
    DRY_RUN_FLAG="--dry-run"
    echo "DRY RUN MODE: No actual changes will be made on the server"
fi

retry_command "rsync -avz $DRY_RUN_FLAG --delete --delete-excluded \
    --filter=\"merge $FILTER_FILE\" \
    --timeout=60 \
    --bwlimit=500 \
    --checksum \
    -e \"ssh -p $REMOTE_PORT -o ServerAliveInterval=10 -o ServerAliveCountMax=6\" \
    \"$BUILD_DIR/\" \
    \"$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/\"" $MAX_RETRIES

if [ $? -ne 0 ]; then
    echo "File transfer failed after multiple attempts"
    rm -f "$FILTER_FILE"
    exit 1
fi

rm -f "$FILTER_FILE"

# Only run the following commands if not in dry run mode
if [ "$DRY_RUN" != true ]; then
    # Set permissions (with retry)
    echo "Setting file permissions..."
    retry_command "ssh -p $REMOTE_PORT \"$REMOTE_USER@$REMOTE_HOST\" \"chmod -R u=rwX,g=rX,o=rX '$REMOTE_PATH'\"" $MAX_RETRIES

    # Clear cache (with retry)
    echo "Clearing cache..."
    retry_command "ssh -p $REMOTE_PORT \"$REMOTE_USER@$REMOTE_HOST\" \"touch '$REMOTE_PATH/.htaccess'; [ -d /home/danrtzaq/tmp/cache ] && rm -rf /home/danrtzaq/tmp/cache/* || true\"" $MAX_RETRIES
else
    echo "DRY RUN MODE: Skipping permission setting and cache clearing"
fi

# Deployment successful
echo "🚀 Deployment completed successfully!"

# Open browser if requested and not in dry run mode
if [ "$OPEN_BROWSER" = true ] && [ "$DRY_RUN" != true ]; then
    echo "Opening website in browser..."
    # Check OS and use appropriate command to open browser
    case "$(uname)" in
        "Darwin") # macOS
            open "https://$REMOTE_HOST"
            ;;
        "Linux")
            if command -v xdg-open &> /dev/null; then
                xdg-open "https://$REMOTE_HOST"
            elif command -v gnome-open &> /dev/null; then
                gnome-open "https://$REMOTE_HOST"
            else
                echo "Could not open browser automatically."
                echo "Please visit https://$REMOTE_HOST"
            fi
            ;;
        *)
            echo "Could not open browser automatically on this OS."
            echo "Please visit https://$REMOTE_HOST"
            ;;
    esac
elif [ "$OPEN_BROWSER" = true ] && [ "$DRY_RUN" = true ]; then
    echo "DRY RUN MODE: Would have opened https://$REMOTE_HOST in browser"
fi

echo "Deployment completed successfully!"
