# Rollout Studio

Standalone rollout checklist app for music releases — Mac desktop, iPhone, and optional Supabase cloud sync.

Rollout Studio is its own product. Customize projects, templates, and branding for any artist or release.

## Download (macOS)

Official builds are published on **[GitHub Releases](https://github.com/killscomfort/rollout-studio-app/releases)** as `.zip` and `.dmg`.

1. Download the latest **Rollout-Studio-mac** artifact for your chip (Apple Silicon `arm64` or Intel `x64`)
2. Unzip and drag **Rollout Studio.app** to Applications
3. First launch: right-click → **Open** (unsigned build — macOS Gatekeeper)
4. Copy `.env.example` → `.env` and add your Supabase keys for cloud sync (see below)

Refresh your Desktop Dock icon after each update:

```bash
cd rollout-studio-app
npm run apply:desktop
```

## Desktop (macOS) — from source

```bash
git clone https://github.com/killscomfort/rollout-studio-app.git
cd rollout-studio-app
npm install
npm rebuild better-sqlite3
npm start
```

## Supabase cloud sync (recommended for sharing)

Without Supabase, data stays on each device. With Supabase, Mac and iPhone stay in sync automatically after sign-in — and you can share the app with others using the same backend.

See **[SHARING.md](./SHARING.md)** for the full team setup guide.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Open **SQL Editor** and run the migration in `supabase/migrations/001_rollout_studio.sql`
3. Copy **Project URL** and **anon public key** from **Settings → API**

### 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Rebuild and run:

```bash
npm run dev
# or
npm start
```

Sign in (or create an account) when the app opens. The same account works on Mac and iPhone.

### Auth settings

In Supabase **Authentication → Providers**, enable **Email**. You can disable email confirmation for personal use under **Auth → Email** if you want instant sign-up.

## iPhone (iOS)

Rollout Studio runs on iPhone as a native Capacitor app. Data is stored on-device unless Supabase is configured.

### Requirements

- macOS with **Xcode** installed from the App Store (Command Line Tools alone is not enough)
- Node.js 18+

### Build and run on simulator or device

```bash
cd rollout-studio-app
npm install
npm run build:ios
npm run open:ios
```

In Xcode:

1. Select a simulator or your connected iPhone
2. Press **Run** (▶)

After changing the web UI, run `npm run build:ios` again before rebuilding in Xcode.

### Install on your iPhone

1. Connect your iPhone and open the project in Xcode (`npm run open:ios`)
2. Select your iPhone as the run target
3. In **Signing & Capabilities**, choose your Apple ID team (free Apple Developer account works for personal installs)
4. Press **Run** to install on your phone

### Sync Mac and iPhone

With **Supabase** configured, sync is automatic after sign-in.

Without Supabase:

1. On one device, tap **Export sync file**
2. AirDrop, email, or save the JSON file
3. On the other device, tap **Import sync file** and choose that file

## Development

| Command | Description |
|---------|-------------|
| `npm run apply:desktop` | Rebuild and install Desktop launcher + Dock app |
| `npm run release:mac` | Build `.zip` + `.dmg` in `release/` |
| `npm run setup:cloud` | Verify Supabase env and connection |
| `npm run dev` | Auto cloud or local dev mode |
| `npm run dev:cloud` | Dev mode with Supabase only |
| `npm run start:cloud` | Desktop build using Supabase only |
| `npm run build:ios` | Build web bundle and sync to `ios/` |
| `npm run open:ios` | Open Xcode project |

## Templates

- **New Rollout** — blank starter project
- **Single Release Rollout** — generic 8-week release checklist with placeholder copy you can edit in project settings

## Share with others

- **Code:** https://github.com/killscomfort/rollout-studio-app
- **Desktop:** Share the repo; peers run `npm start` on macOS
- **iPhone:** Share the repo; peers need Xcode to build and install on their devices
