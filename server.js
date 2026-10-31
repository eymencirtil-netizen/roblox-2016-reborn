const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET;
if (isProduction && !SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}
const db = new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, "reborn.sqlite"));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: process.env.SESSION_DB_DIR || __dirname }),
  name: "reborn.sid",
  secret: SESSION_SECRET || "local-development-secret-change-before-deploy",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false });
const clean = value => typeof value === "string" ? value.trim() : "";
const publicUser = user => ({ id: user.id, username: user.username, createdAt: user.created_at });

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  db.get("SELECT id, username, created_at FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user) return res.json({ user: null });
    res.json({ user: publicUser(user) });
  });
});

app.post("/api/register", authLimiter, async (req, res) => {
  const username = clean(req.body.username);
  const email = clean(req.body.email).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: "Kullanıcı adı 3-20 karakter olmalı; harf, rakam ve _ kullanılabilir." });
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 160)
    return res.status(400).json({ error: "Geçerli bir e-posta adresi gir." });
  if (password.length < 10 || password.length > 72)
    return res.status(400).json({ error: "Şifre 10-72 karakter arasında olmalı." });

  try {
    const hash = await bcrypt.hash(password, 12);
    db.run("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hash], function (err) {
        if (err) {
          if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });
          return res.status(500).json({ error: "Hesap oluşturulamadı." });
        }
        req.session.userId = this.lastID;
        res.status(201).json({ user: { id: this.lastID, username } });
      });
  } catch {
    res.status(500).json({ error: "Hesap oluşturulamadı." });
  }
});

app.post("/api/login", authLimiter, (req, res) => {
  const login = clean(req.body.login);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  db.get("SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
    [login, login], async (err, user) => {
      if (err || !user) return res.status(401).json({ error: "Kullanıcı bilgileri hatalı." });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: "Kullanıcı bilgileri hatalı." });
      req.session.regenerate(sessionErr => {
        if (sessionErr) return res.status(500).json({ error: "Giriş yapılamadı." });
        req.session.userId = user.id;
        res.json({ user: publicUser(user) });
      });
    });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("reborn.sid");
    res.json({ ok: true });
  });
});

app.get("/api/users/:username", (req, res) => {
  db.get("SELECT id, username, created_at FROM users WHERE username = ? COLLATE NOCASE",
    [req.params.username], (err, user) => {
      if (err || !user) return res.status(404).json({ error: "Oyuncu bulunamadı." });
      res.json({ user: publicUser(user) });
    });
});

app.get("/api/stats", (_req, res) => {
  db.get("SELECT COUNT(*) AS users FROM users", (err, row) => {
    if (err) return res.status(500).json({ error: "İstatistikler yüklenemedi." });
    res.json({ registeredUsers: row.users });
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "ROBLOX 2016 REBORN" }));
app.listen(PORT, "0.0.0.0", () => console.log(`Reborn server listening on http://localhost:${PORT}`));