const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/scrapegoat.db');
const DB_DIR = path.dirname(DB_PATH);

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db = null;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
      }
    });
  }
  return db;
}

function initializeDatabase() {
  const db = getDatabase();
  
  // Create jobs table
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 0,
      processed_pages INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      zip_file_path TEXT,
      user_email TEXT,
      follow_all_links INTEGER DEFAULT 0,
      include_images INTEGER DEFAULT 0,
      single_page_only INTEGER DEFAULT 0,
      content_selector TEXT
    )
  `, (err) => {
    if (err) console.error('Error creating jobs table:', err);
    else {
      // Add new columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE jobs ADD COLUMN follow_all_links INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE jobs ADD COLUMN include_images INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE jobs ADD COLUMN single_page_only INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE jobs ADD COLUMN content_selector TEXT`, () => {});
    }
  });

  // Create pages table
  db.run(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      word_file_path TEXT,
      processed_at DATETIME,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    )
  `, (err) => {
    if (err) console.error('Error creating pages table:', err);
  });

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      // Initialize first user if users table is empty
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (!err && row && row.count === 0) {
          const bcrypt = require('bcrypt');
          const hash = bcrypt.hashSync('goats', 10);
          db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['mikey', hash], (err) => {
            if (err) {
              console.error('Error creating initial user:', err);
            } else {
              console.log('✅ Created initial user: mikey');
            }
          });
        }
      });
    }
  });
}

// Job operations
function createJob(jobId, url, email = null, followAllLinks = false, includeImages = false, singlePageOnly = false, contentSelector = null) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(
      'INSERT INTO jobs (id, url, user_email, follow_all_links, include_images, single_page_only, content_selector) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [jobId, url, email, followAllLinks ? 1 : 0, includeImages ? 1 : 0, singlePageOnly ? 1 : 0, contentSelector || null],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getJob(jobId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(
      'SELECT * FROM jobs WHERE id = ?',
      [jobId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function updateJobStatus(jobId, status, progress = null, totalPages = null, processedPages = null) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    let query = 'UPDATE jobs SET status = ?';
    let params = [status];

    if (progress !== null) {
      query += ', progress = ?';
      params.push(progress);
    }
    if (totalPages !== null) {
      query += ', total_pages = ?';
      params.push(totalPages);
    }
    if (processedPages !== null) {
      query += ', processed_pages = ?';
      params.push(processedPages);
    }
    if (status === 'completed') {
      query += ', completed_at = CURRENT_TIMESTAMP';
    }

    query += ' WHERE id = ?';
    params.push(jobId);

    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function updateJobZipPath(jobId, zipPath) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(
      'UPDATE jobs SET zip_file_path = ? WHERE id = ?',
      [zipPath, jobId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

// Page operations
function addPage(jobId, url, title = null) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(
      'INSERT INTO pages (job_id, url, title) VALUES (?, ?, ?)',
      [jobId, url, title],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function updatePageWordPath(pageId, wordPath) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(
      'UPDATE pages SET word_file_path = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [wordPath, pageId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

function getPagesByJob(jobId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(
      'SELECT * FROM pages WHERE job_id = ?',
      [jobId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function pageExists(jobId, url) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(
      'SELECT id FROM pages WHERE job_id = ? AND url = ?',
      [jobId, url],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
}

// User operations
function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(
      'SELECT * FROM users WHERE username = ?',
      [username],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getAllUsers() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(
      'SELECT id, username, created_at FROM users ORDER BY username',
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function createUser(username, passwordHash) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(
      'DELETE FROM users WHERE id = ?',
      [userId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

module.exports = {
  getDatabase,
  createJob,
  getJob,
  updateJobStatus,
  updateJobZipPath,
  addPage,
  updatePageWordPath,
  getPagesByJob,
  pageExists,
  getUserByUsername,
  getAllUsers,
  createUser,
  deleteUser
};

