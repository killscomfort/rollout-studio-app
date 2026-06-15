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
2. [SQL Editor](https://supabase.com/dashboard/project/fwsmllrlevehhxdtzzkk/sql/new) → paste and run `supabase/migrations/001_rollout_studio.sql`
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

## Local-only (no cloud)

Leave Supabase vars empty in `.env`. The app works on one Mac with SQLite. Use **Export/Import sync file** to move data manually to iPhone.
