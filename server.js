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
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO users (username, password, display_name, role)
      VALUES (?, ?, ?, ?)
    `);
    for (const u of defaultUsers) {
      insertStmt.run(u.username, u.password, u.display_name, u.role);
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
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Molimo unesite korisničko ime i lozinku.' });
  }

  let user = null;
  if (DatabaseSync && db) {
    const stmt = db.prepare('SELECT id, username, password, display_name, role FROM users WHERE username = ?');
    user = stmt.get(username);
  } else {
    if (username === 'andrija<3' && password === 'andrija123') {
      user = { id: 1, username: 'andrija<3', display_name: 'Andrija 💙', role: 'boyfriend' };
    } else if (username === 'vanja<3' && password === 'lolxdlol123') {
      user = { id: 2, username: 'vanja<3', display_name: 'Vanja 💕', role: 'girlfriend' };
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

app.post('/api/date-plans', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

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
});

app.get('/api/date-plans', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  let plans = [];
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

app.get('/api/puzzle/today', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  const images = getPuzzleImages();
  if (images.length === 0) {
    return res.status(404).json({ error: 'Nema slika za slagalicu.' });
  }

  // Today's date string format YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Deterministic daily index based on date string
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) {
    hash = todayStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const imageIndex = Math.abs(hash) % images.length;
  const todayImage = images[imageIndex];

  let progress = null;
  if (DatabaseSync && db) {
    const stmt = db.prepare(`
      SELECT * FROM puzzle_progress WHERE user_id = ? AND puzzle_date = ?
    `);
    const row = stmt.get(user.id, todayStr);
    if (row) {
      progress = {
        ...row,
        tiles: JSON.parse(row.tiles || '[]'),
        is_completed: Boolean(row.is_completed)
      };
    }
  }

  res.json({
    date: todayStr,
    image_filename: todayImage,
    image_url: `/imagesForPuzzels/${encodeURIComponent(todayImage)}`,
    progress
  });
});

app.post('/api/puzzle/save', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  const { puzzle_date, image_filename, grid_size, tiles, is_completed, moves, time_seconds } = req.body;
  const tilesJson = JSON.stringify(tiles || []);
  const completedInt = is_completed ? 1 : 0;
  const completedAt = is_completed ? new Date().toISOString() : null;

  if (DatabaseSync && db) {
    const stmt = db.prepare(`
      INSERT INTO puzzle_progress (user_id, puzzle_date, image_filename, grid_size, tiles, is_completed, moves, time_seconds, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, puzzle_date) DO UPDATE SET
        tiles = excluded.tiles,
        is_completed = excluded.is_completed,
        moves = excluded.moves,
        time_seconds = excluded.time_seconds,
        completed_at = COALESCE(excluded.completed_at, puzzle_progress.completed_at)
    `);
    stmt.run(user.id, puzzle_date, image_filename, grid_size || 3, tilesJson, completedInt, moves || 0, time_seconds || 0, completedAt);
  }

  res.json({ success: true });
});

app.get('/api/puzzle/gallery', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Morate biti prijavljeni.' });

  const allImages = getPuzzleImages().map(img => ({
    filename: img,
    image_url: `/imagesForPuzzels/${encodeURIComponent(img)}`
  }));

  let completedDates = [];
  if (DatabaseSync && db) {
    const stmt = db.prepare(`
      SELECT puzzle_date, image_filename, moves, time_seconds, completed_at
      FROM puzzle_progress WHERE user_id = ? AND is_completed = 1
      ORDER BY puzzle_date DESC
    `);
    completedDates = stmt.all();
  }

  res.json({ allImages, completedDates });
});

app.listen(PORT, () => {
  console.log(`💖 CutiePatutije Server pokrenut na http://localhost:${PORT}`);
});
