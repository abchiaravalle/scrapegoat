const axios = require('axios');
const cheerio = require('cheerio');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } = require('docx');
const path = require('path');
const fs = require('fs');

class WordGenerator {
  constructor(jobId, includeImages = false, contentSelector = null) {
    this.jobId = jobId;
    this.includeImages = includeImages;
    this.contentSelector = contentSelector;
    this.documentsDir = path.join(__dirname, '../storage/jobs', jobId, 'documents');
    
    // Ensure directory exists
    if (!fs.existsSync(this.documentsDir)) {
      fs.mkdirSync(this.documentsDir, { recursive: true });
    }
  }

  getFolderPathFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/\./g, '_');
      const pathname = urlObj.pathname || '/';
      
      // Remove leading slash and split path
      const pathParts = pathname.split('/').filter(p => p && p !== 'index.html' && p !== 'index.htm');
      
      // Create folder structure: hostname/path/to/page
      const folderParts = [hostname, ...pathParts];
      return folderParts.join('/');
    } catch (e) {
      return 'unknown';
    }
  }

  async generateDocument(pageUrl, pageTitle) {
    try {
      const response = await axios.get(pageUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, footer, header, aside').remove();

      // Use content selector if provided, otherwise use body
      let mainContent;
      if (this.contentSelector) {
        mainContent = $(this.contentSelector).first();
        // If selector doesn't match, fall back to body
        if (mainContent.length === 0) {
          console.warn(`Content selector "${this.contentSelector}" not found on ${pageUrl}, using body`);
          mainContent = $('body').first();
        }
      } else {
        mainContent = $('body').first();
      }

      // Get folder structure from URL
      const urlFolderPath = this.getFolderPathFromUrl(pageUrl);
      const documentFolder = path.join(this.documentsDir, urlFolderPath);
      const imagesFolder = path.join(documentFolder, 'images');
      
      // Ensure directories exist
      if (!fs.existsSync(documentFolder)) {
        fs.mkdirSync(documentFolder, { recursive: true });
      }
      if (this.includeImages && !fs.existsSync(imagesFolder)) {
        fs.mkdirSync(imagesFolder, { recursive: true });
      }

      const children = [];

      // Add page title as H1
      children.push(
        new Paragraph({
          text: pageTitle || pageUrl,
          heading: HeadingLevel.HEADING_1,
        })
      );

      // Add URL as clickable link
      children.push(
        new Paragraph({
          children: [
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: pageUrl,
                  style: 'Hyperlink',
                }),
              ],
              link: pageUrl,
            }),
          ],
        })
      );

      // Add spacing
      children.push(new Paragraph({ text: '' }));

      // Download images if enabled (only from selected content area)
      let imageMap = {};
      if (this.includeImages) {
        imageMap = await this.downloadImages($, mainContent, pageUrl, imagesFolder);
      }

      // Process content (mainContent already set above)
      this.processElement($, mainContent, children, pageUrl, imageMap);

      const doc = new Document({
        sections: [
          {
            children: children,
          },
        ],
      });

      // Generate slug-based filename from URL
      const slug = this.urlToSlug(pageUrl);
      const docxPath = path.join(documentFolder, `${slug}.docx`);

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(docxPath, buffer);

      return docxPath;
    } catch (error) {
      console.error(`Error generating document for ${pageUrl}:`, error);
      throw error;
    }
  }

  async downloadImages($, contentElement, baseUrl, imagesFolder) {
    const imageMap = {};
    const imagePromises = [];

    // Only download images from the selected content area
    contentElement.find('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (!src) return;

      try {
        const imageUrl = new URL(src, baseUrl).href;
        const imageExt = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const imageFilename = `image_${i}${imageExt}`;
        const imagePath = path.join(imagesFolder, imageFilename);

        // Download image
        const promise = axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }).then(response => {
          fs.writeFileSync(imagePath, response.data);
          imageMap[src] = imageFilename;
        }).catch(err => {
          console.error(`Failed to download image ${imageUrl}:`, err.message);
        });

        imagePromises.push(promise);
      } catch (e) {
        // Invalid URL, skip
      }
    });

    await Promise.all(imagePromises);
    return imageMap;
  }

  processElement($, element, children, baseUrl = '', imageMap = {}) {
    const $element = $(element);

    // Process child nodes
    $element.contents().each((i, node) => {
      if (node.type === 'text') {
        const text = $(node).text().trim();
        // Only add non-empty text nodes
        if (text && text.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                }),
              ],
            })
          );
        }
      } else if (node.type === 'tag') {
        const tagName = node.name.toLowerCase();

        if (tagName === 'h1') {
          children.push(
            new Paragraph({
              text: $(node).text().trim(),
              heading: HeadingLevel.HEADING_1,
            })
          );
        } else if (tagName === 'h2') {
          children.push(
            new Paragraph({
              text: $(node).text().trim(),
              heading: HeadingLevel.HEADING_2,
            })
          );
        } else if (tagName === 'h3') {
          children.push(
            new Paragraph({
              text: $(node).text().trim(),
              heading: HeadingLevel.HEADING_3,
            })
          );
        } else if (tagName === 'h4') {
          children.push(
            new Paragraph({
              text: $(node).text().trim(),
              heading: HeadingLevel.HEADING_4,
            })
          );
        } else if (tagName === 'h5') {
          children.push(
            new Paragraph({
              text: $(node).text().trim(),
              heading: HeadingLevel.HEADING_5,
            })
          );
        } else if (tagName === 'h6') {
          children.push(
            new Paragraph({
              text: $(node).text().trim(),
              heading: HeadingLevel.HEADING_6,
            })
          );
        } else if (tagName === 'p') {
          const paragraphChildren = [];
          this.processInlineContent($, $(node), paragraphChildren, baseUrl);
          if (paragraphChildren.length > 0) {
            children.push(new Paragraph({ children: paragraphChildren }));
          }
        } else if (tagName === 'img' && this.includeImages) {
          // Add reference to image in folder (not embedded)
          const src = $(node).attr('src');
          const alt = $(node).attr('alt') || 'Image';
          if (src && imageMap[src]) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[Image: ${alt} - saved as images/${imageMap[src]}]`,
                    italics: true,
                  }),
                ],
              })
            );
          }
        } else if (tagName === 'a') {
          const href = $(node).attr('href');
          const text = $(node).text().trim();
          if (text && href) {
            try {
              const absoluteUrl = new URL(href, baseUrl || 'http://example.com').href;
              children.push(
                new Paragraph({
                  children: [
                    new ExternalHyperlink({
                      children: [
                        new TextRun({
                          text: text,
                          style: 'Hyperlink',
                        }),
                      ],
                      link: absoluteUrl,
                    }),
                  ],
                })
              );
            } catch (e) {
              // Invalid URL, just add text
              if (text) {
                children.push(
                  new Paragraph({
                    children: [new TextRun({ text: text })],
                  })
                );
              }
            }
          }
        } else if (tagName === 'br') {
          children.push(new Paragraph({ text: '' }));
        } else if (['div', 'section', 'article', 'main', 'li', 'ul', 'ol'].includes(tagName)) {
          // Recursively process block elements
          this.processElement($, $(node), children, baseUrl, imageMap);
        }
      }
    });
  }

  processInlineContent($, element, children, baseUrl = '') {
    element.contents().each((i, node) => {
      if (node.type === 'text') {
        const text = $(node).text().trim();
        if (text) {
          children.push(new TextRun({ text: text }));
        }
      } else if (node.type === 'tag') {
        const tagName = node.name.toLowerCase();
        if (tagName === 'a') {
          const href = $(node).attr('href');
          const text = $(node).text().trim();
          if (text && href) {
            try {
              const absoluteUrl = new URL(href, baseUrl || 'http://example.com').href;
              children.push(
                new ExternalHyperlink({
                  children: [
                    new TextRun({
                      text: text,
                      style: 'Hyperlink',
                    }),
                  ],
                  link: absoluteUrl,
                })
              );
            } catch (e) {
              children.push(new TextRun({ text: text }));
            }
          }
        } else if (tagName === 'strong' || tagName === 'b') {
          const text = $(node).text().trim();
          if (text) {
            children.push(new TextRun({ text: text, bold: true }));
          }
        } else if (tagName === 'em' || tagName === 'i') {
          const text = $(node).text().trim();
          if (text) {
            children.push(new TextRun({ text: text, italics: true }));
          }
        } else {
          // Recursively process other inline elements
          this.processInlineContent($, $(node), children, baseUrl);
        }
      }
    });
  }

  urlToSlug(url) {
    try {
      const urlObj = new URL(url);
      let slug = '';
      
      // Get pathname and remove leading/trailing slashes
      let pathname = urlObj.pathname || '/';
      pathname = pathname.replace(/^\/+|\/+$/g, '');
      
      if (pathname === '') {
        // Root path - use hostname as slug
        slug = urlObj.hostname.replace(/\./g, '-');
      } else {
        // Create slug from pathname
        // Remove file extensions
        pathname = pathname.replace(/\.(html|htm|php|asp|aspx|jsp|jspx)$/i, '');
        
        // Split by slashes and join with hyphens
        const parts = pathname.split('/').filter(p => p);
        slug = parts.join('-');
      }
      
      // Convert to lowercase and replace special characters with hyphens
      slug = slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Ensure it's not empty and limit length
      if (!slug || slug === '') {
        slug = 'index';
      }
      
      // Limit to 100 characters
      if (slug.length > 100) {
        slug = slug.substring(0, 100);
        // Remove trailing hyphen if truncated
        slug = slug.replace(/-$/, '');
      }
      
      return slug;
    } catch (e) {
      // Fallback if URL parsing fails
      return 'page';
    }
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 100)
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'page';
  }
}

module.exports = WordGenerator;
