# ROBLOX 2021 REBORN

Independent community-built 2021-inspired web portal starter with account registration/login and a Windows Electron launcher.

## Included
- Responsive retro-inspired website
- Username/email + password registration
- Login/logout and persistent SQLite user database
- bcrypt password hashing
- Basic authentication rate limiting, Helmet security headers, HTTP-only session cookie
- 2021-era game catalog with official Roblox search links
- ReBux test currency, avatar item shop, purchases and equip flow
- Electron desktop launcher that opens the configured portal URL

## 2021 game catalog
The main catalog is based on Roblox's official 2021 year-in-review list of most-visited experiences. Pet Simulator X and All Star Tower Defense are highlighted, and Tower Defense Simulator is included as an additional community-requested game. Game cards open Roblox search results; they do not run the original games inside this portal.

## Not included yet
This is a community portal, not a Roblox emulator or game engine. Game cards open Roblox's official experience search; the original games still run on Roblox. The avatar shop uses project-only ReBux test currency, not real Robux. Multiplayer experiences hosted by this project, full 3D avatar rendering, friends, chat, moderation/admin tools, email verification, password reset and user-generated content require further implementation.

## Run locally
1. Install Node.js 20 LTS or newer.
2. Run `npm install`.
3. Set a strong session secret:
   - Windows PowerShell: `$env:SESSION_SECRET="a-long-random-secret"`
   - macOS/Linux: `export SESSION_SECRET="a-long-random-secret"`
4. Run `npm start`.
5. Open http://localhost:3000.

SQLite creates `reborn.sqlite` and `sessions.sqlite` in the project folder. New accounts start with 500 ReBux. Existing databases are migrated automatically when the updated server starts.

## Build Windows launcher
The launcher opens the hosted website; it does not contain a game engine.
1. Deploy the web app to a public HTTPS URL first.
2. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add a repository variable named `REBORN_URL` containing that URL (for example, `https://your-domain.example`).
3. Open **Actions → Build Windows Launcher → Run workflow**.
4. Download the `roblox-2016-reborn-windows` artifact from the completed workflow run. It contains the Windows installer.

For local development, the launcher configuration defaults to `http://localhost:3000`.

## Public deployment checklist
- Use a host with persistent disk, or replace SQLite with a managed database.
- Set `NODE_ENV=production` and a unique long random `SESSION_SECRET`. Never use the development fallback.
- Use HTTPS and a custom domain.
- Persist both SQLite database files; ephemeral hosting storage can erase accounts on redeploy.
- Back up the database and test restore procedures.
- Add email verification, password reset, privacy policy, terms, abuse reporting, moderation and account deletion before public registration.
- Add CSRF protection and review all security configuration before production launch.
- Collect as little personal data as possible and restrict database access.

## Project identity
Independent fan-made project. Not affiliated with or endorsed by Roblox Corporation. Use original branding and assets; do not imply official status.