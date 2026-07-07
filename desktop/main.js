const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// ─── Logging Setup ──────────────────────────────────────────────────────────
let logStream = null;
function logToFile(tag, msg) {
  if (!app.isReady()) return;
  if (!logStream) {
    try {
      const logDir = app.getPath('userData');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logPath = path.join(logDir, 'combined.log');
      logStream = fs.createWriteStream(logPath, { flags: 'a' });
    } catch (e) {
      return;
    }
  }
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${tag}] ${msg.trim()}\n`;
  logStream.write(line);
}

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  originalLog.apply(console, args);
  logToFile('Info', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
};

console.error = (...args) => {
  originalError.apply(console, args);
  logToFile('Error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
};

// ─── Configuration ──────────────────────────────────────────────────────────
const BACKEND_PORT = 4000;
const FRONTEND_PORT = 3005;
const IS_PACKAGED = app.isPackaged;
const NODE_EXECUTABLE = IS_PACKAGED
  ? path.join(__dirname, 'node-bin', 'node.exe')
  : 'node';

let mainWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;
let splashWindow = null;

// ─── Paths ──────────────────────────────────────────────────────────────────
function getAppRoot() {
  if (IS_PACKAGED) {
    return path.dirname(app.getPath('exe'));
  }
  return path.resolve(__dirname, '..');
}

function getResourcePath(...segments) {
  if (IS_PACKAGED) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(__dirname, ...segments);
}

// ─── Environment Setup ─────────────────────────────────────────────────────
function loadEnv() {
  // Look for .env in the app's user data directory first, then next to the exe
  const userDataEnv = path.join(app.getPath('userData'), '.env');
  const appRootEnv = path.join(getAppRoot(), '.env');
  const defaultsEnv = path.join(__dirname, '.env.defaults');

  const filesToLoad = [];
  if (fs.existsSync(defaultsEnv)) filesToLoad.push(defaultsEnv);
  if (fs.existsSync(appRootEnv)) filesToLoad.push(appRootEnv);
  if (fs.existsSync(userDataEnv)) filesToLoad.push(userDataEnv);

  if (filesToLoad.length > 0) {
    filesToLoad.forEach(envPath => {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) return;
        const key = trimmed.substring(0, eqIndex).trim();
        let val = trimmed.substring(eqIndex + 1).trim();
        // Remove surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      });
      console.log(`[ERP] Loaded/Overridden env from: ${envPath}`);
    });
  } else {
    console.warn('[ERP] No .env file found! Please create one next to the executable.');
  }
}

function freePort(port) {
  if (process.platform !== 'win32') return;
  try {
    const { execSync } = require('child_process');
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && pid !== String(process.pid)) {
        console.log(`[ERP] Port ${port} is held by PID ${pid}. Killing it...`);
        execSync(`taskkill /F /PID ${pid}`, { windowsHide: true });
      }
    }
  } catch (e) {
    // ignore if no process is listening on the port
  }
}

// ─── Port Check ─────────────────────────────────────────────────────────────
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, '127.0.0.1');
  });
}

function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} did not become available within ${timeoutMs}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
      socket.on('timeout', () => {
        socket.destroy();
        setTimeout(check, 500);
      });
      socket.connect(port, '127.0.0.1');
    };
    check();
  });
}

// ─── Splash Screen ──────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 450,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const splashPath = IS_PACKAGED
    ? path.join(__dirname, 'splash.html')
    : path.join(__dirname, 'splash.html');

  splashWindow.loadFile(splashPath);
  splashWindow.center();
}

// ─── Backend Process ────────────────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const nodeExecutable = NODE_EXECUTABLE;

    let backendEntry;
    let cwd;

    if (IS_PACKAGED) {
      backendEntry = path.join(__dirname, 'backend-dist', 'src', 'main.js');
      cwd = path.join(__dirname, 'backend-dist');
    } else {
      backendEntry = path.join(getAppRoot(), 'backend', 'dist', 'src', 'main.js');
      cwd = path.join(getAppRoot(), 'backend');
    }

    if (!fs.existsSync(backendEntry)) {
      reject(new Error(`Backend entry not found: ${backendEntry}`));
      return;
    }

    const nodeModulesPath = IS_PACKAGED
      ? path.join(__dirname, 'backend-node_modules')
      : path.join(getAppRoot(), 'backend', 'node_modules');

    const prismaCacheDir = path.join(app.getPath('userData'), 'prisma-cache');
    if (!fs.existsSync(prismaCacheDir)) {
      fs.mkdirSync(prismaCacheDir, { recursive: true });
    }

    const env = {
      ...process.env,
      PORT: String(BACKEND_PORT),
      NODE_ENV: 'production',
      CORS_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
      NODE_PATH: nodeModulesPath,
      PRISMA_BINARY_CACHE_DIR: prismaCacheDir,
      PRISMA_CACHE_DIR: prismaCacheDir,
      CACHE_DIR: prismaCacheDir,
      USER_DATA_PATH: app.getPath('userData'),
      ...(IS_PACKAGED ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    };

    // For packaged app, use the embedded node via electron's fork
    // We use spawn with the electron binary running as node
    backendProcess = spawn(nodeExecutable, ['--no-warnings', backendEntry], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log(`[Backend] ${msg}`);
      if (msg.includes('FactoryERP Pro API')) {
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString()}`);
    });

    backendProcess.on('error', (err) => {
      console.error('[Backend] Failed to start:', err);
      reject(err);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[Backend] Process exited with code ${code}`);
      if (code !== 0 && code !== null) {
        reject(new Error(`Backend exited with code ${code}`));
      }
    });

    // Timeout fallback — if backend doesn't print startup msg, wait for port
    setTimeout(async () => {
      try {
        await waitForPort(BACKEND_PORT, 15000);
        resolve();
      } catch (e) {
        reject(e);
      }
    }, 3000);
  });
}

// ─── Database Initialization ────────────────────────────────────────────────
function runPrismaDbPush() {
  return new Promise((resolve, reject) => {
    const nodeExecutable = NODE_EXECUTABLE;
    let prismaCliPath;
    let schemaPath;
    let cwd;

    if (IS_PACKAGED) {
      prismaCliPath = path.join(__dirname, 'backend-node_modules', 'prisma', 'build', 'index.js');
      // Copy schema to a writable directory (userData) to avoid permissions issues in Program Files
      const userDataSchemaDir = path.join(app.getPath('userData'), 'prisma');
      if (!fs.existsSync(userDataSchemaDir)) {
        fs.mkdirSync(userDataSchemaDir, { recursive: true });
      }
      const sourceSchema = path.join(__dirname, 'backend-prisma', 'schema.prisma');
      const targetSchema = path.join(userDataSchemaDir, 'schema.prisma');
      try {
        fs.copyFileSync(sourceSchema, targetSchema);
        schemaPath = targetSchema;
      } catch (err) {
        console.error('[Prisma Push] Failed to copy schema to userData, falling back to original path:', err);
        schemaPath = sourceSchema;
      }
      cwd = path.join(__dirname, 'backend-dist');
    } else {
      prismaCliPath = path.join(getAppRoot(), 'backend', 'node_modules', 'prisma', 'build', 'index.js');
      schemaPath = path.join(__dirname, 'backend-prisma', 'schema.prisma'); // Use converted SQLite schema in dev too
      cwd = path.join(getAppRoot(), 'backend');
    }

    if (!fs.existsSync(prismaCliPath)) {
      console.warn(`[Prisma Push] Prisma CLI not found at ${prismaCliPath}, skipping db push.`);
      resolve();
      return;
    }

    console.log(`[Prisma Push] Running db push with schema: ${schemaPath}`);
    
    const nodeModulesPath = IS_PACKAGED
      ? path.join(__dirname, 'backend-node_modules')
      : path.join(getAppRoot(), 'backend', 'node_modules');

    const prismaCacheDir = path.join(app.getPath('userData'), 'prisma-cache');
    if (!fs.existsSync(prismaCacheDir)) {
      fs.mkdirSync(prismaCacheDir, { recursive: true });
    }

    const pushProcess = spawn(nodeExecutable, [
      prismaCliPath,
      'db', 'push',
      `--schema=${schemaPath}`,
      '--accept-data-loss',
      '--skip-generate'
    ], {
      cwd,
      env: {
        ...process.env,
        PRISMA_BINARY_CACHE_DIR: prismaCacheDir,
        PRISMA_CACHE_DIR: prismaCacheDir,
        CACHE_DIR: prismaCacheDir,
        NODE_PATH: nodeModulesPath,
        ...(IS_PACKAGED ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      },
      windowsHide: true,
    });

    let output = '';
    pushProcess.stdout.on('data', (data) => output += data.toString());
    pushProcess.stderr.on('data', (data) => output += data.toString());

    pushProcess.on('close', (code) => {
      console.log(`[Prisma Push] Process exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        console.error('[Prisma Push Output]\n', output);
        reject(new Error(`Prisma db push failed with exit code ${code}.\n\nPrisma Output:\n${output}`));
      }
    });
  });
}

function runPrismaSeed() {
  return new Promise((resolve, reject) => {
    const nodeExecutable = NODE_EXECUTABLE;
    let seedJsPath;
    let cwd;

    if (IS_PACKAGED) {
      seedJsPath = path.join(__dirname, 'backend-prisma', 'seed.js');
      cwd = path.join(__dirname, 'backend-dist');
    } else {
      seedJsPath = path.join(__dirname, 'backend-prisma', 'seed.js'); // Use compiled seed in dev too
      cwd = path.join(getAppRoot(), 'backend');
    }

    if (!fs.existsSync(seedJsPath)) {
      console.warn(`[Prisma Seed] Prisma seed script not found at ${seedJsPath}, skipping seed.`);
      resolve();
      return;
    }

    console.log(`[Prisma Seed] Seeding database using: ${seedJsPath}`);
    
    const nodeModulesPath = IS_PACKAGED
      ? path.join(__dirname, 'backend-node_modules')
      : path.join(getAppRoot(), 'backend', 'node_modules');

    const prismaCacheDir = path.join(app.getPath('userData'), 'prisma-cache');
    if (!fs.existsSync(prismaCacheDir)) {
      fs.mkdirSync(prismaCacheDir, { recursive: true });
    }

    const seedProcess = spawn(nodeExecutable, [seedJsPath], {
      cwd,
      env: {
        ...process.env,
        PRISMA_BINARY_CACHE_DIR: prismaCacheDir,
        PRISMA_CACHE_DIR: prismaCacheDir,
        CACHE_DIR: prismaCacheDir,
        NODE_PATH: nodeModulesPath,
        ...(IS_PACKAGED ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      },
      windowsHide: true,
    });

    let output = '';
    seedProcess.stdout.on('data', (data) => output += data.toString());
    seedProcess.stderr.on('data', (data) => output += data.toString());

    seedProcess.on('close', (code) => {
      console.log(`[Prisma Seed] Process exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        console.error('[Prisma Seed Output]\n', output);
        reject(new Error(`Prisma seed failed with exit code ${code}.\n\nPrisma Output:\n${output}`));
      }
    });
  });
}

// ─── Frontend Process ───────────────────────────────────────────────────────
function startFrontend() {
  return new Promise((resolve, reject) => {
    const nodeExecutable = NODE_EXECUTABLE;
    let frontendEntry;
    let cwd;

    if (IS_PACKAGED) {
      frontendEntry = path.join(__dirname, 'frontend-standalone', 'server.js');
      cwd = path.join(__dirname, 'frontend-standalone');
    } else {
      cwd = path.join(getAppRoot(), 'frontend');
    }

    const nodeModulesPath = IS_PACKAGED
      ? path.join(__dirname, 'backend-node_modules')
      : path.join(getAppRoot(), 'backend', 'node_modules');

    const env = {
      ...process.env,
      PORT: String(FRONTEND_PORT),
      NODE_ENV: 'production',
      NODE_PATH: nodeModulesPath,
      ...(IS_PACKAGED ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    };

    if (!IS_PACKAGED) {
      // In development mode, run next dev
      console.log('[Frontend] Starting Next.js in development mode...');
      frontendProcess = spawn('npm.cmd', ['run', 'dev'], {
        cwd,
        env: {
          ...process.env,
          PORT: String(FRONTEND_PORT),
        },
        shell: true,
        windowsHide: true,
      });
    } else {
      // In packaged mode, run compiled standalone Next.js
      console.log('[Frontend] Starting standalone Next.js server...');
      frontendProcess = spawn(nodeExecutable, [frontendEntry], {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    }

    frontendProcess.stdout.on('data', (data) => {
      console.log(`[Frontend] ${data.toString()}`);
    });

    frontendProcess.stderr.on('data', (data) => {
      console.error(`[Frontend Error] ${data.toString()}`);
    });

    frontendProcess.on('error', (err) => {
      console.error('[Frontend] Process error:', err);
      reject(err);
    });

    // Wait for the server port to be listening
    setTimeout(async () => {
      try {
        await waitForPort(FRONTEND_PORT, 30000);
        resolve();
      } catch (e) {
        reject(e);
      }
    }, 2000);
  });
}

// ─── Main Window ────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Nexora Enterprise',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the frontend (Next.js server on port 3000)
  mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  // Prevent window from closing — minimize to tray instead
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create professional application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Minimize to Tray',
          click: () => {
            if (mainWindow) mainWindow.hide();
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Support & Help Desk',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Support - Nexora Enterprise',
              message: 'For any issues, queries, or support, please contact us:\n\n📧 Email: hmnexora@gmail.com\n📞 Phone: +92-300-1234567\n\nHM Nexora ERP Team',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Frequently Asked Questions (FAQ)',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'question',
              title: 'Nexora Enterprise - FAQ',
              message: 'Frequently Asked Questions:\n\n' +
                'Q: Why is the cloud sync logging me out?\n' +
                'A: When cloud sync parameters are saved, the local configuration writes database secrets. The app now keeps them isolated to prevent session invalidations.\n\n' +
                'Q: How can I manually sync data to the cloud?\n' +
                'A: Click the "Sync" button on the cloud sync settings page to run manual replication.\n\n' +
                'Q: Why do some invoices render incorrectly?\n' +
                'A: Local printer layouts are now UTF-8 compliant. Make sure your printer settings support standard font encoding.\n\n' +
                'Q: How can I change the main factory name?\n' +
                'A: A Super Admin can navigate to Company Settings and update the company name for all branches.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'About Nexora Enterprise',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Nexora Enterprise',
              message: 'Nexora Enterprise ERP System\nVersion: 1.0.0\nDeveloped by: HM Nexora\n\nAll rights reserved.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(appMenu);
}

// ─── System Tray ────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  let trayIcon;

  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a simple default icon if none exists
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Nexora Enterprise — Running');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '📊 Open Nexora Enterprise',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: `🌐 API: http://localhost:${BACKEND_PORT}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '📋 Open Log File',
      click: () => {
        const logPath = path.join(app.getPath('userData'), 'combined.log');
        if (fs.existsSync(logPath)) {
          shell.openPath(logPath);
        } else {
          dialog.showMessageBox({
            type: 'info',
            title: 'Logs',
            message: 'No log file has been created yet. Start using the application first.',
          });
        }
      },
    },
    {
      label: '🛠️ Toggle Developer Tools',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.toggleDevTools();
        }
      },
    },
    { type: 'separator' },
    {
      label: '🔧 Open Data Folder',
      click: () => {
        shell.openPath(app.getPath('userData'));
      },
    },
    { type: 'separator' },
    {
      label: '❌ Quit Nexora Enterprise',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.on('ready', async () => {
  loadEnv();

  // ─── PDF Print / Physical Print Handler ───────────────────────────────────
  ipcMain.handle('print-invoice-pdf', async (_event, html, invoiceNo) => {
    const parentWin = mainWindow || null;
    const msgBoxOptions = {
      type: 'question',
      buttons: ['Save as PDF (Download)', 'Print (Physical Printer)', 'Cancel'],
      defaultId: 0,
      title: `Invoice ${invoiceNo}`,
      message: `What would you like to do with Invoice ${invoiceNo}?`,
    };

    const { response } = parentWin
      ? await dialog.showMessageBox(parentWin, msgBoxOptions)
      : await dialog.showMessageBox(msgBoxOptions);

    if (response === 2) return { success: false, error: 'Cancelled' };

    const invoiceWin = new BrowserWindow({
      width: 900,
      height: 950,
      show: response === 1, // Only show if physical printing
      title: `Print Invoice ${invoiceNo}`,
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const tempFilePath = path.join(app.getPath('userData'), `temp-print-${Date.now()}.html`);
    fs.writeFileSync(tempFilePath, html);
    await invoiceWin.loadURL(`file://${tempFilePath}`);

    // Allow rendering time for CSS/images/watermarks
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (response === 0) {
        // Save as PDF (Download)
        const pdfData = await invoiceWin.webContents.printToPDF({
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          pageSize: 'A4',
          printBackground: true,
        });

        const saveOptions = {
          title: 'Save Invoice PDF',
          defaultPath: path.join(app.getPath('downloads'), `Invoice-${invoiceNo}.pdf`),
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        };

        const { canceled, filePath } = parentWin
          ? await dialog.showSaveDialog(parentWin, saveOptions)
          : await dialog.showSaveDialog(saveOptions);

        if (!canceled && filePath) {
          fs.writeFileSync(filePath, pdfData);
          try { invoiceWin.close(); } catch {}
          return { success: true };
        }
      } else if (response === 1) {
        // Print (Physical Printer)
        await invoiceWin.webContents.executeJavaScript('window.print()');
      }
    } catch (err) {
      console.error('Print invoice error:', err);
    } finally {
      try { invoiceWin.close(); } catch {}
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
    return { success: true };
  });

  // ─── Generic HTML Print Handler (Statements, etc.) ───────────────────────
  ipcMain.handle('print-html', async (_event, html, title) => {
    const parentWin = mainWindow || null;
    const msgBoxOptions = {
      type: 'question',
      buttons: ['Save as PDF (Download)', 'Print (Physical Printer)', 'Cancel'],
      defaultId: 0,
      title: title || 'Document Options',
      message: `What would you like to do with this document?`,
    };

    const { response } = parentWin
      ? await dialog.showMessageBox(parentWin, msgBoxOptions)
      : await dialog.showMessageBox(msgBoxOptions);

    if (response === 2) return { success: false, error: 'Cancelled' };

    const printWin = new BrowserWindow({
      width: 900,
      height: 950,
      show: response === 1,
      title: title || 'Print Document',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const tempFilePath = path.join(app.getPath('userData'), `temp-print-${Date.now()}.html`);
    fs.writeFileSync(tempFilePath, html);
    await printWin.loadURL(`file://${tempFilePath}`);

    // Allow rendering time for CSS/images/watermarks
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (response === 0) {
        const pdfData = await printWin.webContents.printToPDF({
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          pageSize: 'A4',
          printBackground: true,
        });

        const safeTitle = (title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const saveOptions = {
          title: 'Save PDF Document',
          defaultPath: path.join(app.getPath('downloads'), `${safeTitle}.pdf`),
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        };

        const { canceled, filePath } = parentWin
          ? await dialog.showSaveDialog(parentWin, saveOptions)
          : await dialog.showSaveDialog(saveOptions);

        if (!canceled && filePath) {
          fs.writeFileSync(filePath, pdfData);
          try { printWin.close(); } catch {}
          return { success: true };
        }
      } else if (response === 1) {
        await printWin.webContents.executeJavaScript('window.print()');
      }
    } catch (err) {
      console.error('Print HTML error:', err);
    } finally {
      try { printWin.close(); } catch {}
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
    return { success: true };
  });

  // ─── Database Backup Handler ───────────────────────────────────────────────
  ipcMain.handle('backup-database', async () => {
    const dbPath = path.join(app.getPath('userData'), 'factory_erp.db');
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: 'Database file not found.' };
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const defaultPath = path.join(
      app.getPath('documents'),
      `Nexora-Backup-${dateStr}.db`
    );

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Nexora Database Backup',
      defaultPath,
      filters: [{ name: 'Nexora Database Backup', extensions: ['db'] }],
    });

    if (!canceled && filePath) {
      try {
        fs.copyFileSync(dbPath, filePath);
        return { success: true, filePath };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false };
  });

  // ─── Database Restore Handler ──────────────────────────────────────────────
  ipcMain.handle('restore-database', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Nexora Database Backup',
      filters: [{ name: 'Nexora Database Backup', extensions: ['db'] }],
      properties: ['openFile'],
    });

    if (!canceled && filePaths && filePaths.length > 0) {
      const selectedPath = filePaths[0];

      const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Cancel', 'Yes, Restore and Restart'],
        defaultId: 0,
        title: 'Restore Database Backup',
        message: 'Are you sure you want to restore this backup?',
        detail: 'This will completely replace all your current products, transactions, settings, and stock data. The application will restart automatically to apply the changes.',
      });

      if (response === 1) {
        try {
          const dbPath = path.join(app.getPath('userData'), 'factory_erp.db');
          
          // Stop backend & frontend services gracefully before copying
          if (backendProcess) killProcess(backendProcess);
          if (frontendProcess) killProcess(frontendProcess);

          // Give processes a brief moment to exit and release file lock
          await new Promise(r => setTimeout(r, 1000));

          // Copy backup over current db
          fs.copyFileSync(selectedPath, dbPath);

          // Relaunch app
          app.relaunch();
          app.exit(0);
          return { success: true };
        } catch (err) {
          dialog.showErrorBox('Restore Failed', `Could not restore database:\n\n${err.message}`);
          return { success: false, error: err.message };
        }
      }
    }
    return { success: false };
  });

  // Show splash screen
  createSplashWindow();

  try {
    if (IS_PACKAGED) {
      freePort(BACKEND_PORT);
      freePort(FRONTEND_PORT);
    }

    // Determine database path in userData to survive updates
    const dbPath = path.join(app.getPath('userData'), 'factory_erp.db');
    const dbExists = fs.existsSync(dbPath);
    const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

    console.log(`[ERP] Local SQLite Database: ${dbPath}`);
    
    // If DATABASE_URL in .env was a cloud PostgreSQL connection, preserve it as the sync target
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
      console.log('[ERP] Found PostgreSQL cloud database in env, configuring as Supabase sync target.');
      process.env.SUPABASE_DATABASE_URL = process.env.DATABASE_URL;
    }
    
    // Configure local database connection to use the local SQLite file
    process.env.DATABASE_URL = dbUrl;

    // Run database migrations/push
    console.log('[ERP] Checking/initializing local database schema...');
    await runPrismaDbPush();
    console.log('[ERP] Database schema is up-to-date.');

    // Seed database if it is a new installation
    if (!dbExists) {
      console.log('[ERP] New database detected. Seeding initial accounts & settings...');
      await runPrismaSeed();
      console.log('[ERP] Database seed completed.');
    }

    // Check if ports are available
    const backendPortFree = await isPortAvailable(BACKEND_PORT);
    const frontendPortFree = await isPortAvailable(FRONTEND_PORT);
    
    if (!backendPortFree || !frontendPortFree) {
      dialog.showErrorBox(
        'Nexora Enterprise',
        `Required port(s) are already in use:\n` +
        `NestJS Backend (Port ${BACKEND_PORT}): ${backendPortFree ? 'FREE' : 'IN USE'}\n` +
        `Next.js Frontend (Port ${FRONTEND_PORT}): ${frontendPortFree ? 'FREE' : 'IN USE'}\n\n` +
        `Please close other instances or conflicting services and try again.`
      );
      app.quit();
      return;
    }

    // Start NestJS backend
    console.log('[ERP] Starting backend server...');
    await startBackend();
    console.log('[ERP] Backend is ready!');

    // Start Next.js frontend
    console.log('[ERP] Starting frontend server...');
    await startFrontend();
    console.log('[ERP] Frontend is ready!');

    // Wait a moment for full initialization
    await new Promise(r => setTimeout(r, 1000));

    // Create main window & tray
    createTray();
    createMainWindow();

    // Load the frontend URL
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);

  } catch (err) {
    console.error('[ERP] Startup failed:', err);
    if (splashWindow) splashWindow.close();
    dialog.showErrorBox(
      'Nexora Enterprise — Startup Error',
      `Failed to start the application.\n\n${err.message}\n\nPlease check that your database configuration is correct and that files aren't locked.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Don't quit — we stay in the tray
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

function killProcess(child) {
  if (!child) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true });
    } else {
      child.kill('SIGTERM');
    }
  } catch (err) {
    console.error(`[ERP] Failed to kill process ${child.pid}:`, err);
  }
}

app.on('will-quit', () => {
  // Clean up child processes
  if (backendProcess) {
    console.log('[ERP] Stopping backend...');
    killProcess(backendProcess);
    backendProcess = null;
  }
  if (frontendProcess) {
    console.log('[ERP] Stopping frontend...');
    killProcess(frontendProcess);
    frontendProcess = null;
  }
});

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
  console.error('[ERP] Uncaught Exception:', err);
});
