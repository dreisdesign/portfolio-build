# Setup Guide

## System Requirements

- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher  
- **Git**: For version control
- **SSH**: For deployment (optional)

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/dreisdesign/portfolio-build.git
cd portfolio-build
```

### 2. Install Dependencies
```bash
cd build-system
npm install
```

### 3. Configuration Setup

#### Environment Variables
Copy the example environment file and configure your settings:

```bash
cp config/.env.example .env
```

Edit `.env` with your specific configuration:

```bash
# Deployment Configuration
DEPLOY_USER={{DEPLOY_USER}}
DEPLOY_HOST={{DEPLOY_HOST}}  
DEPLOY_PORT={{DEPLOY_PORT}}
DEPLOY_PATH={{DEPLOY_PATH}}

# SSH Configuration (optional)
SSH_KEY_PATH={{SSH_KEY_PATH}}

# Build Configuration
PROJECT_ROOT={{PROJECT_ROOT}}
BUILD_OUTPUT=public_html
```

#### Project Structure
Create your project structure:

```bash
mkdir -p {public_html,assets/images,data}
```

### 4. Verify Setup

Run the build system to verify everything is working:

```bash
npm run build
```

## Next Steps

1. Read the [Build Pipeline Documentation](BUILD-PIPELINE.md)
2. Review the [Portfolio Structure Guide](PORTFOLIO-STRUCTURE.md)  
3. Check out the [Configuration Reference](CONFIGURATION.md)
4. Explore the [Example Implementation](../example/)

## Troubleshooting

### Common Issues

**Node.js Version Error**
```bash
node --version  # Should be 18.x or higher
nvm use 18      # If using nvm
```

**Permission Errors**
```bash
sudo chown -R $(whoami) ~/.npm
```

**SSH Connection Issues**
- Verify SSH key permissions: `chmod 600 ~/.ssh/id_rsa`
- Test SSH connection: `ssh user@host -p port`

## Support

For questions or issues:
1. Check the [FAQ](FAQ.md)
2. Review existing [Issues](https://github.com/dreisdesign/portfolio-build/issues)
3. Create a new issue with detailed information
