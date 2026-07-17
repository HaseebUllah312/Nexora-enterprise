# Quick Setup Checklist ✓

## Backend Database Setup (Run on your development machine)

- [ ] Open `backend` folder
- [ ] Run: `npm install`
- [ ] Run: `npm run prisma:migrate`
- [ ] Run: `npm run prisma:seed`
- [ ] Run: `npm run prisma:studio` (verify tables exist)
- [ ] Run: `npm run start:dev` (verify backend starts)

## Desktop App Build

- [ ] Navigate to `desktop` folder
- [ ] Run: `npm run build-and-dist`
- [ ] Confirm file exists: `desktop/release/Nexora Enterprise Setup 1.0.0.exe`

## Client Laptop 1 Setup (Gujranwala)

- [ ] Copy `Nexora Enterprise Setup 1.0.0.exe` to Laptop 1
- [ ] Run installer
- [ ] Launch app
- [ ] Login as: `gujranwala@factoryerp.pk` / `Gujranwala@2024`
- [ ] Go to Settings
- [ ] Configure Sync Settings:
  - Sync URL: `http://your-server-address/api/v1/sync`
  - Sync Secret: (ask admin)
  - Database URL: (ask admin)
- [ ] Click Save
- [ ] Verify sync starts (check sync status)

## Client Laptop 2 Setup (Lahore)

- [ ] Copy `Nexora Enterprise Setup 1.0.0.exe` to Laptop 2
- [ ] Run installer
- [ ] Launch app
- [ ] Login as: `lahore@factoryerp.pk` / `Lahore@2024`
- [ ] Configure Sync Settings (same as Laptop 1)
- [ ] Click Save
- [ ] Verify sync starts

## Test Sync

- [ ] On Laptop 1: Create a test customer
- [ ] Wait 30 seconds
- [ ] On Laptop 2: Check if customer appears
- [ ] ✓ If it appears → Sync is working!

## Production Checklist

- [ ] All users have correct branch assignment
- [ ] All users can login and see their branch data
- [ ] Admin can login and see all branches
- [ ] No sync errors in either laptop
- [ ] Data created on one laptop syncs to others
- [ ] Backup of database credentials saved

---

## Passwords to Change

After initial setup, change these passwords in the app:

- [ ] Admin: `owner@factoryerp.pk`
- [ ] Super Admin: `haseebsaleem312@gmail.com`
- [ ] Gujranwala Manager: `gujranwala@factoryerp.pk`
- [ ] Lahore Manager: `lahore@factoryerp.pk`

---

## Emergency Recovery

If a laptop is stuck:

```powershell
# Delete sync state
Remove-Item $env:APPDATA\nexora-enterprise-desktop\sync-state.json

# Delete local database (only if very stuck)
Remove-Item $env:APPDATA\nexora-enterprise-desktop\factory_erp.db

# Restart app
```

---

## Done! 🎉

When all checks pass, the system is ready for production use.
