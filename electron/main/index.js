const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { app, ipcMain, Tray, nativeImage, Menu } = require('electron');
const AutoLaunch = require('auto-launch');
const Store = require('electron-store');
const dotenv = require('dotenv');

const { MenuBarWindow } = require('./MenuBarWindow');
const { AuthManager } = require('./AuthManager');
const { TaskService } = require('./TaskService');

loadEnvironment();

const WINDOW_WIDTH = 392;
const WINDOW_HEIGHT = 620;
const APP_SERVICE_NAME = 'mtasks';

const store = new Store({
  name: 'preferences',
  defaults: {
    hideDockIcon: true,
    autoLaunch: false,
    syncIntervalSec: 30,
    theme: 'system',
    selectedTaskListId: null,
    taskCache: {}
  }
});

const authManager = new AuthManager({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectPort: process.env.GOOGLE_OAUTH_REDIRECT_PORT,
  serviceName: APP_SERVICE_NAME
});

const taskService = new TaskService(authManager);

let mainWindow;
let menuBarWindow;
let tray;
let autoLauncher;

if (app.requestSingleInstanceLock() === false) {
  app.quit();
}

app.whenReady().then(async () => {
  const shouldHideDock = process.platform === 'darwin' && store.get('hideDockIcon');
  const forceShowDock = process.env.DEBUG_SHOW_DOCK === '1';
  if (shouldHideDock && !forceShowDock) {
    app.dock.hide();
  } else if (process.platform === 'darwin') {
    app.dock.show();
  }

  try {
    await authManager.initialize();
  } catch (error) {
    console.error('[auth:init]', error?.code || 'unknown_error', error?.message || error);
  }

  menuBarWindow = new MenuBarWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    preloadPath: path.join(__dirname, '../preload/index.js'),
    devServerUrl: process.env.VITE_DEV_SERVER_URL
  });
  await menuBarWindow.create();
  mainWindow = menuBarWindow.window;

  createTray();
  registerIPC();

  autoLauncher = new AutoLaunch({
    name: 'mTasks',
    path: app.getPath('exe'),
    isHidden: true
  });

  await applyAutoLaunchSetting(store.get('autoLaunch'));
});

app.on('second-instance', () => {
  menuBarWindow?.toggle(true);
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('before-quit', () => {
  mainWindow = null;
  menuBarWindow = null;
  tray = null;
});

function createTray() {
  const templateIcon = getTrayTemplateIcon();

  try {
    tray = new Tray(templateIcon);
  } catch (error) {
    // If tray creation fails, at least keep the app discoverable.
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    if (mainWindow) {
      mainWindow.show();
    }
    throw error;
  }
  menuBarWindow?.setTray(tray);
  tray.setToolTip('mTasks');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open mTasks', click: () => menuBarWindow?.toggle(true) },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.on('click', (event) => {
    if (process.platform === 'darwin' && event?.ctrlKey) {
      tray.popUpContextMenu(contextMenu);
      return;
    }
    menuBarWindow?.toggle(true);
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });
}

function getTrayTemplateIcon() {
  const candidates = [];

  const trayPath = path.join(__dirname, '../../build/trayTemplate.png');
  if (fs.existsSync(trayPath)) {
    candidates.push(nativeImage.createFromPath(trayPath));
  }

  // Packaged fallback icon bundled by Electron.
  const electronIconPath = path.join(process.resourcesPath || '', 'electron.icns');
  if (electronIconPath && fs.existsSync(electronIconPath)) {
    candidates.push(nativeImage.createFromPath(electronIconPath));
  }

  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path d="M8 1.8a6.2 6.2 0 1 1 0 12.4A6.2 6.2 0 0 1 8 1.8z" fill="black"/>
      <path d="M4.7 8.2l2 2 4.6-4.6" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  candidates.push(
    nativeImage.createFromDataURL(
      `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString('base64')}`
    )
  );

  if (process.platform === 'darwin') {
    // Last resort: native macOS status icon.
    candidates.push(nativeImage.createFromNamedImage('NSImageNameStatusAvailable'));
  }

  for (const image of candidates) {
    if (!image || image.isEmpty()) {
      continue;
    }
    const resized = image.resize({ width: 16, height: 16 });
    resized.setTemplateImage(process.platform === 'darwin');
    if (!resized.isEmpty()) {
      return resized;
    }
  }

  return nativeImage.createEmpty();
}

async function applyAutoLaunchSetting(enabled) {
  if (!autoLauncher || !app.isPackaged) {
    return;
  }

  const isEnabled = await autoLauncher.isEnabled();
  if (enabled && !isEnabled) {
    await autoLauncher.enable();
  }

  if (!enabled && isEnabled) {
    await autoLauncher.disable();
  }
}

function registerIPC() {
  ipcMain.handle('auth:get-session', async () => {
    try {
      return await authManager.getSession();
    } catch (error) {
      throw toIPCError(serializeError(error));
    }
  });

  ipcMain.handle('auth:login', async () => {
    try {
      return await authManager.login();
    } catch (error) {
      const serialized = serializeError(error);
      console.error('[auth:login]', serialized.code, serialized.message);
      throw toIPCError(serialized);
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      const session = await authManager.logout();
      store.set('taskCache', {});
      return session;
    } catch (error) {
      throw toIPCError(serializeError(error));
    }
  });

  ipcMain.handle('tasks:get-task-lists', async () => {
    try {
      const response = await taskService.listTaskLists();
      const nextCache = {
        ...store.get('taskCache'),
        taskLists: response.taskLists,
        defaultTaskListId: response.defaultTaskListId,
        updatedAt: Date.now()
      };
      store.set('taskCache', nextCache);
      return {
        ...response,
        stale: false
      };
    } catch (error) {
      const cached = store.get('taskCache');
      if (cached?.taskLists) {
        return {
          taskLists: cached.taskLists,
          defaultTaskListId: cached.defaultTaskListId || null,
          stale: true,
          warning: 'Showing cached task lists.'
        };
      }
      throw toIPCError(serializeError(error));
    }
  });

  ipcMain.handle('tasks:get-tasks', async (_event, taskListId) => {
    try {
      const response = await taskService.listTasks(taskListId);
      const cache = store.get('taskCache');
      const tasksByList = {
        ...(cache.tasksByList || {}),
        [taskListId]: response.tasks
      };

      store.set('taskCache', {
        ...cache,
        tasksByList,
        updatedAt: Date.now()
      });

      return {
        ...response,
        stale: false
      };
    } catch (error) {
      const cache = store.get('taskCache');
      const cachedTasks = cache?.tasksByList?.[taskListId];
      if (cachedTasks) {
        return {
          tasks: cachedTasks,
          stale: true,
          warning: 'Showing cached tasks.'
        };
      }
      throw toIPCError(serializeError(error));
    }
  });

  ipcMain.handle('tasks:create-task', async (_event, taskListId, payload) => {
    try {
      const task = await taskService.createTask(taskListId, payload);
      const cache = store.get('taskCache') || {};
      const tasksByList = cache.tasksByList || {};
      const listTasks = Array.isArray(tasksByList[taskListId]) ? tasksByList[taskListId] : [];

      store.set('taskCache', {
        ...cache,
        tasksByList: {
          ...tasksByList,
          [taskListId]: [task, ...listTasks]
        },
        updatedAt: Date.now()
      });

      return task;
    } catch (error) {
      throw toIPCError(serializeError(error));
    }
  });

  ipcMain.handle('tasks:update-task', async (_event, taskListId, taskId, payload) => {
    try {
      const task = await taskService.updateTask(taskListId, taskId, payload);
      const cache = store.get('taskCache') || {};
      const tasksByList = cache.tasksByList || {};
      const listTasks = Array.isArray(tasksByList[taskListId]) ? tasksByList[taskListId] : [];

      store.set('taskCache', {
        ...cache,
        tasksByList: {
          ...tasksByList,
          [taskListId]: listTasks.map((entry) => (entry.id === taskId ? task : entry))
        },
        updatedAt: Date.now()
      });

      return task;
    } catch (error) {
      throw toIPCError(serializeError(error));
    }
  });

  ipcMain.handle('tasks:delete-task', async (_event, taskListId, taskId) => {
    try {
      const result = await taskService.deleteTask(taskListId, taskId);

      const cache = store.get('taskCache') || {};
      const tasksByList = cache.tasksByList || {};
      const listTasks = Array.isArray(tasksByList[taskListId]) ? tasksByList[taskListId] : [];

      store.set('taskCache', {
        ...cache,
        tasksByList: {
          ...tasksByList,
          [taskListId]: listTasks.filter((entry) => entry.id !== taskId)
        },
        updatedAt: Date.now()
      });

      return result;
    } catch (error) {
      throw toIPCError(serializeError(error));
    }
  });

  ipcMain.handle('settings:get', async () => ({
    hideDockIcon: store.get('hideDockIcon'),
    autoLaunch: store.get('autoLaunch'),
    syncIntervalSec: store.get('syncIntervalSec'),
    theme: store.get('theme'),
    selectedTaskListId: store.get('selectedTaskListId')
  }));

  ipcMain.handle('settings:update', async (_event, partial) => {
    const allowedKeys = ['hideDockIcon', 'autoLaunch', 'syncIntervalSec', 'theme', 'selectedTaskListId'];

    for (const [key, value] of Object.entries(partial || {})) {
      if (!allowedKeys.includes(key)) {
        continue;
      }

      store.set(key, value);

      if (key === 'hideDockIcon' && process.platform === 'darwin') {
        if (value) {
          app.dock.hide();
        } else {
          app.dock.show();
        }
      }

      if (key === 'autoLaunch') {
        await applyAutoLaunchSetting(Boolean(value));
      }
    }

    return {
      hideDockIcon: store.get('hideDockIcon'),
      autoLaunch: store.get('autoLaunch'),
      syncIntervalSec: store.get('syncIntervalSec'),
      theme: store.get('theme'),
      selectedTaskListId: store.get('selectedTaskListId')
    };
  });
}

function serializeError(error) {
  if (!error) {
    return {
      message: 'Unknown error'
    };
  }

  const googleError = error.response?.data?.error || {};
  const googleReason = error.errors?.[0]?.reason || googleError?.errors?.[0]?.reason;
  const googleMessage = googleError?.message || error.message || 'Something went wrong.';
  const status = Number(error.status || error.code || error.response?.status);

  if (googleReason === 'rateLimitExceeded' || googleReason === 'userRateLimitExceeded') {
    return {
      code: 'rate_limit',
      message: 'Google Tasks rate limit reached. Please try again shortly.'
    };
  }

  if (error.code === 'oauth_not_configured') {
    return {
      code: 'oauth_not_configured',
      message:
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID (and optional GOOGLE_CLIENT_SECRET).'
    };
  }

  if (error.code === 'oauth_timeout') {
    return {
      code: 'oauth_timeout',
      message: 'Login timed out. Please retry sign-in.'
    };
  }

  if (error.code === 'oauth_in_progress') {
    return {
      code: 'oauth_in_progress',
      message: 'Login is already in progress.'
    };
  }

  if (error.code === 'oauth_callback_port_in_use') {
    return {
      code: 'oauth_callback_port_in_use',
      message:
        'Local OAuth callback port is in use. Quit other app instances or change GOOGLE_OAUTH_REDIRECT_PORT.'
    };
  }

  if (error.code === 'oauth_callback_validation_failed') {
    return {
      code: 'oauth_callback_validation_failed',
      message: 'OAuth callback validation failed. Retry sign-in from this app.'
    };
  }

  if (error.code === 'oauth_access_denied') {
    return {
      code: 'oauth_access_denied',
      message: 'Google sign-in was canceled or denied.'
    };
  }

  if (
    error.code === 'oauth_invalid_client' ||
    error.code === 'oauth_unauthorized_client' ||
    error.code === 'oauth_redirect_uri_mismatch' ||
    error.code === 'oauth_invalid_grant' ||
    error.code === 'oauth_login_failed'
  ) {
    return {
      code: error.code,
      message: error.message || 'OAuth login failed. Verify Google OAuth configuration.'
    };
  }

  if (status === 401 || googleReason === 'authError') {
    return {
      code: 'unauthorized',
      message: 'Your session expired. Please login again.'
    };
  }

  if (status === 403) {
    if (googleReason === 'accessNotConfigured' || googleReason === 'serviceDisabled') {
      return {
        code: 'api_not_enabled',
        message:
          'Google Tasks API is not enabled in this Google Cloud project. Enable it and retry.'
      };
    }

    if (googleReason === 'insufficientPermissions') {
      return {
        code: 'insufficient_permissions',
        message:
          'OAuth token lacks Tasks permission. Sign out, then sign in again and grant access.'
      };
    }

    if (
      googleReason === 'forbidden' &&
      /has not been used|is disabled|access not configured|API has not been used/i.test(googleMessage)
    ) {
      return {
        code: 'api_not_enabled',
        message:
          'Google Tasks API is disabled for this project or not yet propagated. Enable API and wait a few minutes.'
      };
    }

    return {
      code: 'forbidden',
      message:
        'Google denied this request. Confirm OAuth consent/test users and Google Tasks API access.'
    };
  }

  if (status === 429) {
    return {
      code: 'rate_limit',
      message: 'Too many requests. Please wait and try again.'
    };
  }

  if (
    error.code === 'ENOTFOUND' ||
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'EAI_AGAIN'
  ) {
    return {
      code: 'network_error',
      message: 'Network issue detected. Check connection and try again.'
    };
  }

  return {
    code: error.code || 'unknown_error',
    message: googleMessage || error.message || 'Unknown error'
  };
}

function toIPCError(serialized) {
  const error = new Error(serialized.message || 'Something went wrong.');
  error.code = serialized.code || 'unknown_error';
  return error;
}

function loadEnvironment() {
  const candidatePaths = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '../../.env'),
    path.join(process.resourcesPath || '', '.env'),
    path.join(process.resourcesPath || '', 'app.env'),
    path.join(os.homedir(), '.mtasks.env'),
    path.join(os.homedir(), 'Library/Application Support/mTasks/.env')
  ];

  for (const envPath of candidatePaths) {
    if (!envPath || !fs.existsSync(envPath)) {
      continue;
    }
    dotenv.config({ path: envPath, override: false });
  }
}
