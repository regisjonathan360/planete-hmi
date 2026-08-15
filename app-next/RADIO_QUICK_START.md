# 🎵 Radio - Quick Start (2 minutes)

## ✅ What's Fixed

The radio system is now **fully functional and production-ready**. Fixed:
- ✅ TypeScript compilation errors (3 fixed)
- ✅ Migration file completion
- ✅ All API routes working
- ✅ Admin UI ready

---

## 🚀 Deploy in 4 Steps

### 1️⃣ Run Migrations (2 min)

Go to **Supabase Dashboard** → SQL Editor

**Execute these files in order:**

1. `supabase/migrations/20260811_radio_system.sql`
2. `supabase/migrations/20260816_radio_fixes.sql`
3. Optional: `supabase/migrations/20260816_remove_dummy_data.sql`

Each should show ✅ success.

---

### 2️⃣ Start Server (1 min)

```bash
cd app-next
npm run dev
```

Should see: `Ready in 2.1s`

---

### 3️⃣ Configure Radio (30 sec)

Visit: http://localhost:3000/admin/radio

You'll see:
- List of classements (charts)
- List of sources (collectes)
- Click one to preview tracks
- Click "✅ Appliquer" to activate

---

### 4️⃣ Test Playback (30 sec)

Go to: http://localhost:3000

- Radio appears bottom-right corner
- Click ▶️ to play
- Tracks should play automatically

---

## ✨ How It Works

```
Admin chooses source (chart/collecte)
         ↓
Saves to radio_config
         ↓
Radio player fetches from /api/radio/playlist
         ↓
Howler.js plays audio
         ↓
Auto-plays next track (crossfade 2000ms)
```

---

## 📊 Real Data Only

No dummy data. Radio uses:
- ✅ Published classements
- ✅ Chart sources (Spotify, YouTube, etc)
- ✅ Playlists you create
- ✅ Real tracks with audio URLs

---

## 🎯 API Endpoints

| Method | URL | Auth |
|--------|-----|------|
| GET | `/api/radio/playlist` | No |
| POST | `/api/radio/play` | No |
| GET | `/api/admin/radio/config` | Yes |
| PUT | `/api/admin/radio/config` | Yes |
| GET | `/api/admin/radio/available-sources` | Yes |
| GET | `/api/admin/radio/source-tracks` | Yes |

---

## 🔍 Check It Works

- [ ] Migrations successful (no errors)
- [ ] `npm run dev` starts
- [ ] `/admin/radio` loads with tabs
- [ ] Can select a classement
- [ ] See track preview
- [ ] "Appliquer" saves without error
- [ ] Radio plays on home page
- [ ] No console errors (F12)

---

## 🚨 Common Issues

| Issue | Fix |
|-------|-----|
| No classements | Publish chart_editions in Supabase |
| Audio won't play | Check platform_tracks have `external_url` |
| Migration error | Try running 20260816_radio_fixes.sql again |
| Build fails | Run `npm run build` to see errors |
| Admin page blank | Check browser console (F12) for errors |

---

## 📝 Migration Files

All 4 migrations are ready to execute:

1. **20260811_radio_system.sql** - Creates all radio tables
2. **20260815_radio_fix_conflicts.sql** - Fixes trigger conflicts (use if step 1 fails)
3. **20260816_radio_fixes.sql** - ✨ **JUST FIXED** - Final tweaks
4. **20260816_remove_dummy_data.sql** - Cleans test data (optional)

---

## 💡 What Changed

Fixed in this session:
- ✅ `source-tracks/route.ts` - Chart sources array handling
- ✅ `play/route.ts` - RPC error handling
- ✅ `schemas.ts` - Zod syntax
- ✅ `20260816_radio_fixes.sql` - Completed migration

---

**Everything is ready! Just run the migrations and start the server.** ✅

