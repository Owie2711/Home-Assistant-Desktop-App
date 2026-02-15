# Home Assistant Wrapper (Electron Version)

This project has been migrated to Electron. It wraps your Home Assistant instance in a dedicated window with system tray support.

## Prerequisites

- Node.js installed.

## Installation

```bash
npm install
```

## Running Development

To start the application:

```bash
npm start
```

## Building for Windows

To create an installer (`.exe`):

```bash
npm run build
```

The output installer will be located in the `dist/` folder.

## Features

- **Configuration**: On first run, you will be prompted to enter your Home Assistant URL.
- **Persistence**: The URL is saved using `electron-store`.
- **System Tray**:
    - **Open**: Show the main window.
    - **Reload**: Refresh the page.
    - **Settings**: Open settings to change URL or toggle auto-start.
    - **Quit**: Exit the application.
- **Auto-Start**: Configurable via Settings.
- **Security**: External links open in your default browser.

## Project Structure

- `src/electron-main.js`: Main process (Backend logic).
- `src/preload.js`: Context Bridge (Secure API exposure).
- `src/index.html` & `src/main.js`: Main window frontend.
- `src/settings.html` & `src/settings.js`: Settings window frontend.
