# NEXORA ENTERPRISE ERP — FINAL HANDOVER PACKAGE

## What's Fixed

### Software Changes Made:
1. **Desktop Sync Engine** (`backend/src/sync/sync.service.ts`)
   - Now resolves and includes dependent records before push
   - Prevents FK failures like `products_categoryId_fkey`

2. **Backend Sync API** (`frontend/app/api/v1/sync/route.ts`)
   - Auto-expands dependencies on the server
   - Uses stable identifiers (branch code, user email, role name) instead of only UUIDs
   - Matches records reliably across machines

3. **Remote Change Application** (`backend/src/sync/sync.service.ts`)
   - Uses stable unique keys for upserts (not just IDs)
   - So branch/user mismatches no longer break sync

---

## What You Have Now

### 1. New Database (Supabase)
- URL: `postgresql://postgres:SOFtware@312123@db.fctjzqjimehwsowjrrgc.supabase.co:5432/postgres`
- Fresh, empty, ready to seed
- See: `DATABASE_SETUP_GUIDE.md`

### 2. Windows Installer
- Location: `desktop/release/Nexora Enterprise Setup 1.0.0.exe`
- One EXE for all laptops
- Branch-aware login
- Fixed sync logic

### 3. Three Test Branches (to be created during seeding)
- Main Factory
- Lahore Branch
- Gujranwala Branch
- (Can be renamed/split as needed during setup)

### 4. Four Test Users (to be created during seeding)
- Super Admin: `haseebsaleem312@gmail.com` / `HaseebDev@2024`
- Owner: `owner@factoryerp.pk` / `Owner@2024`
- Lahore Manager: `lahore@factoryerp.pk` / `Lahore@2024`
- Gujranwala Manager: `gujranwala@factoryerp.pk` / `Gujranwala@2024`

---

## Next Steps for You

### STEP 1: Setup Database (15 min)
```powershell
cd backend
npm install
npm run prisma:migrate
npm run prisma:seed
npm run prisma:studio
```
Verify all tables and users are created in Prisma Studio.

### STEP 2: Test Backend Locally (5 min)
```powershell
npm run start:dev
```
Try logging in with a test account.

### STEP 3: Deploy to Client Laptops (per laptop: 5 min)
1. Copy `desktop/release/Nexora Enterprise Setup 1.0.0.exe` to each laptop
2. Run installer
3. On each laptop:
   - Laptop 1: Login as `gujranwala@factoryerp.pk`
   - Laptop 2: Login as `lahore@factoryerp.pk` (or create new Gujranwala 2 manager)
4. Configure sync URL and secret in app settings
5. Test sync

### STEP 4: Verify (10 min)
- [ ] Laptop 1 can login and see only its branch
- [ ] Laptop 2 can login and see only its branch
- [ ] Admin can login and see all branches
- [ ] Sync works without FK errors
- [ ] Creating data on one laptop syncs to another

---

## Key Architecture

```
ONE EXE → Multiple Laptops
   ↓
LOGIN with Branch User
   ↓
APP shows only that Branch's data
   ↓
SYNC to Cloud Database
   ↓
Other Laptops Pull Changes
```

This is clean, scalable, and consistent.

---

## File Locations

| File | Location |
|------|----------|
| Database Setup Guide | `DATABASE_SETUP_GUIDE.md` |
| Backend .env (updated) | `backend/.env` |
| Sync Logic (fixed) | `backend/src/sync/sync.service.ts` |
| Sync API (fixed) | `frontend/app/api/v1/sync/route.ts` |
| Desktop Installer | `desktop/release/Nexora Enterprise Setup 1.0.0.exe` |

---

## Support Notes for Client

### For Gujranwala 1 Laptop
```
Email: gujranwala@factoryerp.pk
Password: Gujranwala@2024
Branch: Gujranwala Branch
```

### For Gujranwala 2 Laptop (if created)
```
Email: gujranwala2@factoryerp.pk
Password: Gujranwala2@2024
Branch: Gujranwala 2
```

### For Admin
```
Email: owner@factoryerp.pk
Password: Owner@2024
Branch: All
```

---

## Backup Plan

If a laptop gets stuck:
1. Delete: `%APPDATA%\nexora-enterprise-desktop\sync-state.json`
2. Delete: `%APPDATA%\nexora-enterprise-desktop\factory_erp.db` (if very stuck)
3. Restart app
4. Reconfigure sync settings
5. App will resync from server

---

## Success Criteria

✅ All laptops can login with their branch accounts
✅ Each laptop shows only its branch data
✅ Sync works without errors
✅ Data created on one laptop appears on others
✅ No FK errors in sync logs

---

## Questions?

Refer to:
- `DATABASE_SETUP_GUIDE.md` for step-by-step database setup
- The code comments in sync files for sync logic details
- Desktop app settings for sync configuration

Good luck! 🚀
