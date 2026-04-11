/* ============================================================
   Electron Main Process
   ============================================================
   Table of Contents:
   1. Imports and security setup
   2. Window creation
   3. App lifecycle events
   4. IPC handlers (future offline mode)
   ============================================================ */

const { app, BrowserWindow, screen, session } = require('electron');
const path = require('path');

/* --------------------------------------------------------
   1. Imports and Security Setup
   -------------------------------------------------------- */

// Enforce sandbox globally for all renderer processes
app.enableSandbox();

/* --------------------------------------------------------
   2. Window Creation
   -------------------------------------------------------- */

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Calculate responsive window dimensions
    // Mobile-first: default to phone-like ratio, scale up on larger screens
    const isLargeScreen = screenWidth >= 1920;
    const isMediumScreen = screenWidth >= 1366;

    let windowWidth, windowHeight;

    if (isLargeScreen) {
        // 1080p+ : comfortable phone-width window centered on screen
        windowWidth = 440;
        windowHeight = Math.min(900, Math.floor(screenHeight * 0.9));
    } else if (isMediumScreen) {
        // Laptop: slightly narrower
        windowWidth = 420;
        windowHeight = Math.min(860, Math.floor(screenHeight * 0.85));
    } else {
        // Small screen: use most of the available space
        windowWidth = Math.floor(screenWidth * 0.95);
        windowHeight = Math.floor(screenHeight * 0.9);
    }

    const mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        minWidth: 360,
        minHeight: 600,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            sandbox: true
        }
    });

    // Restrict permissions - only allow necessary ones
    session.defaultSession.setPermissionRequestHandler(
        (_webContents, permission, callback) => {
            const allowedPermissions = ['notifications'];
            callback(allowedPermissions.includes(permission));
        }
    );

    // Load the SPA entry point from filesystem
    mainWindow.loadFile(
        path.join(__dirname, '..', 'src', 'frontend', 'index.html')
    );

    // Remove default menu bar for cleaner look
    mainWindow.setMenuBarVisibility(false);

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

/* --------------------------------------------------------
   3. App Lifecycle Events
   -------------------------------------------------------- */

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/* --------------------------------------------------------
   4. IPC Handlers (future offline mode)
   --------------------------------------------------------
   These will be implemented when the offline SQLite
   database is set up in src/database/offline/.

   ipcMain.handle('db:query', async (event, sql, params) => { });
   ipcMain.handle('db:insert', async (event, table, data) => { });
   ipcMain.handle('notify', async (event, title, body) => { });
   -------------------------------------------------------- */
