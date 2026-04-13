# mTasks

Minimal macOS menu bar task manager for Google Tasks, built with Electron + React + Tailwind + Zustand.

## Features

- Native menu bar/tray app with compact dropdown window
- Google OAuth 2.0 login in system browser (loopback callback, PKCE)
- Secure token storage in macOS Keychain via `keytar`
- Google Tasks support:
  - fetch task lists
  - switch lists
  - create task
  - mark complete/incomplete
  - rename task
  - delete task
- Optimistic UI updates + silent background sync
- Offline fallback using local cache (`electron-store`)
- Keyboard UX:
  - `Enter` creates a task
  - `Cmd + K` focuses create input
- Subtle toast error feedback
- Dark mode + settings menu (theme, sync interval, auto-launch, dock icon visibility)

## Project Structure

```text
electron/
  main/
    AuthManager.js      # OAuth login, refresh, keychain persistence
    TaskService.js      # Google Tasks API integration
    index.js            # Tray window + IPC + app lifecycle
  preload/
    index.js            # Safe renderer bridge (contextBridge)

src/renderer/
  components/
    App.jsx
    Header.jsx
    TaskList.jsx
    TaskItem.jsx
    CreateTaskInput.jsx
    LoginScreen.jsx
    Toast.jsx
    EmptyState.jsx
  store/
    useAuthStore.js
    useTaskStore.js
    useSettingsStore.js
  lib/
    bridge.js
  main.jsx
  main.css
  index.html
```

## Step-by-Step Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. In Google Cloud Console:

- Create/select a project.
- Enable `Google Tasks API`.
- Configure OAuth consent screen.
- Create OAuth client credentials of type `Desktop app`.
- Copy the client ID into `GOOGLE_CLIENT_ID`.
- If a client secret is shown, put it in `GOOGLE_CLIENT_SECRET`.
- Add loopback redirect URI:  
  `http://127.0.0.1:42813/oauth2callback`  
  (or your custom `GOOGLE_OAUTH_REDIRECT_PORT` value).

4. Run in development:

```bash
npm run dev
```

5. Click the tray icon and sign in with Google.

## Build and Package (.dmg)

1. Build renderer:

```bash
npm run build:renderer
```

2. Build macOS DMG:

```bash
npm run build
```

3. Artifacts are created in `release/`.

`electron-builder` copies your project root `.env` into the packaged app resources as `app.env`.
That means DMG/app launches can read OAuth keys without manual copying.

Important:
- Ensure `.env` is present and correct before running `npm run build`.
- Keys embedded in app resources can be extracted from the bundle, so avoid shipping sensitive secrets.

## Architecture Notes

- Main process owns privileged operations:
  - OAuth/token lifecycle
  - Google API calls
  - Keychain and local cache
  - Auto-launch and dock visibility
- Renderer is UI-only and talks through preload IPC bridge.
- Errors are normalized in main process (`serializeError`) before returning to renderer.
- Cached tasks/lists are used when network/API calls fail.

## Environment Variables

- `GOOGLE_CLIENT_ID` (required)
- `GOOGLE_CLIENT_SECRET` (optional)
- `GOOGLE_OAUTH_REDIRECT_PORT` (optional, default `42813`)

Packaging behavior:
- During `npm run build`, root `.env` is embedded into the app as `Resources/app.env`.

Optional runtime fallback locations (only needed if you do not embed `.env` at build time):

- `~/Library/Application Support/mTasks/.env` (recommended)
- `~/.mtasks.env`

## Limitations / TODOs

- Drag-and-drop reordering is not implemented yet.
- Bundle currently uses default app icon at package time.
- If you run only `vite` in browser (without Electron), bridge APIs are unavailable by design.

## Troubleshooting

- `App bridge is not available`:
  - close all Electron processes
  - run `npm run dev` (not `npm run dev:renderer`)
  - relaunch the menu bar app
- OAuth login timeout:
  - confirm redirect port matches your Google OAuth desktop client config.
