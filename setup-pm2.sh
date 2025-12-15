#!/bin/bash

# ScrapeGoat PM2 Setup Script
# This script sets up PM2 for persistent service management

set -e  # Exit on error

echo "🚀 Setting up ScrapeGoat with PM2..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
else
    echo "✅ PM2 is already installed"
fi

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Build frontend for production
echo "🏗️  Building frontend for production..."
cd frontend
npm run build
cd ..

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

# Stop existing PM2 processes if any
echo "🛑 Stopping existing PM2 processes..."
pm2 delete scrapegoat-backend 2>/dev/null || true
pm2 delete scrapegoat-frontend 2>/dev/null || true

# Start applications with PM2
echo "🚀 Starting applications with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on system boot
echo "⚙️  Setting up PM2 startup script..."
STARTUP_CMD=$(pm2 startup | grep -o 'sudo.*' || echo "")
if [ ! -z "$STARTUP_CMD" ]; then
    echo ""
    echo "⚠️  Run this command to enable PM2 startup on boot:"
    echo "   $STARTUP_CMD"
    echo ""
    read -p "Do you want to run this command now? [y/N]: " RUN_STARTUP
    if [[ "$RUN_STARTUP" =~ ^[Yy]$ ]]; then
        eval $STARTUP_CMD
        echo "✅ PM2 startup script installed"
    fi
else
    echo "✅ PM2 startup already configured"
fi

echo ""
echo "✅ PM2 setup complete!"
echo ""
echo "📍 Your application is running with PM2"
echo ""
echo "🔧 Useful PM2 commands:"
echo "   View status:      npm run pm2:status"
echo "   View logs:        npm run pm2:logs"
echo "   Restart all:      npm run pm2:restart"
echo "   Stop all:         npm run pm2:stop"
echo "   Delete all:       npm run pm2:delete"
echo ""
echo "   Or use PM2 directly:"
echo "   pm2 status"
echo "   pm2 logs"
echo "   pm2 restart all"
echo "   pm2 stop all"
echo ""

