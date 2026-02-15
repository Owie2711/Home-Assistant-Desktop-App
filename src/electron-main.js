

import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, powerSaveBlocker } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';


// Optimasi Memori dan Stabilitas
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode'); // Percepat render CCTV MJPEG
app.commandLine.appendSwitch('enable-gpu-rasterization'); // Gunakan GPU untuk render UI agar CPU lebih ringan
app.commandLine.appendSwitch('enable-zero-copy'); // Mengurangi penggunaan CPU saat manipulasi buffer video
app.commandLine.appendSwitch('ignore-connections-limit', '192.168.1.1,192.168.1.100'); // Ganti dengan IP server anda jika perlu
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256'); // Batasi V8 RAM agar tidak bocor (leak)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

let mainWindow;
let tray;
let psbId;


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        title: "Home Assistant",
        icon: path.join(__dirname, '../Home Assistant.ico'),

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            partition: 'persist:main', // Simpan cookies dan session secara permanen
            backgroundThrottling: false, // Mencegah throttling saat window tidak fokus
        },
        show: false, // Wait until ready-to-show
    });

    // Sembunyikan Menu Bar agar lebih seperti aplikasi desktop murni
    mainWindow.setMenuBarVisibility(false);

    // Check Configured URL
    const haUrl = store.get('ha_url');
    if (haUrl) {
        mainWindow.loadURL(haUrl);
    } else {
        mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Navigation Handling
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const currentUrl = store.get('ha_url');
        // Izinkan window baru jika masih di dalam domain Home Assistant (misal untuk popup auth)
        if (currentUrl && url.startsWith(currentUrl)) {
            return { action: 'allow' };
        }
        // Link luar dibuka di browser default
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const currentUrl = store.get('ha_url');
        // Izinkan jika navigasi internal (file://) atau masih di dalam domain HASS
        if (url.startsWith('file:') || (currentUrl && url.startsWith(currentUrl))) {
            return;
        }
        // Blokir navigasi eksternal lainnya
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
    tray.setToolTip('Home Assistant Wrapper');
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



app.whenReady().then(() => {
    createWindow();
    createTray();

    // Mencegah PC masuk ke mode tidur atau suspend selama aplikasi berjalan
    // Sangat penting untuk stream CCTV tanpa delay
    psbId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('Power Save Blocker active:', powerSaveBlocker.isStarted(psbId));

    // Buat Menu minimal untuk mendukung keyboard shortcuts (Zoom, DevTools, dll)
    const template = [
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn', accelerator: 'CmdOrCtrl+Plus' }, // Mendukung Ctrl + Plus
                { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },    // Mendukung Ctrl + =
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

    // IPC Handlers
    ipcMain.handle('get-app-state', () => {
        return {
            url: store.get('ha_url'),
            autoStart: app.getLoginItemSettings().openAtLogin
        };
    });

    ipcMain.handle('update-allowed-url', (event, url) => {
        store.set('ha_url', url);
        // Also update navigation logic? Maybe just re-check on nav event
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
// Handle quit when all windows are closed - usually irrelevant if we prevent default close
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
