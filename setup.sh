#!/bin/bash

# ScrapeGoat Unified Setup Script
# This script sets up the entire application - development or production with Caddy

set -e  # Exit on error

echo "🚀 Setting up ScrapeGoat..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Optional: Email Configuration (uncomment and configure if needed)
# GMAIL_USER=your-email@gmail.com
# GMAIL_APP_PASSWORD=your-app-password
# OR
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-password
# OR
# SENDGRID_API_KEY=your-sendgrid-api-key

# Optional: Email Settings
# EMAIL_FROM=noreply@scrapegoat.com
# EMAIL_FROM_NAME=ScrapeGoat
EOF
    echo "✅ Created .env file with default configuration"
else
    echo "✅ .env file already exists"
fi

# Create storage directories
echo "📁 Creating storage directories..."
mkdir -p backend/storage/jobs
mkdir -p backend/data

# Ask if user wants production setup with Caddy
echo ""
read -p "🌐 Do you want to set up production with Caddy (automatic HTTPS)? [y/N]: " SETUP_CADDY
SETUP_CADDY=${SETUP_CADDY:-N}

if [[ "$SETUP_CADDY" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Setting up production with Caddy..."
    
    # Check if running as root (needed for some operations)
    if [ "$EUID" -ne 0 ]; then 
        echo "⚠️  Some operations require sudo. You may be prompted for your password."
    fi
    
    # Build frontend for production
    echo "🏗️  Building frontend for production..."
    cd frontend
    npm run build
    cd ..
    
    # Prompt for domain name
    echo ""
    read -p "🌐 Enter your domain name (e.g., scrapegoat.example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        echo "❌ Domain name is required"
        exit 1
    fi
    
    # Create Caddyfile from template
    echo "📝 Creating Caddyfile..."
    if [ -f Caddyfile.template ]; then
        sed "s/YOUR_DOMAIN/$DOMAIN/g" Caddyfile.template > Caddyfile
    else
        # Create Caddyfile if template doesn't exist
        cat > Caddyfile << EOF
# ScrapeGoat Caddy Configuration
$DOMAIN {
    # Enable automatic HTTPS
    encode zstd gzip
    
    # Reverse proxy API requests to backend
    handle /api/* {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
            header_up X-Forwarded-For {remote}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    
    # Serve static frontend files
    handle {
        root * /var/www/scrapegoat/frontend/dist
        try_files {path} /index.html
        file_server
    }
}
EOF
    fi
    
    # Create web root directory
    echo "📁 Creating web root directory..."
    sudo mkdir -p /var/www/scrapegoat/frontend
    sudo cp -r frontend/dist/* /var/www/scrapegoat/frontend/
    sudo chown -R www-data:www-data /var/www/scrapegoat 2>/dev/null || sudo chown -R $(whoami):$(whoami) /var/www/scrapegoat
    
    # Update .env for production
    echo "📝 Updating .env for production..."
    if grep -q "NODE_ENV=development" .env; then
        sed -i.bak 's/NODE_ENV=development/NODE_ENV=production/' .env
        sed -i.bak 's/HOST=0.0.0.0/HOST=127.0.0.1/' .env
        rm .env.bak 2>/dev/null || true
    fi
    
    # Detect OS and install Caddy
    OS="$(uname -s)"
    case "${OS}" in
        Linux*)
            echo "🐧 Detected Linux, installing Caddy..."
            
            # Check if Caddy is already installed
            if command -v caddy &> /dev/null; then
                echo "✅ Caddy is already installed"
            else
                echo "📦 Installing Caddy..."
                sudo apt-get update
                sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
                curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
                curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
                sudo apt-get update
                sudo apt-get install -y caddy
            fi
            
            # Create systemd service for backend
            echo "⚙️  Creating systemd service for backend..."
            sudo tee /etc/systemd/system/scrapegoat.service > /dev/null <<EOF
[Unit]
Description=ScrapeGoat Backend Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="HOST=127.0.0.1"
ExecStart=$(which node) $(pwd)/backend/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

            # Reload systemd and enable service
            sudo systemctl daemon-reload
            sudo systemctl enable scrapegoat.service
            
            # Copy Caddyfile to Caddy directory
            echo "📝 Installing Caddyfile..."
            sudo cp Caddyfile /etc/caddy/Caddyfile
            
            # Start services
            echo "🚀 Starting services..."
            sudo systemctl start scrapegoat.service
            sudo systemctl reload caddy
            
            echo ""
            echo "✅ Production setup complete!"
            echo ""
            echo "📍 Your application is available at:"
            echo "   https://$DOMAIN"
            echo ""
            echo "🔧 Useful commands:"
            echo "   View Caddy logs:    sudo journalctl -u caddy -f"
            echo "   View backend logs:  sudo journalctl -u scrapegoat -f"
            echo "   Restart backend:    sudo systemctl restart scrapegoat"
            echo "   Reload Caddy:       sudo systemctl reload caddy"
            echo ""
            ;;
            
        Darwin*)
            echo "🍎 Detected macOS, installing Caddy..."
            
            # Check if Homebrew is installed
            if ! command -v brew &> /dev/null; then
                echo "❌ Homebrew is required. Install it from https://brew.sh"
                exit 1
            fi
            
            # Install Caddy
            if command -v caddy &> /dev/null; then
                echo "✅ Caddy is already installed"
            else
                echo "📦 Installing Caddy via Homebrew..."
                brew install caddy
            fi
            
            # Create launchd service for backend
            echo "📝 Creating launchd service for backend..."
            cat > ~/Library/LaunchAgents/com.scrapegoat.backend.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.scrapegoat.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$(pwd)/backend/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$(pwd)</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
        <key>HOST</key>
        <string>127.0.0.1</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
            
            # Start backend service
            echo "🚀 Starting backend service..."
            launchctl load ~/Library/LaunchAgents/com.scrapegoat.backend.plist 2>/dev/null || launchctl unload ~/Library/LaunchAgents/com.scrapegoat.backend.plist && launchctl load ~/Library/LaunchAgents/com.scrapegoat.backend.plist
            
            # Start Caddy
            echo "🚀 Starting Caddy..."
            sudo caddy start --config $(pwd)/Caddyfile
            
            echo ""
            echo "✅ Production setup complete!"
            echo ""
            echo "📍 Your application is available at:"
            echo "   https://$DOMAIN"
            echo ""
            echo "🔧 Useful commands:"
            echo "   View Caddy logs:    sudo caddy log"
            echo "   Restart backend:    launchctl unload/load ~/Library/LaunchAgents/com.scrapegoat.backend.plist"
            echo "   Reload Caddy:       sudo caddy reload"
            echo ""
            ;;
            
        *)
            echo "❌ Unsupported operating system: $OS"
            echo "   Please install Caddy manually and configure the Caddyfile"
            exit 1
            ;;
    esac
else
    echo ""
    echo "✅ Development setup complete!"
    echo ""
    read -p "🔧 Do you want to set up PM2 for persistent service management? [y/N]: " SETUP_PM2
    if [[ "$SETUP_PM2" =~ ^[Yy]$ ]]; then
        echo ""
        echo "🚀 Setting up PM2..."
        bash setup-pm2.sh
    else
        echo ""
        echo "To start the development server, run:"
        echo "  npm run dev"
        echo ""
        echo "The application will be available at:"
        echo "  Frontend: http://localhost:5173"
        echo "  Backend:  http://localhost:3000"
        echo ""
        echo "To set up PM2 later, run:"
        echo "  bash setup-pm2.sh"
        echo ""
    fi
fi
