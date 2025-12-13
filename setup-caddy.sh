#!/bin/bash

# ScrapeGoat Caddy Setup Script
# This script sets up Caddy web server with automatic HTTPS

set -e  # Exit on error

echo "🚀 Setting up ScrapeGoat with Caddy web server..."

# Check if running as root (needed for some operations)
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Some operations require sudo. You may be prompted for your password."
fi

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
        echo "✅ Setup complete!"
        echo ""
        echo "Services status:"
        sudo systemctl status scrapegoat.service --no-pager -l
        sudo systemctl status caddy --no-pager -l
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
        
        # Create launchd service for backend (optional, can run manually)
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
        echo "✅ Setup complete!"
        echo ""
        echo "To manage services:"
        echo "  Backend: launchctl list | grep scrapegoat"
        echo "  Caddy:   sudo caddy stop/start/reload"
        ;;
        
    *)
        echo "❌ Unsupported operating system: $OS"
        echo "   Please install Caddy manually and configure the Caddyfile"
        exit 1
        ;;
esac

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Server Configuration
PORT=3000
HOST=127.0.0.1
NODE_ENV=production

# Optional: Email Configuration
# GMAIL_USER=your-email@gmail.com
# GMAIL_APP_PASSWORD=your-app-password
EOF
    echo "✅ Created .env file"
fi

echo ""
echo "🎉 ScrapeGoat is now running!"
echo ""
echo "📍 Your application is available at:"
echo "   https://$DOMAIN"
echo ""
echo "📋 Important notes:"
echo "   - Make sure your domain DNS points to this server's IP"
echo "   - Caddy will automatically obtain SSL certificates from Let's Encrypt"
echo "   - The backend runs on localhost:3000 (not exposed publicly)"
echo "   - Frontend files are served from /var/www/scrapegoat/frontend"
echo ""
echo "🔧 Useful commands:"
echo "   View Caddy logs:    sudo journalctl -u caddy -f (Linux) or sudo caddy log (macOS)"
echo "   View backend logs:  sudo journalctl -u scrapegoat -f (Linux) or tail -f ~/Library/Logs/com.scrapegoat.backend.log (macOS)"
echo "   Restart backend:    sudo systemctl restart scrapegoat (Linux) or launchctl unload/load ~/Library/LaunchAgents/com.scrapegoat.backend.plist (macOS)"
echo "   Reload Caddy:      sudo systemctl reload caddy (Linux) or sudo caddy reload (macOS)"
echo ""

