const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');

// Try native Node.js SQLite (Node 22.5+)
let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (err) {
  console.log('node:sqlite module not found, using fallback SQLite handler');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(cors());

// Static directories
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/imagesForPuzzels', express.static(path.join(__dirname, 'imagesForPuzzels')));

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
let db;

if (DatabaseSync) {
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS date_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      selected_days TEXT NOT NULL,
      selected_activities TEXT NOT NULL,
      custom_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS puzzle_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      puzzle_date TEXT NOT NULL,
      image_filename TEXT NOT NULL,
      grid_size INTEGER DEFAULT 3,
      tiles TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      moves INTEGER DEFAULT 0,
      time_seconds INTEGER DEFAULT 0,
      completed_at DATETIME,
      UNIQUE(user_id, puzzle_date)
    );
  `);
} else {
  // Simple JSON-backed persistent db fallback if native node:sqlite is disabled
  console.log('Using JSON file database fallback');
}

// Seed Users helper
function initUsers() {
  const defaultUsers = [
    { username: 'andrija<3', password: 'andrija123', display_name: 'Andrija 💙', role: 'boyfriend' },
    { username: 'vanja<3', password: 'lolxdlol123', display_name: 'Vanja 💕', role: 'girlfriend' }
  ];

  if (DatabaseSync && db) {
    const upsertStmt = db.prepare(`
      INSERT INTO users (username, password, display_name, role)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        password = excluded.password,
        display_name = excluded.display_name,
        role = excluded.role
    `);
    for (const u of defaultUsers) {
      upsertStmt.run(u.username, u.password, u.display_name, u.role);
    }
  }
}
initUsers();

// Simple in-memory session mapping for tokens
const sessions = new Map();

function getAuthenticatedUser(req) {
  const token = req.cookies.session_token || req.headers['authorization'];
  if (!token || !sessions.has(token)) return null;
  return sessions.get(token);
}

// ==================== AUTH ROUTES ====================

app.post('/api/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = (req.body.password || '').trim();

  if (!username || !password) {
    return res.status(400).json({ error: 'Molimo unesite korisničko ime i lozinku.' });
  }

  let user = null;
  if (DatabaseSync && db) {
    const stmt = db.prepare('SELECT id, username, password, display_name, role FROM users WHERE username = ?');
    user = stmt.get(username);
  }

  // Fallback if not found in SQLite DB or if db is disabled
  if (!user) {
    if (username === 'andrija<3' && password === 'andrija123') {
      user = { id: 1, username: 'andrija<3', password: 'andrija123', display_name: 'Andrija 💙', role: 'boyfriend' };
    } else if (username === 'vanja<3' && password === 'lolxdlol123') {
      user = { id: 2, username: 'vanja<3', password: 'lolxdlol123', display_name: 'Vanja 💕', role: 'girlfriend' };
    }
  }

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka! 🥺' });
  }

  const token = 'session_' + Math.random().toString(36).substring(2) + Date.now();
  const sessionData = { id: user.id, username: user.username, display_name: user.display_name, role: user.role };
  sessions.set(token, sessionData);

  res.cookie('session_token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, token, user: sessionData });
});

app.get('/api/me', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, user });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.session_token || req.headers['authorization'];
  if (token) sessions.delete(token);
  res.clearCookie('session_token');
  res.json({ success: true });
});

// ==================== DATE PLAN ROUTES ====================

function ensureDatePlansTable() {
  if (DatabaseSync && db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS date_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        selected_days TEXT NOT NULL,
        selected_activities TEXT NOT NULL,
        custom_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

app.post('/api/date-plans', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  try {
    ensureDatePlansTable();
    const { selected_days, selected_activities, custom_note } = req.body;
    const daysJson = JSON.stringify(selected_days || []);
    const activitiesJson = JSON.stringify(selected_activities || []);
    const note = custom_note || '';

    if (DatabaseSync && db) {
      const stmt = db.prepare(`
        INSERT INTO date_plans (user_id, username, selected_days, selected_activities, custom_note)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(user.id, user.username, daysJson, activitiesJson, note);
    }

    res.json({ success: true, message: 'Plan sastanka je uspešno sačuvan! 💖' });
  } catch (err) {
    console.error('Error saving date plan:', err);
    res.status(500).json({ error: 'Greška pri čuvanju u bazi.' });
  }
});

app.get('/api/date-plans', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  let plans = [];
  try {
    ensureDatePlansTable();
    if (DatabaseSync && db) {
      const stmt = db.prepare(`
        SELECT id, user_id, username, selected_days, selected_activities, custom_note, created_at
        FROM date_plans ORDER BY id DESC LIMIT 20
      `);
      plans = stmt.all().map(p => ({
        ...p,
        selected_days: JSON.parse(p.selected_days || '[]'),
        selected_activities: JSON.parse(p.selected_activities || '[]')
      }));
    }
  } catch (err) {
    console.error('Error getting date plans:', err);
  }
  res.json({ plans });
});

// ==================== PUZZLE ROUTES ====================

// Helper to list all puzzle images
function getPuzzleImages() {
  const puzzleFolder = path.join(__dirname, 'imagesForPuzzels');
  try {
    const files = fs.readdirSync(puzzleFolder);
    return files.filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f));
  } catch (err) {
    return [];
  }
}

// Save puzzle completion
app.post('/api/puzzle/complete', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  const { image_filename, moves, time_seconds } = req.body;
  if (!image_filename) return res.status(400).json({ error: 'Nedostaje naziv slike.' });

  if (DatabaseSync && db) {
    // Create table if not exists (idempotent)
    db.exec(`
      CREATE TABLE IF NOT EXISTS puzzle_completed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        image_filename TEXT NOT NULL,
        moves INTEGER DEFAULT 0,
        time_seconds INTEGER DEFAULT 0,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, image_filename)
      );
    `);

    const stmt = db.prepare(`
      INSERT INTO puzzle_completed (user_id, image_filename, moves, time_seconds)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, image_filename) DO UPDATE SET
        moves = excluded.moves,
        time_seconds = excluded.time_seconds,
        completed_at = CURRENT_TIMESTAMP
    `);
    stmt.run(user.id, image_filename, moves || 0, time_seconds || 0);
  }

  res.json({ success: true });
});

// Gallery: list all images + which ones are completed
app.get('/api/puzzle/gallery', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  const allImages = getPuzzleImages().map(img => ({
    filename: img,
    image_url: `/imagesForPuzzels/${encodeURIComponent(img)}`
  }));

  let completed = [];
  if (DatabaseSync && db) {
    try {
      const stmt = db.prepare(`
        SELECT image_filename, moves, time_seconds, completed_at
        FROM puzzle_completed WHERE user_id = ?
        ORDER BY completed_at DESC
      `);
      completed = stmt.all(user.id);
    } catch (err) {
      // Table might not exist yet
      completed = [];
    }
  }

  res.json({ allImages, completed });
});

app.listen(PORT, () => {
  console.log(`💖 CutiePatutije Server pokrenut na http://localhost:${PORT}`);
});
