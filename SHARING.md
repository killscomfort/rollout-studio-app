# Sharing Rollout Studio

Rollout Studio is shareable when you connect **one Supabase project** as the backend.

## Hosted backend for Rollout Studio (public release)

The shared cloud project for the public app:

- **Dashboard:** [Supabase project fwsmllrlevehhxdtzzkk](https://supabase.com/dashboard/project/fwsmllrlevehhxdtzzkk)
- **API URL:** `https://fwsmllrlevehhxdtzzkk.supabase.co`
- **Anon key:** Settings → API → `anon` `public` key (never commit the full `.env` to git)

Installers copy `.env.example` → `.env` and paste the anon key. Each user still gets a private account; data is isolated per user via Row Level Security.

**Privacy contact:** killscomfort@gmail.com — see [PRIVACY.md](./PRIVACY.md)

## One-time backend setup (you do this once)

For project **fwsmllrlevehhxdtzzkk**:

1. [Open API settings](https://supabase.com/dashboard/project/fwsmllrlevehhxdtzzkk/settings/api) → copy the **anon public** key into `.env` as `VITE_SUPABASE_ANON_KEY`
2. [SQL Editor](https://supabase.com/dashboard/project/fwsmllrlevehhxdtzzkk/sql/new) → paste and run `supabase/migrations/001_rollout_studio.sql`, then `supabase/migrations/002_release_date.sql`
3. [Authentication → Providers](https://supabase.com/dashboard/project/fwsmllrlevehhxdtzzkk/auth/providers) → enable **Email**
4. Verify locally:

```bash
npm run setup:cloud
```

## Share with your team

Share the repo **and the same `.env` values** with anyone installing the app.

- The anon key is safe to share — Row Level Security keeps each user's data private
- Every person creates their own account inside the app
- Mac, iPhone, and desktop builds all talk to the same cloud backend
- Changes sync automatically (realtime) after sign-in

## Build commands

| Mode | Command | Backend |
|------|---------|---------|
| Auto (reads `.env`) | `npm run dev` | Cloud if `.env` has Supabase, else local SQLite |
| Cloud only | `npm run dev:cloud` | Supabase |
| Local only | `npm run dev:local` | SQLite + Express |
| Cloud desktop build | `npm run start:cloud` | Supabase (no local server) |
| iPhone build | `npm run build:ios` | Uses `.env` Supabase keys when present |

## iPhone calendar reminders

Rollout tasks can be exported as **Apple Calendar events** with alerts (standard Calendar notifications on iPhone).

1. Open a project → **Project settings**
2. Set your **Release date** (the Friday you’re releasing — or use the suggested date)
3. Tap **Add to Apple Calendar** on iPhone (or **Download calendar file** on Mac)
4. Choose a calendar in the share sheet and confirm
5. Make sure **Settings → Notifications → Calendar** is enabled on your iPhone

Each upcoming task becomes a 9:00 AM event with a reminder before it (default 30 minutes). Completed tasks are skipped. Re-export after plan changes to refresh reminders.

### Mac: automatic iCloud sync + Pushcut (from the zip spec)

For hands-free sync while your Mac is awake:

1. Create calendar **KillsComfort Rollout** in Calendar.app (iCloud account)
2. [Generate an app-specific password](https://appleid.apple.com) for iCloud CalDAV
3. Add to `.env`: `ICLOUD_APPLE_ID`, `ICLOUD_APP_PASSWORD`, optional Pushcut keys
4. Set **release date** in Project settings for your rollout
5. Run:

```bash
npm run sync:icloud          # push events to iCloud (iPhone gets native Calendar alerts)
npm run push:nudges          # fire due Pushcut nudges now
npm run sync:notifications   # both
```

Optional timer (every 10 min):

```bash
chmod +x scripts/rollout-notifications/run.sh
cp scripts/rollout-notifications/com.killscomfort.rollout.plist ~/Library/LaunchAgents/
# Edit the plist path if your repo lives elsewhere, then:
launchctl load ~/Library/LaunchAgents/com.killscomfort.rollout.plist
```

**Pushcut (optional):** Install Pushcut on iPhone, create notification **RolloutNudge**, add `PUSHCUT_API_KEY` to `.env`, set `ROLLOUT_PUSH_BY_DEFAULT=1`.

## Local-only (no cloud)

Leave Supabase vars empty in `.env`. The app works on one Mac with SQLite. Use **Export/Import sync file** to move data manually to iPhone.
