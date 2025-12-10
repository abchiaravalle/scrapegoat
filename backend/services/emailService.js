const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Create transporter based on environment variables
    // Supports Gmail, SendGrid, SMTP, and other services
    this.transporter = null;
    this.useTestAccount = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Check for SMTP configuration
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    // Check for Gmail OAuth2
    else if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        },
      });
    }
    // Check for Gmail App Password
    else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
    }
    // Check for SendGrid
    else if (process.env.SENDGRID_API_KEY) {
      this.transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });
    }
    // Default: Use test account (for development)
    else {
      console.warn('⚠️  No email configuration found. Using test account. Emails will not be sent.');
      console.warn('📧 Please configure email settings in .env file. See README.md for details.');
      // Create a test account (doesn't actually send emails)
      this.transporter = null; // Will be created on first use
      this.useTestAccount = true;
    }
  }

  async sendEmail(to, subject, text, html = null) {
    try {
      let transporter = this.transporter;

      // If using test account, create it now
      if (this.useTestAccount && !transporter) {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.transporter = transporter;
      }

      if (!transporter) {
        throw new Error('Email transporter not configured');
      }

      const fromEmail = process.env.EMAIL_FROM || 'noreply@scrapegoat.com';
      const fromName = process.env.EMAIL_FROM_NAME || 'ScrapeGoat';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: to,
        subject: subject,
        text: text,
        html: html || text.replace(/\n/g, '<br>'),
      };

      const info = await transporter.sendMail(mailOptions);

      // If using test account, log the preview URL
      if (this.useTestAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log('📧 Test email sent. Preview URL:', previewUrl);
        console.log('   (This is a test account - email was not actually sent)');
      }

      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendJobCompletionEmail(jobId, email, shareLink) {
    const subject = `Your scraping job is complete - Job ID: ${jobId}`;
    const text = `Your web scraping job has been completed!

Job ID: ${jobId}
You can view and download your documents at:
${shareLink}

Thank you for using ScrapeGoat!`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Your Scraping Job is Complete!</h2>
        <p>Your web scraping job has been completed successfully.</p>
        <p><strong>Job ID:</strong> ${jobId}</p>
        <p>You can view and download your documents at:</p>
        <p><a href="${shareLink}" style="color: #1976d2; text-decoration: none;">${shareLink}</a></p>
        <p>Thank you for using ScrapeGoat!</p>
      </div>
    `;

    return await this.sendEmail(email, subject, text, html);
  }
}

module.exports = new EmailService();

