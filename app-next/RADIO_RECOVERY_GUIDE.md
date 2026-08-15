# 🔧 Radio System - Recovery Guide

**Problem:** Previous migrations failed with trigger and permission errors  
**Solution:** Use new recovery migration  
**Status:** ✅ Ready to execute

---

## 🚨 Errors Encountered

### Error 1: Trigger Already Exists
```
ERROR: 42710: trigger "update_radio_tracks_updated_at" for relation "radio_tracks" already exists
```

**Cause:** First migration already partially executed, triggers already created.

### Error 2: Permission Denied on System Trigger
```
ERROR: 42501: permission denied: "RI_ConstraintTrigger_c_21047" is a system trigger
```

**Cause:** Migration tried to drop system-level constraint triggers (these are created by database system, not by user migrations).

---

## ✅ Solution: Use Recovery Migration

A new recovery migration has been created that handles all these issues:

**File:** `supabase/migrations/20260817_radio_recovery.sql`

**What it does:**
- ✅ Uses `IF NOT EXISTS` for all table creation (won't fail if exists)
- ✅ Drops user-created triggers safely with CASCADE
- ✅ Avoids touching system triggers
- ✅ Creates all functions with `CREATE OR REPLACE`
- ✅ Drops and recreates policies safely
- ✅ Verifies final state

---

## 🚀 Deploy Recovery Migration

### STEP 1: DO NOT Run Previous Migrations Again

**Skip these:**
- ❌ `20260811_radio_system.sql` - Already partially done
- ❌ `20260815_radio_fix_conflicts.sql` - Not needed
- ❌ `20260816_radio_fixes.sql` - Has issues with system triggers

### STEP 2: Run ONLY the Recovery Migration

**File:** `supabase/migrations/20260817_radio_recovery.sql`

**Instructions:**
1. Go to https://supabase.com/dashboard
2. SQL Editor → New Query
3. Copy entire content of `20260817_radio_recovery.sql`
4. Execute (Cmd+Enter)
5. Should see: ✅ Query successful

**Expected Output:**
```
Radio System Recovery | 1 | true
Tables Created        | 6 | (success)
RPC Functions         | 3 | (success)
```

---

## ✅ Verify Recovery Success

After executing the recovery migration, run these verification queries:

### Check Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'radio_%'
ORDER BY table_name;
```

**Should return 6 rows:**
- radio_config
- radio_play_history
- radio_playlist_tracks
- radio_playlists
- radio_stats
- radio_tracks

### Check RPC Functions
```sql
SELECT proname 
FROM pg_proc 
WHERE proname IN ('increment_track_play_count', 'get_active_radio_playlist', 'get_chart_radio_tracks')
ORDER BY proname;
```

**Should return 3 rows:**
- get_active_radio_playlist
- get_chart_radio_tracks
- increment_track_play_count

### Check Configuration
```sql
SELECT 
  active_playlist_id,
  preload_count,
  crossfade_duration_ms,
  is_live
FROM radio_config
LIMIT 1;
```

**Should return:**
- active_playlist_id: NULL (or UUID if previously set)
- preload_count: 3
- crossfade_duration_ms: 2000
- is_live: true

### Check Triggers
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name LIKE 'update_radio%'
ORDER BY trigger_name;
```

**Should return 3 rows:**
- update_radio_config_updated_at | radio_config
- update_radio_playlists_updated_at | radio_playlists
- update_radio_tracks_updated_at | radio_tracks

---

## 🎯 After Recovery

### STEP 1: Clean Dummy Data (Optional)

If you want to remove test data:

**File:** `supabase/migrations/20260816_remove_dummy_data.sql`

**Instructions:**
1. New Query
2. Copy content
3. Execute
4. Should complete without errors

---

### STEP 2: Start Development Server

```bash
cd app-next
npm run dev
```

**Expected:** Server starts successfully

---

### STEP 3: Test Admin Page

1. Open http://localhost:3000/admin/radio
2. Should load without errors
3. See available classements
4. Can select and apply a source

---

### STEP 4: Test Playback

1. Open http://localhost:3000
2. Radio player visible (bottom-right)
3. Click play
4. Audio plays without errors

---

## 🔍 Troubleshooting

### If Recovery Migration Fails

**Check the error:**
1. Look at the error message
2. Screenshot the exact error
3. Check if it mentions "system trigger" or "permission denied"

**Try this:**
1. Run verification queries above to see current state
2. Manually check what tables exist
3. If specific table/trigger is blocking, may need different approach

### If Tables Don't Exist

Run this to check:
```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%radio%';
```

If empty, the recovery migration didn't create tables. Try:
1. Check for error messages in migration output
2. Verify Supabase connection is working
3. Try running migration again

### If Functions Don't Exist

Run this:
```sql
SELECT * FROM pg_proc WHERE proname LIKE 'increment%' OR proname LIKE 'get_%radio%';
```

If empty, functions weren't created. Try:
1. Check migration output for errors
2. Manually create functions with provided SQL
3. Contact support if persistent

### If Triggers Don't Exist

```sql
SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public';
```

If none found, the migration didn't create them. Try:
1. Check for error messages
2. Verify trigger function exists first
3. Run CREATE TRIGGER statements manually

---

## 📊 What Changed

### Previous Approach
- ❌ Multiple separate migrations
- ❌ No IF EXISTS protection
- ❌ Fragile to partial execution
- ❌ Failed on duplicate objects

### New Recovery Approach
- ✅ Single comprehensive migration
- ✅ IF EXISTS for tables and indexes
- ✅ CREATE OR REPLACE for functions
- ✅ DROP...CASCADE for triggers
- ✅ DROP and recreate policies
- ✅ Handles all edge cases

---

## ✨ Key Differences

### `20260811_radio_system.sql` (Original)
```sql
CREATE TABLE radio_tracks (...)  -- Fails if exists
CREATE TRIGGER ... -- Fails if exists
```

### `20260817_radio_recovery.sql` (Recovery)
```sql
CREATE TABLE IF NOT EXISTS radio_tracks (...)  -- Safe if exists
DROP TRIGGER IF EXISTS ... CASCADE;  -- Safe cleanup
CREATE TRIGGER ... -- Creates fresh
```

---

## 🎉 You're Back on Track!

After running the recovery migration:

- ✅ All tables exist
- ✅ All triggers in place
- ✅ All functions created
- ✅ Configuration set
- ✅ Ready for admin/playback

---

## 📝 Summary

| Step | Migration | Status |
|------|-----------|--------|
| 1 | 20260811_radio_system.sql | ❌ Skip (already partially done) |
| 2 | 20260815_radio_fix_conflicts.sql | ❌ Skip (not needed) |
| 3 | 20260816_radio_fixes.sql | ❌ Skip (has system trigger issue) |
| **4** | **20260817_radio_recovery.sql** | **✅ EXECUTE THIS** |
| 5 | 20260816_remove_dummy_data.sql | ✅ Optional (cleanup) |

---

**Ready to recover!** Execute `20260817_radio_recovery.sql` in Supabase SQL Editor. 🚀

