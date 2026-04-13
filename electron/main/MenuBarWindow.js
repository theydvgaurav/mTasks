const path = require('node:path');
const { BrowserWindow, screen } = require('electron');

class MenuBarWindow {
  constructor({ width, height, preloadPath, devServerUrl }) {
    this.width = width;
    this.height = height;
    this.preloadPath = preloadPath;
    this.devServerUrl = devServerUrl;
    this.tray = null;
    this.window = null;
  }

  async create() {
    this.window = new BrowserWindow({
      width: this.width,
      height: this.height,
      show: false,
      frame: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hiddenInMissionControl: true,
      vibrancy: 'window',
      visualEffectState: 'active',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    this.window.on('blur', () => {
      if (this.window && !this.window.webContents.isDevToolsOpened()) {
        this.window.hide();
      }
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    if (this.devServerUrl) {
      await this.window.loadURL(this.devServerUrl);
    } else {
      await this.window.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
    }

    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }

  setTray(tray) {
    this.tray = tray;
  }

  toggle(forceShow = false) {
    if (!this.window) {
      return;
    }

    if (forceShow || !this.window.isVisible()) {
      this.positionWindow();
      this.window.show();
      this.window.focus();
      return;
    }

    this.window.hide();
  }

  positionWindow() {
    if (!this.tray || !this.window) {
      return;
    }

    const trayBounds = this.tray.getBounds();
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

    let x = Math.round(trayBounds.x + trayBounds.width / 2 - this.width / 2);
    let y = Math.round(trayBounds.y + trayBounds.height + 8);

    const maxX = display.workArea.x + display.workArea.width - this.width;
    const minX = display.workArea.x;
    x = Math.max(minX, Math.min(x, maxX));

    if (process.platform !== 'darwin') {
      y = Math.round(trayBounds.y - this.height);
    }

    this.window.setPosition(x, y, false);
  }
}

module.exports = {
  MenuBarWindow
};
