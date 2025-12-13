# Email Setup Guide

To enable email notifications, you need to configure email settings in your `.env` file.

## Quick Setup (Gmail - Recommended)

1. **Enable 2-Step Verification** on your Google Account
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate an App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "ScrapeGoat" as the name
   - Click "Generate"
   - Copy the 16-character password

3. **Add to `.env` file** (create it in the root directory if it doesn't exist):
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcd-efgh-ijkl-mnop
```

4. **Restart the server** - The email service will now use Gmail!

## Other Email Options

### SMTP Server (Any email provider)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
```

### SendGrid

1. Sign up at https://sendgrid.com (free tier available)
2. Create an API key
3. Add to `.env`:
```env
SENDGRID_API_KEY=SG.your-api-key-here
```

## Testing

1. Start a scraping job with your email address
2. Wait for the job to complete
3. Check your inbox!

## Troubleshooting

- **No email received?** Check the server console for error messages
- **Gmail not working?** Make sure you're using an App Password, not your regular password
- **Test mode?** If no configuration is found, the app uses a test account. Check console for preview URLs.



