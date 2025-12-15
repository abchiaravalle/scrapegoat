const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { createJob, getJob, getPagesByJob } = require('../models/database');
const Crawler = require('../services/crawler');
const WordGenerator = require('../services/wordGenerator');
const ZipCreator = require('../services/zipCreator');
const { updateJobStatus, updateJobZipPath, updatePageWordPath, getPagesByJob: getPages, addPage } = require('../models/database');
const { requireAuth } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const emailService = require('../services/emailService');
const router = express.Router();

// Create new job (requires auth)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { url, email, followAllLinks = false, includeImages = false, singlePageOnly = false, contentSelector = null } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const jobId = uuidv4();
    await createJob(jobId, url, email || null, followAllLinks, includeImages, singlePageOnly, contentSelector);

    const shareLink = `/job/${jobId}`;
    const baseUrl = `${req.protocol || 'http'}://${req.get('host') || 'localhost:3000'}`;
    const fullShareLink = `${baseUrl}${shareLink}`;

    // Start processing in background
    processJob(jobId, url, email, fullShareLink, followAllLinks, includeImages, singlePageOnly, contentSelector).catch(err => {
      console.error(`Error processing job ${jobId}:`, err);
    });

    res.json({ jobId, shareLink });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Get job status (public - shareable links should work without auth)
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const response = {
      status: job.status,
      progress: job.progress,
      totalPages: job.total_pages,
      processedPages: job.processed_pages,
    };

    if (job.status === 'completed' && job.zip_file_path) {
      response.zipUrl = `/api/jobs/${jobId}/download`;
    }

    res.json(response);
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Download zip file
router.get('/:jobId/download', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed' || !job.zip_file_path) {
      return res.status(404).json({ error: 'Zip file not ready' });
    }

    if (!fs.existsSync(job.zip_file_path)) {
      return res.status(404).json({ error: 'Zip file not found' });
    }

    res.download(job.zip_file_path, 'scraped-documents.zip', (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Error downloading zip:', error);
    res.status(500).json({ error: 'Failed to download zip file' });
  }
});

// Background job processing
async function processJob(jobId, url, email, shareLink, followAllLinks = false, includeImages = false, singlePageOnly = false, contentSelector = null) {
  try {
    // Step 1: Crawl or add single page
    if (singlePageOnly) {
      // Just add the single URL without crawling
      await updateJobStatus(jobId, 'crawling', 0, 1, 0);
      const axios = require('axios');
      const cheerio = require('cheerio');
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const $ = cheerio.load(response.data);
        const title = $('title').text() || url;
        await addPage(jobId, url, title);
        await updateJobStatus(jobId, 'processing', 50, 1, 0);
      } catch (error) {
        console.error(`Error fetching single page ${url}:`, error);
        await addPage(jobId, url, url);
        await updateJobStatus(jobId, 'processing', 50, 1, 0);
      }
    } else {
      // Normal crawling
      const crawler = new Crawler(jobId, url, followAllLinks);
      const urls = await crawler.crawl();
    }

    // Step 2: Generate Word documents
    const pages = await getPages(jobId);
    
    if (!pages || pages.length === 0) {
      console.error(`No pages found for job ${jobId}`);
      await updateJobStatus(jobId, 'failed', 0);
      return;
    }
    
    console.log(`Starting document generation for ${pages.length} pages...`);
    const wordGenerator = new WordGenerator(jobId, includeImages, contentSelector);
    
    let processedCount = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        console.log(`Generating document [${i + 1}/${pages.length}]: ${page.url}`);
        const wordPath = await wordGenerator.generateDocument(page.url, page.title);
        await updatePageWordPath(page.id, wordPath);
        processedCount++;

        const progress = 50 + Math.floor((processedCount / pages.length) * 40); // 50-90% for document generation
        await updateJobStatus(jobId, 'processing', progress, pages.length, processedCount);
      } catch (error) {
        console.error(`Error generating document for page ${page.id} (${page.url}):`, error.message);
        // Continue with next page
      }
    }
    console.log(`Document generation complete. Processed ${processedCount}/${pages.length} pages.`);

    // Step 3: Create zip file
    const zipCreator = new ZipCreator(jobId);
    const zipPath = await zipCreator.createZip();
    await updateJobZipPath(jobId, zipPath);

    // Step 4: Mark as completed
    await updateJobStatus(jobId, 'completed', 100, pages.length, processedCount);

    // Step 5: Send email if provided
    if (email) {
      try {
        await sendEmailNotification(jobId, email, shareLink);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the job if email fails
      }
    }
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed', 0);
  }
}

async function sendEmailNotification(jobId, email, shareLink) {
  try {
    await emailService.sendJobCompletionEmail(jobId, email, shareLink);
    console.log(`Email sent to ${email} for job ${jobId}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = router;

