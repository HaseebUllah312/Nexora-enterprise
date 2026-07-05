# Factory ERP Pro — Option A (Desktop App + Supabase + Vercel) Deployment Guide

This guide explains how to deploy the ERP system with **Option A**:
1. **Desktop App (`.exe`)** installed on the factory PC (runs locally, accesses the cloud database).
2. **Supabase (Free)** hosted PostgreSQL database in the cloud (stores all data securely).
3. **Vercel (Free)** hosted frontend dashboard for the owner/admin (accesses the same Supabase database).

---

## 🏗️ How it Works

```
👷 Factory Staff (at factory)          👔 Owner/Admin (anywhere — phone, laptop)
        │                                        │
        ▼                                        ▼
┌──────────────────┐                   ┌──────────────────┐
│  Desktop App     │                   │  Vercel Website  │
│  (.exe installed │                   │  (opens in any   │
│   like MS Word)  │                   │   browser)       │
└────────┬─────────┘                   └────────┬─────────┘
         │                                      │
         │  All data saved to cloud             │  Reads same data
         ▼                                      ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE (Free)                       │
│              Cloud PostgreSQL Database                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step 1: Create a Supabase Database (Free)

1. Go to [supabase.com](https://supabase.com) and sign up for a free account.
2. Click **New Project** and configure:
   - **Name**: `factory-erp-db`
   - **Database Password**: Write this down safely.
   - **Region**: Choose the closest one to your factory.
3. Once the database is created, navigate to **Project Settings** → **Database**.
4. Scroll down to **Connection string** → click **URI** → copy the connection string.
   - For your project, the pooler string is: `postgresql://postgres.xyxbsebdovvmcmzingmh:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
   - Note: The `@` character in your password must be URL-encoded as `%40` in the connection string (e.g. `Factory@123232` becomes `Factory%40123232`).

---

## 💻 Step 2: Build the Desktop App Installer

On your development machine, configure the connection:

1. Create a `.env` file in the `backend` folder containing the connection details:
   ```env
    # Migration port (5432) is used for database setup commands
    DATABASE_URL="postgresql://postgres.xyxbsebdovvmcmzingmh:Factory%40123232@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
    JWT_ACCESS_SECRET="replace-with-64-char-random-string"
    JWT_REFRESH_SECRET="replace-with-different-64-char-random-string"
    PORT=4000
    NODE_ENV=production
    CORS_ORIGIN="http://localhost:3000"

    # Synchronization Settings
    SYNC_TARGET_URL="https://your-factory-erp.vercel.app/api/v1/sync"
    SYNC_SECRET="some-secure-random-secret"
    ```
2. Run database migrations to set up the tables on Supabase:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
3. Prepare the desktop application folders:
   ```bash
   cd ../desktop
   npm install
   ```
4. Run the build script in the root directory:
   ```bash
   cd ..
   node desktop/build.js
   ```
5. Build the installer package:
   ```bash
   cd desktop
   npm run dist
   ```
6. The installer `Factory ERP Pro Setup 1.0.0.exe` is created in `desktop/release/`. Copy this file to any Windows machine.

---

## 👷 Step 3: Run the Desktop App on Factory PC

1. Run the installer on the factory PC. It will install the application and place a shortcut on the desktop.
2. In the app's user data directory (or next to the executable), create a `.env` file containing the **same** configurations as above:
   - `DATABASE_URL` (points to the Supabase URL; the app will automatically copy this to `SUPABASE_DATABASE_URL` and swap it for a local SQLite database for zero-config offline operations).
   - `SYNC_TARGET_URL` (points to your Vercel deployment URL `/api/v1/sync`).
   - `SYNC_SECRET` (must match Vercel).
3. Open the desktop app from the shortcut. It will start, auto-initialize the SQLite database, seed it, and start the local servers. If offline, the app functions normally. When online, it pushes sync logs to Supabase in batches!

---

## ⚡ Step 4: Deploy the Frontend on Vercel

1. Push your code repository to GitHub (ensure `.env` files are ignored, they should not be on GitHub).
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Configure the Project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
4. Expand **Environment Variables** and add the following keys:
   - `DATABASE_URL`: The exact same Supabase connection string.
   - `JWT_ACCESS_SECRET`: The exact same random key used in the backend `.env`.
   - `JWT_REFRESH_SECRET`: The exact same refresh secret used in the backend `.env`.
   - `NEXT_PUBLIC_API_URL`: `/api/v1` (this tells the frontend to use Vercel's built-in API routes).
   - `SYNC_SECRET`: The exact same sync secret used on the desktop app.
5. Click **Deploy**. Vercel will build the frontend and deploy the website.

---

## 👔 Step 5: Access the ERP Web Dashboard

1. Open your browser and go to your Vercel deployment URL (e.g., `https://your-factory-erp.vercel.app`).
2. Log in using the admin account.
3. You will see a live dashboard reflecting all sales, transactions, invoices, and stock logs created on the factory PC desktop app!
4. You can remotely print invoices, check customer accounts, and view stock status in real-time.
