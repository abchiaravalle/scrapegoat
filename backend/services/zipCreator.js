const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

class ZipCreator {
  constructor(jobId) {
    this.jobId = jobId;
    this.documentsDir = path.join(__dirname, '../storage/jobs', jobId, 'documents');
    this.zipPath = path.join(__dirname, '../storage/jobs', jobId, 'output.zip');
    
    // Ensure storage directory exists
    const storageDir = path.dirname(this.zipPath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  async createZip() {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(this.zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        console.log(`Zip file created: ${archive.pointer()} total bytes`);
        resolve(this.zipPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Recursively add all files and folders, maintaining structure
      // Start from documents directory, but don't include "documents" in zip path
      this.addDirectoryToArchive(archive, this.documentsDir, '', this.documentsDir);

      archive.finalize();
    });
  }

  addDirectoryToArchive(archive, dirPath, zipPath, baseDir) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      // Calculate relative path from baseDir
      const relativePath = path.relative(baseDir, filePath);
      const zipFilePath = relativePath.split(path.sep).join('/'); // Use forward slashes in zip

      if (stat.isDirectory()) {
        // Recursively add subdirectories
        this.addDirectoryToArchive(archive, filePath, zipFilePath, baseDir);
      } else {
        // Add file to archive
        archive.file(filePath, { name: zipFilePath });
      }
    });
  }

  getZipPath() {
    return this.zipPath;
  }
}

module.exports = ZipCreator;

