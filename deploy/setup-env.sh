#!/bin/bash

set -e

# Set up environment variables first
SHELL_CONFIG="$HOME/.zshrc"
NODE_ENV_LINE='export NODE_ENV=development'

if ! grep -q "export NODE_ENV=" "$SHELL_CONFIG"; then
    echo "Adding NODE_ENV to shell config..."
    echo "$NODE_ENV_LINE" >> "$SHELL_CONFIG"
fi

# Export for current session
export NODE_ENV=development

# Check for Homebrew
if ! command -v brew >/dev/null 2>&1; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install nodenv
if ! command -v nodenv >/dev/null 2>&1; then
    echo "Installing nodenv..."
    brew install nodenv

    # Add to both shell config and current session
    echo 'eval "$(nodenv init -)"' >> "$SHELL_CONFIG"
    source "$SHELL_CONFIG"
    eval "$(nodenv init -)"
fi

# Install Node.js LTS
echo "Installing Node.js 20.11.1 (LTS)..."
nodenv install 20.11.1 || true
nodenv global 20.11.1

# Source changes immediately
source "$SHELL_CONFIG"

# Verify environment
if command -v nodenv >/dev/null 2>&1 && [ ! -z "$NODE_ENV" ]; then
    echo "✓ nodenv installed and configured"
    echo "✓ Node.js version: $(nodenv version)"
    echo "✓ NODE_ENV=$NODE_ENV"

    # Force shell to reload
    exec $SHELL -l
else
    echo "Error: Installation verification failed"
    exit 1
fi

echo "Environment setup complete!"
echo "Please restart your terminal or run:"
echo "source ~/.zshrc"
