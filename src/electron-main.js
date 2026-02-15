
import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, powerSaveBlocker } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Store from 'electron-store';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- KONFIGURASI PENYIMPANAN DATA (DI DALAM FOLDER INSTALASI) ---
// Ini memastikan data terhapus saat folder aplikasi dihapus
const appPath = path.dirname(app.getPath('exe'));
const dataPath = path.join(appPath, 'data');

if (!fs.existsSync(dataPath)) {
    try {
        fs.mkdirSync(dataPath, { recursive: true });
    } catch (e) {
        // Jika gagal tulis di folder exe (privelege), gunakan default sistem sebagai fallback
        console.error('Gagal membuat folder data di folder instalasi, menggunakan default.');
    }
}

if (fs.existsSync(dataPath)) {
    app.setPath('userData', dataPath);
}

// --- OPTIMASI RESOURCE EKSTRIM (CPU, GPU, RAM) ---
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128'); // Batasi V8 RAM lebih ketat (128MB)
app.commandLine.appendSwitch('disk-cache-size', '10485760'); // Batasi cache disk hanya 10MB
app.commandLine.appendSwitch('disable-software-rasterizer'); // Paksa Full Hardware Acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,InterestFeedContentSuggestions');

const store = new Store({
    cwd: dataPath // Pastikan Store menyimpan di folder data tersebut
});

let mainWindow;
let tray;
let psbId;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        title: "Home Assistant Desktop App",
        icon: path.join(__dirname, '../Home Assistant.ico'),

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            partition: 'persist:main',
            backgroundThrottling: false,
        },
        show: false,
    });

    mainWindow.setMenuBarVisibility(false);

    const haUrl = store.get('ha_url');
    if (haUrl) {
        mainWindow.loadURL(haUrl);
    } else {
        mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const currentUrl = store.get('ha_url');
        if (currentUrl && url.startsWith(currentUrl)) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const currentUrl = store.get('ha_url');
        if (url.startsWith('file:') || (currentUrl && url.startsWith(currentUrl))) {
            return;
        }
        event.preventDefault();
        shell.openExternal(url);
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, '../Home Assistant.ico');
    const trayIcon = nativeImage.createFromPath(iconPath);
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open', click: () => mainWindow.show() },
        { label: 'Reload', click: () => mainWindow.reload() },
        { label: 'Settings', click: openSettingsWindow },
        {
            label: 'Quit', click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);
    tray.setToolTip('Home Assistant Desktop App');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
    });
}

function openSettingsWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 400,
        title: "Settings",
        parent: mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.loadFile(path.join(__dirname, 'settings.html'));
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        createTray();

        psbId = powerSaveBlocker.start('prevent-app-suspension');

        const template = [
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn', accelerator: 'CmdOrCtrl+Plus' },
                    { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'close' }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);

        ipcMain.handle('get-app-state', () => {
            return {
                url: store.get('ha_url'),
                autoStart: app.getLoginItemSettings().openAtLogin
            };
        });

        ipcMain.handle('update-allowed-url', (event, url) => {
            store.set('ha_url', url);
        });

        ipcMain.handle('set-auto-start', (event, enabled) => {
            app.setLoginItemSettings({
                openAtLogin: enabled,
                path: app.getPath('exe'),
            });
        });

        ipcMain.handle('reset-config', () => {
            store.delete('ha_url');
            mainWindow.loadFile(path.join(__dirname, 'index.html'));
        });

        ipcMain.handle('reload-main-window', () => {
            const newUrl = store.get('ha_url');
            if (newUrl) {
                mainWindow.loadURL(newUrl);
            } else {
                mainWindow.loadFile(path.join(__dirname, 'index.html'));
            }
        });

        ipcMain.handle('close-window', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            win.close();
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}
