'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const Database = require('better-sqlite3');
const argon2 = require('argon2');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('CHANGE_THIS')) {
  console.warn('WARNING: Set a strong SESSION_SECRET in .env before production.');
}

const db = new Database(path.join(DATA_DIR, 'tiscord.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    banned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    action TEXT NOT NULL,
    target TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  );
`);

const SQLiteStore = SQLiteStoreFactory(session);

app.disable('x-powered-by');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: DATA_DIR
  }),
  secret: process.env.SESSION_SECRET || 'development-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, error: 'محاولات كثيرة. حاول لاحقاً.' }
});

function now() {
  return new Date().toISOString();
}

function cleanUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validUsername(username) {
  return /^[a-z0-9_]{3,32}$/.test(username);
}

function publicUser(row) {
  return {
    username: row.username,
    display: row.display_name,
    email: row.email || '',
    role: row.role,
    banned: !!row.banned,
    createdAt: row.created_at
  };
}

function audit(username, action, target, req) {
  db.prepare(`
    INSERT INTO audit_logs (username, action, target, ip, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    username || null,
    action,
    target || '',
    req.ip || '',
    now()
  );
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      ok: false,
      authenticated: false,
      error: 'Unauthorized: valid session required.'
    });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(req.session.user);
  if (!row || row.banned) {
    req.session.destroy(() => {});
    return res.status(401).json({
      ok: false,
      authenticated: false,
      error: 'Unauthorized: account/session is invalid.'
    });
  }

  req.authUser = row;
  next();
}

async function seedOwner() {
  const username = cleanUsername(process.env.OWNER_USERNAME || 'hosennujq2');
  const password = process.env.OWNER_PASSWORD;

  if (!password || password.includes('CHANGE_THIS')) {
    console.warn('Owner account was not seeded: set OWNER_PASSWORD in .env.');
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return;

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  db.prepare(`
    INSERT INTO users
      (username, display_name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'owner', ?)
  `).run(
    username,
    process.env.OWNER_DISPLAY || username,
    process.env.OWNER_EMAIL || '',
    passwordHash,
    now()
  );

  console.log(`Owner account created: ${username}`);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'tiscord', version: '6.0.0' });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const display = String(req.body.display || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    if (!validUsername(username)) {
      return res.status(400).json({ ok: false, error: 'اسم المستخدم غير صالح.' });
    }
    if (display.length < 2 || display.length > 40) {
      return res.status(400).json({ ok: false, error: 'الاسم المعروض غير صالح.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
    }

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) {
      return res.status(409).json({ ok: false, error: 'اسم المستخدم مستخدم بالفعل.' });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    db.prepare(`
      INSERT INTO users
        (username, display_name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'user', ?)
    `).run(username, display, email, passwordHash, now());

    req.session.user = username;
    audit(username, 'register', '', req);

    res.status(201).json({
      ok: true,
      authenticated: true,
      user: {
        username,
        display,
        email,
        role: 'user',
        banned: false
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'تعذر إنشاء الحساب.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');

    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!row) {
      return res.status(401).json({ ok: false, error: 'اسم المستخدم أو كلمة المرور غلط.' });
    }

    if (row.banned) {
      return res.status(403).json({ ok: false, error: 'هذا الحساب محظور.' });
    }

    const valid = await argon2.verify(row.password_hash, password);
    if (!valid) {
      audit(username, 'login_failed', '', req);
      return res.status(401).json({ ok: false, error: 'اسم المستخدم أو كلمة المرور غلط.' });
    }

    req.session.regenerate(err => {
      if (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: 'تعذر إنشاء الجلسة.' });
      }

      req.session.user = username;
      audit(username, 'login', '', req);

      res.json({
        ok: true,
        authenticated: true,
        user: publicUser(row)
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'تعذر تسجيل الدخول.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.json({ ok: true, authenticated: false, user: null });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(req.session.user);

  if (!row || row.banned) {
    req.session.destroy(() => {});
    return res.json({ ok: true, authenticated: false, user: null });
  }

  res.json({
    ok: true,
    authenticated: true,
    user: publicUser(row)
  });
});

app.post('/api/auth/logout', (req, res) => {
  const username = req.session.user || null;

  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ ok: false, error: 'تعذر تسجيل الخروج.' });
    }

    if (username) audit(username, 'logout', '', req);

    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/account', requireAuth, (req, res) => {
  res.json({ ok: true, user: publicUser(req.authUser) });
});

app.get('/api/admin/audit', requireAuth, (req, res) => {
  if (req.authUser.role !== 'owner') {
    return res.status(403).json({ ok: false, error: 'ليس لديك صلاحية.' });
  }

  const rows = db.prepare(`
    SELECT id, username, action, target, ip, created_at
    FROM audit_logs
    ORDER BY id DESC
    LIMIT 200
  `).all();

  res.json({ ok: true, logs: rows });
});

// Static frontend
app.use(express.static(__dirname, {
  extensions: ['html']
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'index(2).html'));
});

seedOwner()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tiscord V6 running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
