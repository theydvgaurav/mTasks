const BRIDGE_KEYS = ['mtasks', 'appBridge'];

export function getBridge() {
  for (const key of BRIDGE_KEYS) {
    const candidate = window[key];
    if (candidate?.auth && candidate?.tasks && candidate?.settings) {
      return candidate;
    }
  }
  return null;
}

export async function waitForBridge(timeoutMs = 1500) {
  const existing = getBridge();
  if (existing) {
    return existing;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 30));
    const bridge = getBridge();
    if (bridge) {
      return bridge;
    }
  }

  return null;
}

export function ensureBridge() {
  const bridge = getBridge();
  if (bridge) {
    return bridge;
  }

  const error = new Error(
    'App bridge is not available. Start the app with Electron (`npm run dev`) and relaunch.'
  );
  error.code = 'bridge_unavailable';
  throw error;
}
