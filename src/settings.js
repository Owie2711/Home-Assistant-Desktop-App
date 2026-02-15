
const urlInput = document.getElementById('ha-url');
const autostartInput = document.getElementById('autostart');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

async function init() {
    try {
        const state = await window.electronAPI.getAppState();

        if (state.url) {
            urlInput.value = state.url;
        }
        autostartInput.checked = state.autoStart;

        saveBtn.addEventListener('click', async () => {
            let url = urlInput.value.trim();
            if (url) {
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'http://' + url;
                }

                await window.electronAPI.updateAllowedUrl(url);
                await window.electronAPI.setAutoStart(autostartInput.checked);
                await window.electronAPI.reloadMainWindow();
                await window.electronAPI.closeWindow();
            }
        });

        cancelBtn.addEventListener('click', async () => {
            await window.electronAPI.closeWindow();
        });

    } catch (e) {
        console.error(e);
        alert('Failed to load settings: ' + e);
    }
}

window.addEventListener('DOMContentLoaded', init);
