const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
app.set("trust proxy", 1); // Render terminates HTTPS at its proxy; needed for secure session cookies.
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET;
if (isProduction && !SESSION_SECRET) throw new Error("SESSION_SECRET must be set in production.");

const db = new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, "reborn.sqlite"));

const SHOP_ITEMS = [
  { id: "classic-noob", name: "Classic Noob", description: "Your starter blocky avatar.", price: 0, icon: "🙂", color: "#f4c542", kind: "Starter" },
  { id: "red-cap", name: "Retro Red Cap", description: "A bright red cap for your avatar.", price: 120, icon: "🧢", color: "#e34b4b", kind: "Hat" },
  { id: "blue-tee", name: "Blue Classic Tee", description: "A simple blue classic-era shirt.", price: 90, icon: "👕", color: "#2589d8", kind: "Shirt" },
  { id: "pixel-shades", name: "Pixel Shades", description: "Dark shades with old-school energy.", price: 180, icon: "🕶️", color: "#343a40", kind: "Accessory" },
  { id: "purple-hair", name: "Purple Spikes", description: "A bold purple hairstyle.", price: 220, icon: "💜", color: "#9056cc", kind: "Hair" },
  { id: "gold-crown", name: "Golden Crown", description: "A shiny crown for your avatar.", price: 400, icon: "👑", color: "#e5ad25", kind: "Hat" },
  { id: "green-hoodie", name: "Green Hoodie", description: "A comfy green outfit.", price: 260, icon: "🧥", color: "#2b9b71", kind: "Shirt" },
  { id: "cat-companion", name: "Tiny Cat", description: "A little companion for your profile.", price: 350, icon: "🐱", color: "#ec9d66", kind: "Companion" },
  { id: "blue-wings", name: "Blue Wings", description: "Stand out with bright blue wings.", price: 500, icon: "🪽", color: "#60a5fa", kind: "Back" }
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (err) {
    if (err) reject(err); else resolve(this);
  }));
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => {
    if (err) reject(err); else resolve(rows);
  }));
}
async function initDatabase() {
  await run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL COLLATE NOCASE UNIQUE, email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const columns = await all("PRAGMA table_info(users)");
  const names = columns.map(column => column.name);
  if (!names.includes("rebux_balance")) await run("ALTER TABLE users ADD COLUMN rebux_balance INTEGER NOT NULL DEFAULT 500");
  if (!names.includes("avatar_item_id")) await run("ALTER TABLE users ADD COLUMN avatar_item_id TEXT NOT NULL DEFAULT 'classic-noob'");
  await run("CREATE TABLE IF NOT EXISTS owned_items (user_id INTEGER NOT NULL, item_id TEXT NOT NULL, purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, item_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)");
  await run("INSERT OR IGNORE INTO owned_items (user_id, item_id) SELECT id, 'classic-noob' FROM users");
  await run("CREATE TABLE IF NOT EXISTS published_games (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, genre TEXT NOT NULL, template TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE)");

}

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
  cookie: { httpOnly: true, sameSite: "lax", secure: isProduction, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false });
const clean = value => typeof value === "string" ? value.trim() : "";
const publicUser = user => ({
  id: user.id, username: user.username, createdAt: user.created_at,
  rebuxBalance: Number(user.rebux_balance ?? 500), avatarItemId: user.avatar_item_id || "classic-noob"
});
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Önce hesabına giriş yapmalısın." });
  next();
}

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  db.get("SELECT id, username, created_at, rebux_balance, avatar_item_id FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user) return res.json({ user: null });
    res.json({ user: publicUser(user) });
  });
});

app.post("/api/register", authLimiter, async (req, res) => {
  const username = clean(req.body.username);
  const email = clean(req.body.email).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: "Kullanıcı adı 3-20 karakter olmalı." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return res.status(400).json({ error: "Geçerli bir e-posta adresi gir." });
  if (password.length < 10 || password.length > 72) return res.status(400).json({ error: "Şifre 10-72 karakter arasında olmalı." });
  try {
    const hash = await bcrypt.hash(password, 12);
    db.run("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hash], function (err) {
      if (err) {
        if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });
        return res.status(500).json({ error: "Hesap oluşturulamadı." });
      }
      const userId = this.lastID;
      db.run("INSERT OR IGNORE INTO owned_items (user_id, item_id) VALUES (?, 'classic-noob')", [userId]);
      req.session.userId = userId;
      res.status(201).json({ user: { id: userId, username, rebuxBalance: 500, avatarItemId: "classic-noob" } });
    });
  } catch {
    res.status(500).json({ error: "Hesap oluşturulamadı." });
  }
});

app.post("/api/login", authLimiter, (req, res) => {
  const login = clean(req.body.login);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  db.get("SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE", [login, login], async (err, user) => {
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
  req.session.destroy(() => { res.clearCookie("reborn.sid"); res.json({ ok: true }); });
});

app.get("/api/shop", (req, res) => {
  if (!req.session.userId) return res.json({ items: SHOP_ITEMS, user: null, ownedItemIds: [] });
  db.get("SELECT id, username, created_at, rebux_balance, avatar_item_id FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user) return res.status(500).json({ error: "Mağaza bilgileri yüklenemedi." });
    db.all("SELECT item_id FROM owned_items WHERE user_id = ?", [req.session.userId], (ownedErr, rows) => {
      if (ownedErr) return res.status(500).json({ error: "Envanter yüklenemedi." });
      res.json({ items: SHOP_ITEMS, user: publicUser(user), ownedItemIds: rows.map(row => row.item_id) });
    });
  });
});

app.post("/api/shop/buy", requireLogin, (req, res) => {
  const item = SHOP_ITEMS.find(entry => entry.id === clean(req.body.itemId));
  if (!item) return res.status(404).json({ error: "Ürün bulunamadı." });
  db.run("BEGIN IMMEDIATE", beginErr => {
    if (beginErr) return res.status(500).json({ error: "Satın alma başlatılamadı." });
    const rollback = (status, message) => db.run("ROLLBACK", () => res.status(status).json({ error: message }));
    db.get("SELECT rebux_balance FROM users WHERE id = ?", [req.session.userId], (err, user) => {
      if (err || !user) return rollback(500, "Hesap bilgisi okunamadı.");
      db.get("SELECT 1 AS owned FROM owned_items WHERE user_id = ? AND item_id = ?", [req.session.userId, item.id], (ownedErr, owned) => {
        if (ownedErr) return rollback(500, "Envanter kontrol edilemedi.");
        if (owned) return rollback(409, "Bu ürün zaten envanterinde.");
        if (Number(user.rebux_balance) < item.price) return rollback(400, "Yeterli ReBux bakiyen yok.");
        db.run("UPDATE users SET rebux_balance = rebux_balance - ? WHERE id = ?", [item.price, req.session.userId], updateErr => {
          if (updateErr) return rollback(500, "Bakiye güncellenemedi.");
          db.run("INSERT INTO owned_items (user_id, item_id) VALUES (?, ?)", [req.session.userId, item.id], insertErr => {
            if (insertErr) return rollback(500, "Ürün envantere eklenemedi.");
            db.run("COMMIT", commitErr => {
              if (commitErr) return res.status(500).json({ error: "Satın alma tamamlanamadı." });
              res.json({ ok: true, message: item.name + " satın alındı.", rebuxBalance: Number(user.rebux_balance) - item.price, itemId: item.id });
            });
          });
        });
      });
    });
  });
});

app.post("/api/avatar/equip", requireLogin, (req, res) => {
  const itemId = clean(req.body.itemId);
  if (!SHOP_ITEMS.some(item => item.id === itemId)) return res.status(404).json({ error: "Avatar ürünü bulunamadı." });
  db.get("SELECT 1 AS owned FROM owned_items WHERE user_id = ? AND item_id = ?", [req.session.userId, itemId], (err, owned) => {
    if (err) return res.status(500).json({ error: "Envanter kontrol edilemedi." });
    if (!owned) return res.status(403).json({ error: "Önce bu ürünü satın almalısın." });
    db.run("UPDATE users SET avatar_item_id = ? WHERE id = ?", [itemId, req.session.userId], updateErr => {
      if (updateErr) return res.status(500).json({ error: "Avatar güncellenemedi." });
      res.json({ ok: true, avatarItemId: itemId });
    });
  });
});


const CREATOR_TEMPLATES = new Set(["pet-clicker", "blocky-obby", "tower-defense"]);
const publishLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false });

app.get("/api/games", (_req, res) => {
  db.all("SELECT g.id, g.title, g.description, g.genre, g.template, g.created_at, u.username AS creator FROM published_games g JOIN users u ON u.id = g.owner_id ORDER BY g.id DESC LIMIT 100", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Oyunlar yüklenemedi." });
    res.json({ games: rows });
  });
});

app.get("/api/games/:id", (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Geçersiz oyun numarası." });
  db.get("SELECT g.id, g.title, g.description, g.genre, g.template, g.created_at, u.username AS creator FROM published_games g JOIN users u ON u.id = g.owner_id WHERE g.id = ?", [id], (err, game) => {
    if (err) return res.status(500).json({ error: "Oyun yüklenemedi." });
    if (!game) return res.status(404).json({ error: "Oyun bulunamadı." });
    res.json({ game });
  });
});

app.post("/api/games", requireLogin, publishLimiter, (req, res) => {
  const title = clean(req.body.title);
  const description = clean(req.body.description);
  const genre = clean(req.body.genre);
  const template = clean(req.body.template);
  if (title.length < 3 || title.length > 40) return res.status(400).json({ error: "Oyun adı 3-40 karakter olmalı." });
  if (description.length < 10 || description.length > 240) return res.status(400).json({ error: "Açıklama 10-240 karakter olmalı." });
  if (!["Adventure", "Simulator", "Tower Defense", "Obby"].includes(genre)) return res.status(400).json({ error: "Geçerli bir oyun türü seç." });
  if (!CREATOR_TEMPLATES.has(template)) return res.status(400).json({ error: "Geçerli bir oyun şablonu seç." });
  db.run("INSERT INTO published_games (owner_id, title, description, genre, template) VALUES (?, ?, ?, ?, ?)",
    [req.session.userId, title, description, genre, template], function (err) {
      if (err) return res.status(500).json({ error: "Oyun yayınlanamadı." });
      res.status(201).json({ ok: true, game: { id: this.lastID, title, description, genre, template } });
    });
});

app.get("/play/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "play.html"));
});

app.get("/api/users/:username", (req, res) => {
  db.get("SELECT id, username, created_at, avatar_item_id FROM users WHERE username = ? COLLATE NOCASE", [req.params.username], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "Oyuncu bulunamadı." });
    res.json({ user: { id: user.id, username: user.username, createdAt: user.created_at, avatarItemId: user.avatar_item_id || "classic-noob" } });
  });
});
app.get("/api/stats", (_req, res) => {
  db.get("SELECT COUNT(*) AS users FROM users", (err, row) => {
    if (err) return res.status(500).json({ error: "İstatistikler yüklenemedi." });
    res.json({ registeredUsers: row.users });
  });
});
app.get("/api/health", (_req, res) => res.json({ ok: true, name: "ROBLOX 2021 REBORN" }));

initDatabase()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log("Reborn server listening on http://localhost:" + PORT)))
  .catch(err => { console.error("Database initialization failed:", err); process.exit(1); });
