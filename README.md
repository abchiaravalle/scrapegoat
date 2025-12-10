# ScrapeGoat

A web application that crawls websites, extracts content, and generates clean Word documents for each page. Perfect for creating editable document collections from websites.

## Features

- **Web Crawling**: Automatically discovers all pages within the same domain
- **Word Document Generation**: Creates clean, formatted Word documents with:
  - Preserved heading hierarchy (H1-H6)
  - Consistent paragraph formatting
  - Clickable hyperlinks
  - Easy to edit in Microsoft Word
- **Progress Tracking**: Real-time progress updates during crawling and processing
- **Shareable Links**: Unique links for each scraping job
- **Email Notifications**: Optional email alerts when jobs complete
- **Zip Download**: All documents packaged in a single zip file

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: React with Vite
- **Database**: SQLite
- **Email**: Nodemailer (supports Gmail, SMTP, SendGrid, etc.)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd scrapegoat
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd frontend
npm install
cd ..
```

4. Configure email (optional but recommended):
   - Copy `.env.example` to `.env`
   - See "Email Configuration" section below for setup options

## Running the Application

### Development Mode

Run both backend and frontend concurrently:
```bash
npm run dev
```

Or run them separately:

Backend (port 3000):
```bash
npm run dev:backend
```

Frontend (port 5173):
```bash
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

## Usage

1. Open the application in your browser (http://localhost:5173 in dev mode)
2. Enter a URL to scrape
3. Optionally provide an email address for notifications
4. Click "Start Scraping"
5. Monitor progress on the job status page
6. Download the zip file when complete

## Project Structure

```
scrapegoat/
├── backend/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/       # Business logic (crawler, word generator, zip creator)
│   ├── services/       # Email service (nodemailer)
│   └── storage/        # Temporary file storage
├── frontend/
│   └── src/
│       ├── components/  # React components
│       └── App.jsx     # Main app component
└── package.json
```

## API Endpoints

- `POST /api/jobs` - Create a new scraping job
- `GET /api/jobs/:jobId` - Get job status
- `GET /api/jobs/:jobId/download` - Download zip file

## Email Configuration

Email notifications are sent when jobs complete. Configure email in your `.env` file using one of these options:

### Option 1: Gmail with App Password (Easiest for Testing)

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

**Note**: If no email configuration is provided, the app will use a test account (emails won't actually be sent, but you'll see preview URLs in the console).

## Notes

- The crawler respects the same domain restriction
- Documents are stored temporarily and can be cleaned up after a set period
- The application uses SQLite for simplicity, but can be easily migrated to PostgreSQL

## License

ISC

