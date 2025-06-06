#!/bin/bash
# Test script to verify browser opening functionality
# This utility helps test the browser opening feature that's used in the deployment process

# Set colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Browser Opening Test Utility${NC}"
echo -e "${GREEN}=============================${NC}"
echo -e "This script will attempt to open {{DEPLOY_HOST}} in your browser."
echo -e "Use this to verify browser opening functionality for the deployment process."
echo

# Detect operating system
echo -e "${YELLOW}System Detection:${NC}"
OS="$(uname)"
echo -e "  • Operating System: ${BLUE}$OS${NC}"

# Try to open the website based on OS detection
case "$OS" in
    "Darwin") # macOS
        echo -e "  • Detected macOS, using 'open' command"
        open "https://{{DEPLOY_HOST}}"
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}✓ Browser opened successfully${NC}"
        else
            echo -e "  ${RED}✗ Failed to open browser${NC}"
        fi
        ;;
    "Linux")
        echo -e "  • Detected Linux, checking available browser opener"
        if command -v xdg-open &> /dev/null; then
            echo -e "  • Using xdg-open command"
            xdg-open "https://{{DEPLOY_HOST}}"
            if [ $? -eq 0 ]; then
                echo -e "  ${GREEN}✓ Browser opened successfully${NC}"
            else
                echo -e "  ${RED}✗ Failed to open browser${NC}"
            fi
        elif command -v gnome-open &> /dev/null; then
            echo -e "  • Using gnome-open command"
            gnome-open "https://{{DEPLOY_HOST}}"
            if [ $? -eq 0 ]; then
                echo -e "  ${GREEN}✓ Browser opened successfully${NC}"
            else
                echo -e "  ${RED}✗ Failed to open browser${NC}"
            fi
        else
            echo -e "  ${RED}✗ Could not find a suitable browser opener command${NC}"
            echo -e "    Please visit https://{{DEPLOY_HOST}} manually"
        fi
        ;;
    *)
        echo -e "  ${RED}✗ Unrecognized OS: $OS${NC}"
        echo -e "    Please visit https://{{DEPLOY_HOST}} manually"
        ;;
esac

echo
echo -e "${GREEN}Test completed.${NC}"
echo -e "You can use this script to verify browser opening functionality"
echo -e "or to troubleshoot issues with the automatic browser opening feature."
