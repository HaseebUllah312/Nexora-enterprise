# Database Setup Guide for Nexora Enterprise ERP

## Overview
Your new Supabase database is at:
- **Host**: db.fctjzqjimehwsowjrrgc.supabase.co
- **Database**: postgres
- **User**: postgres
- **Password**: SOFtware@312123

---

## Step 1: Prepare the Backend

1. Navigate to the backend folder:
   ```powershell
   cd "C:\Users\Haseeb\Downloads\factory-erp-pro-FINAL (1)\factory-erp-pro\backend"
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Generate Prisma client:
   ```powershell
   npm run prisma:generate
   ```

---

## Step 2: Run Database Migrations

This will create all the required tables in your Supabase database:

```powershell
npm run prisma:migrate
```

When prompted, name the migration something like:
- `initial_setup`
- `create_tables`

Wait for this to complete. You should see all tables created in Supabase.

---

## Step 3: Seed the Database

Seed creates the core branches, users, roles, and settings:

```powershell
npm run prisma:seed
```

This will create:

### Branches
- Main Factory
- Lahore Branch
- Gujranwala Branch

### Users (Login Credentials)
1. **Super Admin**
   - Email: `haseebsaleem312@gmail.com`
   - Password: `HaseebDev@2024`
   - Role: SUPER_ADMIN
   - Branch: All

2. **Owner**
   - Email: `owner@factoryerp.pk`
   - Password: `Owner@2024`
   - Role: OWNER
   - Branch: All

3. **Lahore Manager**
   - Email: `lahore@factoryerp.pk`
   - Password: `Lahore@2024`
   - Role: BRANCH_MANAGER
   - Branch: Lahore

4. **Gujranwala Manager**
   - Email: `gujranwala@factoryerp.pk`
   - Password: `Gujranwala@2024`
   - Role: BRANCH_MANAGER
   - Branch: Gujranwala

---

## Step 4: Verify Database Connection

Test the connection to confirm it works:

```powershell
npm run prisma:studio
```

This opens Prisma Studio at `http://localhost:5555` where you can:
- View all tables
- Verify branches were created
- Verify users were created
- Test queries

If this loads successfully, your database is connected and ready.

---

## Step 5: Modify Branches (if needed)

If you want to rename branches to match your structure (e.g., Gujranwala 1, Gujranwala 2), run in Prisma Studio:

1. Go to the **Branch** table
2. Click on each branch row
3. Edit the **name** field:
   - "Main Factory" → stays the same
   - "Lahore Branch" → stays the same (or rename to Lahore 1, Lahore 2, etc.)
   - "Gujranwala Branch" → rename to "Gujranwala 1"
   - Add new branch "Gujranwala 2" manually in Prisma Studio

---

## Step 6: Add New Branches (optional)

If you need "Gujranwala 2" as a separate branch:

1. In Prisma Studio, go to **Branch** table
2. Click "Create"
3. Fill in:
   - **name**: Gujranwala 2
   - **code**: GUJ2
   - **city**: Gujranwala
   - **address**: (your address)
   - **phone**: (your phone)
   - **isMainBranch**: false
   - **isActive**: true

4. Create a manager user for Gujranwala 2:
   - Email: `gujranwala2@factoryerp.pk`
   - Password: `Gujranwala2@2024`
   - Role: BRANCH_MANAGER
   - Branch: Gujranwala 2

---

## Step 7: Test Login

Start the backend:

```powershell
npm run start:dev
```

You should see:
```
[Nest] ... - 07/17/2026 ... [NestFactory] Nest application successfully started +123ms
```

Try logging in with one of the test accounts:
- Email: `gujranwala@factoryerp.pk`
- Password: `Gujranwala@2024`

---

## Step 8: Prepare Desktop App

1. Edit `backend\.env`:
   ```
   SYNC_TARGET_URL="http://your-server/api/v1/sync"
   SYNC_SECRET="your-chosen-sync-secret"
   ```

2. Build the desktop app:
   ```powershell
   cd "C:\Users\Haseeb\Downloads\factory-erp-pro-FINAL (1)\factory-erp-pro\desktop"
   npm run build-and-dist
   ```

3. Find the installer:
   - `desktop/release/Nexora Enterprise Setup 1.0.0.exe`

---

## Step 9: Deploy to Client Laptops

1. **Install on Laptop 1 (Gujranwala 1)**:
   - Run the EXE
   - Login as: `gujranwala@factoryerp.pk` / `Gujranwala@2024`
   - Configure sync settings
   - Test sync

2. **Install on Laptop 2 (Gujranwala 2)**:
   - Run the same EXE
   - Login as: `gujranwala2@factoryerp.pk` / `Gujranwala2@2024`
   - Configure sync settings
   - Test sync

3. **Admin Laptop**:
   - Run the EXE
   - Login as: `owner@factoryerp.pk` / `Owner@2024`
   - Can see all branches

---

## Step 10: Verify Everything Works

Once deployed:

- [ ] Laptop 1 can login and see only Gujranwala 1 data
- [ ] Laptop 2 can login and see only Gujranwala 2 data
- [ ] Admin can login and see all branches
- [ ] Sync queue is empty (no stuck records)
- [ ] Creating orders on one laptop syncs to the server

---

## Quick Commands Reference

```powershell
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Open Prisma Studio (view/edit data)
npm run prisma:studio

# Start backend dev server
npm run start:dev

# Build backend
npm run build

# Build desktop app
npm run build-and-dist
```

---

## Troubleshooting

### "Cannot find module '@prisma/client'"
- Run: `npm run prisma:generate`

### "Database connection refused"
- Check DATABASE_URL in .env
- Verify Supabase network access

### "Migration failed"
- Check Prisma schema for errors
- Run: `npm run prisma:migrate` again

### Desktop sync fails
- Clear `%APPDATA%\nexora-enterprise-desktop\sync-state.json`
- Restart app

---

## Summary

Your new system has:
- ✅ Fresh Supabase database
- ✅ Three branches set up
- ✅ Four test users (owner, super-admin, gujranwala mgr, lahore mgr)
- ✅ One desktop EXE for all laptops
- ✅ Branch-aware login (each user sees only their branch)
- ✅ Fixed sync logic (no FK errors)

Each laptop logs in with its own account → sees only its branch → syncs cleanly.

