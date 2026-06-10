# Sharing Rollout Studio

Rollout Studio is shareable when you connect **one Supabase project** as the backend.

## One-time backend setup (you do this once)

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_rollout_studio.sql` in **SQL Editor**
3. Enable **Email** auth under **Authentication → Providers**
4. Copy `.env.example` → `.env` and paste your **Project URL** + **anon key**
5. Verify:

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
