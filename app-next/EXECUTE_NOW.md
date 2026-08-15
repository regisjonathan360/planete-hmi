# ⚡ EXECUTE NOW - Recovery Migration

**Status:** Previous migrations partially failed  
**Solution:** Execute ONE migration  
**Time:** 30 seconds

---

## 🎯 What You Need To Do

### 1️⃣ Open Supabase

Go to: https://supabase.com/dashboard

---

### 2️⃣ Open SQL Editor

1. Click **SQL Editor**
2. Click **New Query**

---

### 3️⃣ Copy Migration

Open this file in your editor:
```
app-next/supabase/migrations/20260817_radio_recovery.sql
```

Copy **ENTIRE** content.

---

### 4️⃣ Paste in Supabase

Paste in the SQL Editor (Ctrl+V).

---

### 5️⃣ Execute

Press: **Cmd+Enter** (or Ctrl+Enter on Windows)

---

### 6️⃣ Verify Success

Look for:
- ✅ Green checkmark
- ✅ "Query successful" message
- ❌ NO red error messages

---

## ✨ That's It!

After success:

1. Start server: `npm run dev`
2. Test: http://localhost:3000/admin/radio
3. Configure radio, test playback

---

## 🚨 If Error Occurs

1. Screenshot the error
2. Read RADIO_RECOVERY_GUIDE.md
3. Check troubleshooting section

---

**Execute `20260817_radio_recovery.sql` now** ✅

