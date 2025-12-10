const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const { addPage, pageExists, updateJobStatus } = require('../models/database');

class Crawler {
  constructor(jobId, initialUrl, followAllLinks = false) {
    this.jobId = jobId;
    this.initialUrl = initialUrl;
    this.baseUrl = new URL(initialUrl);
    this.domain = this.baseUrl.hostname;
    this.followAllLinks = followAllLinks;
    this.visitedUrls = new Set();
    this.queue = [initialUrl];
    this.delay = 500; // 500ms delay between requests
  }

  async crawl() {
    try {
      await updateJobStatus(this.jobId, 'crawling', 0);

      while (this.queue.length > 0) {
        const url = this.queue.shift();

        if (this.visitedUrls.has(url)) {
          continue;
        }

        if (!this.followAllLinks && !this.isSameDomain(url)) {
          continue;
        }

        this.visitedUrls.add(url);

        try {
          const { title, links } = await this.fetchPage(url);
          await addPage(this.jobId, url, title);

          // Add new links to queue
          for (const link of links) {
            if (!this.visitedUrls.has(link)) {
              if (this.followAllLinks || this.isSameDomain(link)) {
                this.queue.push(link);
              }
            }
          }

          // Update progress
          const totalPages = this.visitedUrls.size;
          const progress = Math.min(100, Math.floor((totalPages / Math.max(totalPages, 1)) * 50)); // 50% for crawling
          await updateJobStatus(this.jobId, 'crawling', progress, totalPages, 0);

          // Delay between requests
          await this.sleep(this.delay);
        } catch (error) {
          console.error(`Error fetching ${url}:`, error.message);
          // Continue with next URL
        }
      }

      await updateJobStatus(this.jobId, 'processing', 50, this.visitedUrls.size, 0);
      return Array.from(this.visitedUrls);
    } catch (error) {
      console.error('Crawler error:', error);
      await updateJobStatus(this.jobId, 'failed', 0);
      throw error;
    }
  }

  async fetchPage(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const title = $('title').text() || url;

      // Extract all links
      const links = [];
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, url).href;
            links.push(absoluteUrl);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });

      return { title, links };
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  isSameDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === this.domain;
    } catch (e) {
      return false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Crawler;

