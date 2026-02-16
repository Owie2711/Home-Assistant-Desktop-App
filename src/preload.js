
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppState: () => ipcRenderer.invoke('get-app-state'),
    updateAllowedUrl: (url) => ipcRenderer.invoke('update-allowed-url', url),
    setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke('set-always-on-top', enabled),
    setMinimizeToTray: (enabled) => ipcRenderer.invoke('set-minimize-to-tray', enabled),
    reloadMainWindow: () => ipcRenderer.invoke('reload-main-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    resetConfig: () => ipcRenderer.invoke('reset-config'),
});

// Fungsi deteksi halaman login
function isLoginPage() {
    const path = window.location.pathname;
    return path.includes('/auth/') || path.includes('/login');
}

function handleFloatingButton() {
    if (window.location.protocol === 'file:') return;

    let btn = document.getElementById('ha-change-server-btn');

    if (isLoginPage()) {
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'ha-change-server-btn';
            btn.innerText = 'Change Server';

            Object.assign(btn.style, {
                position: 'fixed',
                top: '12px',
                left: '12px',
                zIndex: '999999',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)',
                opacity: '0.5'
            });

            btn.onmouseenter = () => {
                btn.style.opacity = '1';
                btn.style.backgroundColor = 'rgba(56, 189, 248, 0.9)';
            };
            btn.onmouseleave = () => {
                btn.style.opacity = '0.5';
                btn.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
            };

            btn.onclick = () => {
                ipcRenderer.invoke('reset-config');
            };

            document.body.appendChild(btn);
        }
    } else if (btn) {
        btn.remove();
    }
}

// Gunakan MutationObserver daripada setInterval untuk performa CPU lebih baik
window.addEventListener('DOMContentLoaded', () => {
    handleFloatingButton();

    const observer = new MutationObserver(() => {
        handleFloatingButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});
