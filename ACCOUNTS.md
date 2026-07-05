# FactoryERP Pro — Account Credentials

Run `npx ts-node prisma/seed.ts` from the `backend/` folder to create all accounts.

---

## Account 1 — Developer / Super Admin

| Field    | Value                          |
|----------|-------------------------------|
| Email    | haseebsaleem312@gmail.com     |
| Password | HaseebDev@2024                |
| Role     | SUPER_ADMIN                   |
| Access   | **Everything** — all branches, all data, all settings |

**Can do:**
- See every branch's data consolidated and individually
- Add, edit, disable, or remove any user account
- Reset any user's password (without knowing their old password)
- Access every module: sales, purchases, inventory, accounting, manufacturing, HR, reports, AI
- Cannot be deleted or disabled via the UI (system protection)

---

## Account 2 — Factory Owner

| Field    | Value              |
|----------|--------------------|
| Email    | owner@factoryerp.pk |
| Password | Owner@2024          |
| Role     | OWNER               |
| Access   | All branches — consolidated dashboard |

**Can do:**
- See the consolidated owner dashboard with all branch KPIs
- View branch performance charts
- Add/edit customers, suppliers, products across all branches
- Access AI Analytics for cross-branch insights
- Cannot reset other users' passwords (only SUPER_ADMIN can)

---

## Account 3 — Lahore Branch Manager

| Field    | Value                   |
|----------|------------------------|
| Email    | lahore@factoryerp.pk    |
| Password | Lahore@2024             |
| Role     | BRANCH_MANAGER          |
| Branch   | Lahore Branch (LHR)     |
| Access   | **Lahore data only**    |

**Can do:**
- See dashboard with only Lahore sales, stock, and accounts
- Create sales orders and invoices for Lahore customers only
- Manage Lahore stock (stock in/out, adjustments)
- View and approve stock transfers involving Lahore
- Cannot see Gujranwala, Main Factory, or any other branch's data

**Data isolation:** The system automatically scopes all queries to branchId=LHR.
Even if someone tries to pass a different branchId in the URL, the server overrides it.

---

## Account 4 — Gujranwala Branch Manager

| Field    | Value                        |
|----------|------------------------------|
| Email    | gujranwala@factoryerp.pk     |
| Password | Gujranwala@2024              |
| Role     | BRANCH_MANAGER               |
| Branch   | Gujranwala Branch (GUJ)      |
| Access   | **Gujranwala data only**     |

**Can do:**
- Same as Lahore Branch Manager but for Gujranwala
- All data is completely separate from Lahore

---

## Password Reset Policy

**Any user** can change their own password from Settings → Change Password.
They must know their current password.

**SUPER_ADMIN only** (haseebsaleem312@gmail.com) can reset any other user's
password from the Users & Access page without knowing their current password.
This also revokes all active sessions for that user.

---

## Adding More Branch Users

Login as SUPER_ADMIN → Dashboard → Users & Access → Add User

Example: add a Sales Staff member for Lahore:
- Role: `SALES_STAFF`
- Branch: `Lahore Branch`
- They will only ever see Lahore data

---

## Changing Credentials in Production

Before going live, change all passwords:
1. Login as each account
2. Go to Settings → Change Password
3. Set a strong password

Or login as SUPER_ADMIN and use Reset Password from Users & Access.
