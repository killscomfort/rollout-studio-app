# Rollout Studio

Standalone rollout checklist app — desktop (macOS), iPhone, and optional Supabase cloud sync.

## Desktop (macOS)

```bash
git clone https://github.com/killscomfort/rollout-studio.git
cd rollout-studio
npm install
npm rebuild better-sqlite3
npm start
```

## Supabase cloud sync (recommended)

Without Supabase, data stays on each device. With Supabase, Mac and iPhone stay in sync automatically after sign-in.

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

Rollout Studio runs on iPhone as a native Capacitor app. Data is stored on-device (no server required on phone).

### Requirements

- macOS with **Xcode** installed from the App Store (Command Line Tools alone is not enough)
- Node.js 18+

### Build and run on simulator or device

```bash
cd rollout-studio
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

1. On one device, open Rollout Studio and tap **Export sync file**
2. AirDrop, email, or save the JSON file
3. On the other device, tap **Import sync file** and choose that file

Newer project edits win when the same project exists on both devices. Checked tasks merge when both copies are present.

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Desktop dev mode (Electron + Vite + API server) |
| `npm start` | Build and launch desktop app |
| `npm run build:ios` | Build web bundle and sync to `ios/` |
| `npm run open:ios` | Open Xcode project |

## Share with others

- **Code:** https://github.com/killscomfort/rollout-studio
- **Desktop:** Share the repo; peers run `npm start` on macOS
- **iPhone:** Share the repo; peers need Xcode to build and install on their devices
