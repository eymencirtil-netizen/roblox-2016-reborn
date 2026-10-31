# ROBLOX 2021 REBORN

An independent, community-built Roblox-era portal with accounts, an avatar catalog, a Creator Hub, browser-playable mini-game templates and a Windows Electron launcher.

## Included in this version

- Classic Roblox-inspired blue navigation, sidebar and game-card home page
- Account registration, login and logout
- SQLite-backed profiles and sessions; bcrypt password hashing
- ReBux test currency, avatar catalog, purchases and equipping
- Popular Roblox experience cards with official Roblox app deep links
- Creator Hub: signed-in users can publish games from three built-in templates
- Community Creations list; published games open inside Reborn
- Playable templates: Pet Clicker, Blocky Obby and Tower Defense Mini
- Electron Windows launcher source and a GitHub Actions installer workflow

## Important game distinction

The popular Roblox experience cards represent original games made and hosted by their respective creators. Reborn opens those experiences using Roblox's documented app deep-link format; the original Roblox app must be installed and the player must be signed in to Roblox.

The Creator Hub publishes Reborn-native mini-games made from the built-in templates. It does not upload arbitrary Unity/Godot projects, run the Roblox game engine, or copy third-party Roblox experiences. A full 3D multiplayer game engine, arbitrary project uploads, moderation tools, friends/chat, email verification and password reset are not included yet.

## Run locally

1. Install Node.js 20 LTS or newer.
2. Open a terminal in the folder containing `package.json`.
3. Run `npm install`.
4. For local development, run `npm start`.
5. Open http://localhost:3000.

SQLite creates `reborn.sqlite` and `sessions.sqlite` in the project folder. New accounts receive 500 ReBux. Existing user databases are migrated when the updated server starts.

For production, set a long, unique `SESSION_SECRET` and `NODE_ENV=production`. The server refuses to start in production if `SESSION_SECRET` is missing. Use persistent storage for SQLite databases and HTTPS.

## Build the Windows launcher

The launcher opens the hosted Reborn website; it is not a standalone game engine.

1. Deploy the website to a public HTTPS URL first.
2. In GitHub, open **Settings → Secrets and variables → Actions → Variables**.
3. Add a repository variable named `REBORN_URL` containing the deployed URL.
4. Open **Actions → Build Windows Launcher → Run workflow**.
5. Download the `roblox-2021-reborn-windows` artifact from the completed workflow run.

For local development, the launcher defaults to `http://localhost:3000`.

## Public deployment checklist

- Use a host with persistent disk storage, or replace SQLite with a managed database.
- Set `NODE_ENV=production` and a long random `SESSION_SECRET`.
- Use HTTPS and a custom domain.
- Keep SQLite database and session files on persistent storage and back them up.
- Before opening public registration broadly, add privacy policy, terms, abuse reporting, moderation, account deletion and CSRF protection.
- Restrict access to database files and collect as little personal data as possible.

## Project identity

Independent fan-made project. Not affiliated with, endorsed by, or operated by Roblox Corporation. Use original branding and original game assets; do not imply official status.
