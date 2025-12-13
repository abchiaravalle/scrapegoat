# ScrapeGoat

A powerful web scraping application that crawls websites, extracts content, and generates clean, editable Word documents. Perfect for creating document collections from websites with proper formatting, heading hierarchy, and clickable hyperlinks.

## 🚀 Quick Start

### Development (One-Liner)

```bash
git clone https://github.com/abchiaravalle/scrapegoat.git && cd scrapegoat && bash setup.sh && npm run dev
```

This single command will:
- Clone the repository
- Install all dependencies (root and frontend)
- Create necessary configuration files
- Set up storage directories
- Start the development server

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

### Production with Caddy (One-Liner)

For production deployment with automatic HTTPS:

```bash
git clone https://github.com/abchiaravalle/scrapegoat.git && cd scrapegoat && bash setup-caddy.sh
```

See [Deployment](#-deployment) section for details.

## 📋 Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Git** (for cloning)

## 🛠️ Manual Installation

If you prefer to set up manually:

### 1. Clone the Repository

```bash
git clone https://github.com/abchiaravalle/scrapegoat.git
cd scrapegoat
```

### 2. Run Setup Script

```bash
bash setup.sh
```

Or install dependencies manually:

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Configure Environment (Optional)

The setup script creates a `.env` file with default settings. You can customize it:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Optional: Email Configuration
# See "Email Configuration" section below
```

## 🎯 Usage

### Development Mode

Start both backend and frontend concurrently:

```bash
npm run dev
```

Or run them separately:

```bash
# Backend only (port 3000)
npm run dev:backend

# Frontend only (port 5173)
npm run dev:frontend
```

### Production Mode

1. Build the frontend:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

The application will serve the frontend from the backend server.

## ✨ Features

- **🌐 Web Crawling**: Automatically discovers and crawls pages within the same domain
- **📄 Word Document Generation**: Creates clean, formatted Word documents with:
  - Preserved heading hierarchy (H1-H6)
  - Consistent paragraph formatting
  - Clickable hyperlinks
  - Spacing between sections for readability
  - Easy to edit in Microsoft Word
- **📊 Progress Tracking**: Real-time progress updates during crawling and processing
- **🔗 Shareable Links**: Unique links for each scraping job
- **📦 Zip Download**: All documents packaged in a single zip file
- **🎨 Modern UI**: Clean, responsive interface built with React and Material-UI
- **⚙️ Flexible Options**:
  - Single page scraping (no crawling)
  - Cross-domain link following
  - Content selector for targeted scraping
  - Image downloading (saved separately)

## 🏗️ Project Structure

```
scrapegoat/
├── backend/
│   ├── models/          # Database models (SQLite)
│   ├── routes/          # API routes
│   ├── services/       # Business logic
│   │   ├── crawler.js          # Web crawler
│   │   ├── wordGenerator.js    # Word document generator
│   │   ├── zipCreator.js       # ZIP file creator
│   │   └── emailService.js     # Email notifications
│   ├── storage/         # Temporary file storage
│   │   └── jobs/        # Job-specific storage
│   ├── data/            # Database files
│   └── server.js        # Express server
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── UrlForm.jsx      # Job creation form
│   │   │   └── JobStatus.jsx    # Job status display
│   │   ├── App.jsx       # Main app component
│   │   ├── theme.js      # Material-UI theme
│   │   └── index.css     # Global styles
│   ├── package.json
│   └── vite.config.js    # Vite configuration
├── setup.sh              # Setup script
├── package.json
└── README.md
```

## 🔌 API Endpoints

- `POST /api/jobs` - Create a new scraping job
  ```json
  {
    "url": "https://example.com",
    "followAllLinks": false,
    "includeImages": false,
    "singlePageOnly": false,
    "contentSelector": null
  }
  ```

- `GET /api/jobs/:jobId` - Get job status
  ```json
  {
    "status": "processing",
    "progress": 75,
    "totalPages": 100,
    "processedPages": 75,
    "zipUrl": "/api/jobs/:jobId/download" // Only when completed
  }
  ```

- `GET /api/jobs/:jobId/download` - Download zip file

- `GET /health` - Health check endpoint

## 📧 Email Configuration (Optional)

Email notifications are sent when jobs complete. Configure email in your `.env` file using one of these options:

### Option 1: Gmail with App Password (Easiest)

1. Enable 2-Step Verification on your Google Account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Add to `.env`:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

### Option 2: SMTP Server

For any SMTP server (Gmail, Outlook, custom, etc.):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
```

### Option 3: SendGrid

1. Sign up at https://sendgrid.com
2. Create an API key
3. Add to `.env`:
```env
SENDGRID_API_KEY=your-sendgrid-api-key
```

### Optional Email Settings

```env
EMAIL_FROM=noreply@scrapegoat.com
EMAIL_FROM_NAME=ScrapeGoat
```

**Note**: If no email configuration is provided, the app will work without email notifications.

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Backend server port |
| `HOST` | `0.0.0.0` | Server host (use `0.0.0.0` for external access) |
| `NODE_ENV` | `development` | Environment mode |

### Crawler Settings

The crawler has built-in limits to prevent excessive resource usage:
- **Max URLs**: 1000 pages per job
- **Max Crawl Time**: 30 minutes
- **Request Delay**: 500ms between requests
- **Request Timeout**: 10 seconds per page

These can be adjusted in `backend/services/crawler.js`.

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 or 5173 is already in use:

```bash
# Change backend port in .env
PORT=3001

# Change frontend port in frontend/vite.config.js
# Update the port value in the server configuration
```

### Database Issues

If you encounter database errors, you can reset the database:

```bash
rm backend/data/scrapegoat.db
# The database will be recreated on next server start
```

### Installation Issues

If you encounter installation errors:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules frontend/node_modules
npm install
cd frontend && npm install && cd ..
```

## 📝 Development

### Adding New Features

1. Backend changes: Edit files in `backend/`
2. Frontend changes: Edit files in `frontend/src/`
3. The dev server will auto-reload on changes

### Database Schema

The application uses SQLite with the following tables:
- `jobs` - Job metadata and status
- `pages` - Individual pages discovered during crawling

See `backend/models/database.js` for schema details.

## 🚢 Deployment

### Production with Caddy (Recommended - One Command Setup)

Caddy provides automatic HTTPS, reverse proxy, and production-ready web server setup.

#### One-Liner Production Setup

```bash
git clone https://github.com/abchiaravalle/scrapegoat.git && cd scrapegoat && bash setup-caddy.sh
```

This will:
- Install all dependencies
- Build the frontend for production
- Install and configure Caddy web server
- Set up automatic HTTPS (Let's Encrypt)
- Configure reverse proxy
- Create system services for automatic startup
- Prompt you for your domain name

**Prerequisites:**
- Domain name pointing to your server's IP
- Ports 80 and 443 open in firewall
- sudo/root access

**After running the script:**
- Your app will be available at `https://your-domain.com`
- Backend runs on `localhost:3000` (not publicly exposed)
- Frontend is served via Caddy with automatic HTTPS
- Services auto-start on server reboot

#### Manual Caddy Setup

1. Install dependencies and build:
```bash
bash setup.sh
npm run build
```

2. Run Caddy setup:
```bash
bash setup-caddy.sh
```

3. Enter your domain when prompted

#### Caddy Management Commands

**Linux:**
```bash
# View Caddy status
sudo systemctl status caddy

# View Caddy logs
sudo journalctl -u caddy -f

# Reload Caddy configuration
sudo systemctl reload caddy

# Restart backend
sudo systemctl restart scrapegoat
```

**macOS:**
```bash
# Start/Stop Caddy
sudo caddy start --config /path/to/Caddyfile
sudo caddy stop

# Reload Caddy
sudo caddy reload

# View logs
sudo caddy log
```

### Production Build (Without Caddy)

1. Build the frontend:
```bash
npm run build
```

2. Set environment variables:
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

3. Start the server:
```bash
npm start
```

The application will serve the frontend from the backend server.

### Docker (Future)

Docker support is planned for future releases.

## 📄 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Made with ❤️ for easy web scraping and document generation**
