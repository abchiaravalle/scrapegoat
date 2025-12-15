const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
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
    let browser = null;
    try {
      console.log(`Loading page with Puppeteer: ${pageUrl}`);
      
      // Launch Puppeteer browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate to page and wait for content
      await page.goto(pageUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait a bit for any dynamic content
      await page.waitForTimeout(2000);
      
      // Get the actual page title if not provided
      if (!pageTitle) {
        pageTitle = await page.title();
      }
      
      // Extract all content using Puppeteer
      const contentData = await page.evaluate((contentSelector) => {
        const results = {
          headings: [],
          paragraphs: [],
          listItems: [],
          allText: ''
        };
        
        // Get the main content area
        let rootElement;
        if (contentSelector) {
          rootElement = document.querySelector(contentSelector);
        }
        if (!rootElement) {
          rootElement = document.body;
        }
        
        // Remove unwanted elements
        const unwanted = rootElement.querySelectorAll('script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar');
        unwanted.forEach(el => el.remove());
        
        // Extract all headings
        const headings = rootElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(heading => {
          const text = heading.innerText.trim();
          if (text && text.length > 0) {
            results.headings.push({
              level: parseInt(heading.tagName.charAt(1)),
              text: text
            });
          }
        });
        
        // Extract all paragraphs
        const paragraphs = rootElement.querySelectorAll('p');
        paragraphs.forEach(p => {
          const text = p.innerText.trim();
          if (text && text.length > 0) {
            results.paragraphs.push(text);
          }
        });
        
        // Extract all list items
        const listItems = rootElement.querySelectorAll('li');
        listItems.forEach(li => {
          const text = li.innerText.trim();
          if (text && text.length > 0) {
            results.listItems.push(text);
          }
        });
        
        // Get all text as fallback
        results.allText = rootElement.innerText.trim();
        
        return results;
      }, this.contentSelector);
      
      console.log(`Puppeteer extracted: ${contentData.headings.length} headings, ${contentData.paragraphs.length} paragraphs, ${contentData.listItems.length} list items`);
      console.log(`Total text length: ${contentData.allText.length} characters`);
      
      await browser.close();
      browser = null;

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

      // Process content extracted by Puppeteer
      const headingLevels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6
      ];
      
      // Add all headings
      contentData.headings.forEach(heading => {
        const headingLevel = headingLevels[heading.level - 1] || HeadingLevel.HEADING_1;
        const isSemiboldPhrase = this.isSemiboldPhrase(heading.text);
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: heading.text,
                bold: isSemiboldPhrase,
              }),
            ],
            heading: headingLevel,
          })
        );
      });
      
      // Add all paragraphs
      contentData.paragraphs.forEach(text => {
        if (text && text.length > 0) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: text })],
            })
          );
        }
      });
      
      // Add all list items
      contentData.listItems.forEach(text => {
        if (text && text.length > 0) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `• ${text}` })],
            })
          );
        }
      });
      
      // If we still have very little content, use the allText as fallback
      const contentCount = contentData.headings.length + contentData.paragraphs.length + contentData.listItems.length;
      if (contentCount < 5 && contentData.allText.length > 100) {
        console.log(`Low content count (${contentCount}), using allText fallback`);
        // Split all text by newlines and create paragraphs
        const textBlocks = contentData.allText
          .split(/\n+/)
          .map(block => block.trim())
          .filter(block => block.length > 10);
        
        // Remove duplicates (text that's already in headings/paragraphs)
        const existingTexts = new Set();
        contentData.headings.forEach(h => existingTexts.add(h.text.toLowerCase()));
        contentData.paragraphs.forEach(p => existingTexts.add(p.toLowerCase()));
        
        textBlocks.forEach(block => {
          if (!existingTexts.has(block.toLowerCase()) && block.length > 10) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: block })],
              })
            );
          }
        });
      }
      
      console.log(`Total content elements added: ${children.length - 3}`); // Subtract title, URL, spacing

      // Post-process children to optimize layout
      const optimizedChildren = this.optimizeLayout(children);
      
      const doc = new Document({
        sections: [
          {
            children: optimizedChildren,
            properties: {
              page: {
                margin: {
                  top: 1440,    // 1 inch
                  right: 1440,  // 1 inch
                  bottom: 1440, // 1 inch
                  left: 1440,   // 1 inch
                },
              },
            },
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
    } finally {
      // Make sure browser is closed
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
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

  processElement($, element, children, baseUrl = '', imageMap = {}, isTopLevel = false) {
    const $element = $(element);
    let isFirstTopLevelDivOrSection = true; // Track if this is the first top-level div/section

    // If element is empty or has no children, try to get its text directly
    if ($element.length === 0) {
      return;
    }

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
          const headingText = $(node).text().trim();
          const isSemiboldPhrase = this.isSemiboldPhrase(headingText);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: isSemiboldPhrase,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
            })
          );
        } else if (tagName === 'h2') {
          const headingText = $(node).text().trim();
          const isSemiboldPhrase = this.isSemiboldPhrase(headingText);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: isSemiboldPhrase,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
            })
          );
        } else if (tagName === 'h3') {
          const headingText = $(node).text().trim();
          const isSemiboldPhrase = this.isSemiboldPhrase(headingText);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: isSemiboldPhrase,
                }),
              ],
              heading: HeadingLevel.HEADING_3,
            })
          );
        } else if (tagName === 'h4') {
          const headingText = $(node).text().trim();
          const isSemiboldPhrase = this.isSemiboldPhrase(headingText);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: isSemiboldPhrase,
                }),
              ],
              heading: HeadingLevel.HEADING_4,
            })
          );
        } else if (tagName === 'h5') {
          const headingText = $(node).text().trim();
          const isSemiboldPhrase = this.isSemiboldPhrase(headingText);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: isSemiboldPhrase,
                }),
              ],
              heading: HeadingLevel.HEADING_5,
            })
          );
        } else if (tagName === 'h6') {
          const headingText = $(node).text().trim();
          const isSemiboldPhrase = this.isSemiboldPhrase(headingText);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: isSemiboldPhrase,
                }),
              ],
              heading: HeadingLevel.HEADING_6,
            })
          );
        } else if (tagName === 'p') {
          const paragraphChildren = [];
          this.processInlineContent($, $(node), paragraphChildren, baseUrl);
          // If no inline content was found, get the text directly
          if (paragraphChildren.length === 0) {
            const text = $(node).text().trim();
            if (text) {
              paragraphChildren.push(new TextRun({ text: text }));
            }
          }
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
          const isOutermostDivOrSection = isTopLevel && (tagName === 'div' || tagName === 'section');
          const $node = $(node);
          
          // Check if this element has any content at all
          const elementText = $node.text().trim();
          const hasDirectText = elementText.length > 0;
          const hasNestedElements = $node.children().length > 0;
          
          // If element has no content and no nested elements, skip it
          if (!hasDirectText && !hasNestedElements) {
            return;
          }
          
          // Detect column-like structures (left/right columns, multi-column layouts)
          const classNames = ($node.attr('class') || '').toLowerCase();
          const id = ($node.attr('id') || '').toLowerCase();
          const isColumn = /col|column|left|right|sidebar/.test(classNames + ' ' + id);
          const isFullWidth = /full|wide|container|wrapper|main-content/.test(classNames + ' ' + id);
          
          // Detect if this is likely a page/section break point
          const hasLargeHeading = $node.find('h1, h2, h3').length > 0;
          const hasSubstantialContent = elementText.length > 500;
          
          // Add spacing before outermost divs/sections (except the first one)
          if (isOutermostDivOrSection && !isFirstTopLevelDivOrSection) {
            // Add spacing paragraph before this div/section
            children.push(new Paragraph({ text: '' }));
          }
          
          // If this is a column and we have substantial content, add a page break before it
          // to help with layout (but only if it's not the first element)
          if (isColumn && hasSubstantialContent && !isFirstTopLevelDivOrSection && children.length > 10) {
            // Add a page break to start new page for better column layout
            children.push(
              new Paragraph({
                text: '',
                pageBreakBefore: true,
              })
            );
          }
          
          // Process the element
          const beforeLength = children.length;
          this.processElement($, $node, children, baseUrl, imageMap, false);
          const afterLength = children.length;
          const addedContent = afterLength - beforeLength;
          
          // If no content was added but element has text, add it directly
          if (addedContent === 0 && hasDirectText && !hasNestedElements) {
            // This is a leaf node with text, add it
            children.push(
              new Paragraph({
                children: [new TextRun({ text: elementText })],
              })
            );
          }
          
          // If this is a full-width section with substantial content, add spacing after
          if (isFullWidth && addedContent > 5) {
            children.push(new Paragraph({ text: '' }));
            children.push(new Paragraph({ text: '' }));
          }
          
          // If this was a column with content, add spacing after to separate from next column
          if (isColumn && addedContent > 0) {
            children.push(new Paragraph({ text: '' }));
          }
          
          // Mark that we've seen at least one top-level div/section
          if (isOutermostDivOrSection) {
            isFirstTopLevelDivOrSection = false;
          }
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

  // Optimize layout by adding page breaks and adjusting spacing
  optimizeLayout(children) {
    const optimized = [];
    let consecutiveEmpty = 0;
    let paragraphCount = 0;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      // Check if paragraph has content
      const hasContent = (child.text && child.text.trim() !== '') || 
                        (child.children && child.children.length > 0 && 
                         child.children.some(c => c.text && c.text.trim() !== ''));
      
      // Count non-empty paragraphs
      if (hasContent) {
        paragraphCount++;
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;
      }
      
      // Add page break after substantial content (every ~25-30 paragraphs)
      // This helps prevent too much blank space at bottom of pages
      if (hasContent && paragraphCount > 0 && paragraphCount % 28 === 0 && i < children.length - 5) {
        // Check if next few items are substantial
        const nextItems = children.slice(i + 1, Math.min(i + 6, children.length));
        const hasSubstantialNext = nextItems.some(item => {
          const itemHasContent = (item.text && item.text.trim().length > 50) || 
                                (item.children && item.children.length > 0);
          return itemHasContent;
        });
        
        if (hasSubstantialNext) {
          optimized.push(child);
          // Add page break before next substantial content
          optimized.push(
            new Paragraph({
              text: '',
              pageBreakBefore: true,
            })
          );
          continue;
        }
      }
      
      // Limit consecutive empty paragraphs to 2
      if (!hasContent) {
        if (consecutiveEmpty <= 2) {
          optimized.push(child);
        }
        // Skip additional empty paragraphs beyond 2
      } else {
        optimized.push(child);
      }
    }
    
    return optimized;
  }

  // Check if a heading text should be semibold (like "Measuring Care," "Enhancing Audits," etc.)
  isSemiboldPhrase(text) {
    if (!text) return false;
    
    // Patterns for semibold phrases:
    // 1. Phrases ending with a comma (e.g., "Measuring Care," "Enhancing Audits,")
    // 2. Short phrases (typically 2-3 words) that are card headings
    // 3. Phrases with gerund verbs (ending in -ing) followed by a noun
    
    const trimmed = text.trim();
    
    // Check if it ends with a comma
    if (trimmed.endsWith(',')) {
      return true;
    }
    
    // Check for gerund + noun pattern (e.g., "Measuring Care", "Enhancing Audits")
    const gerundPattern = /^[A-Z][a-z]+ing\s+[A-Z][a-z]+/;
    if (gerundPattern.test(trimmed)) {
      return true;
    }
    
    // Check for short phrases (2-3 words, typically card headings)
    const words = trimmed.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      // If it's a short phrase with title case, likely a card heading
      const isTitleCase = words.every(word => /^[A-Z]/.test(word));
      if (isTitleCase) {
        return true;
      }
    }
    
    return false;
  }
}

module.exports = WordGenerator;
