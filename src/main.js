
const setupDiv = document.querySelector('#setup');
const loader = document.querySelector('#loader');
const urlInput = document.querySelector('#ha-url');
const saveBtn = document.querySelector('#save-btn');

async function init() {
  try {
    const state = await window.electronAPI.getAppState();
    const savedUrl = state.url;

    console.log('Saved URL:', savedUrl);

    if (savedUrl) {
      window.location.replace(savedUrl);
    } else {
      loader.classList.add('hidden');
      setupDiv.classList.remove('hidden');
    }

    saveBtn.addEventListener('click', async () => {
      const val = urlInput.value.trim();
      if (val) {
        let url = val;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'http://' + url;
        }

        await window.electronAPI.updateAllowedUrl(url);
        // Optionally set AutoStart default here if needed, or rely on settings
        await window.electronAPI.reloadMainWindow();
      }
    });

  } catch (err) {
    console.error(err);
    loader.classList.add('hidden');
    setupDiv.classList.remove('hidden');
    alert('Failed to load app state: ' + err);
  }
}

window.addEventListener('DOMContentLoaded', init);
