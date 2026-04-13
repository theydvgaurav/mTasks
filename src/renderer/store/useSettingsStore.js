import { create } from 'zustand';
import { ensureBridge } from '../lib/bridge';

let mediaQueryCleanup = null;

export const useSettingsStore = create((set, get) => ({
  theme: 'system',
  autoLaunch: false,
  hideDockIcon: true,
  syncIntervalSec: 30,
  selectedTaskListId: null,
  loaded: false,

  initialize: async () => {
    try {
      const bridge = ensureBridge();
      const settings = await bridge.settings.get();
      set({
        theme: settings.theme || 'system',
        autoLaunch: Boolean(settings.autoLaunch),
        hideDockIcon: Boolean(settings.hideDockIcon),
        syncIntervalSec: settings.syncIntervalSec || 30,
        selectedTaskListId: settings.selectedTaskListId || null,
        loaded: true
      });
      get().applyTheme();
    } catch {
      set({ loaded: true });
      get().applyTheme();
    }
  },

  setTheme: async (theme) => {
    set({ theme });
    get().applyTheme();
    const bridge = ensureBridge();
    await bridge.settings.update({ theme });
  },

  setAutoLaunch: async (autoLaunch) => {
    set({ autoLaunch: Boolean(autoLaunch) });
    const bridge = ensureBridge();
    await bridge.settings.update({ autoLaunch: Boolean(autoLaunch) });
  },

  setHideDockIcon: async (hideDockIcon) => {
    set({ hideDockIcon: Boolean(hideDockIcon) });
    const bridge = ensureBridge();
    await bridge.settings.update({ hideDockIcon: Boolean(hideDockIcon) });
  },

  setSyncIntervalSec: async (seconds) => {
    const syncIntervalSec = Math.max(10, Math.min(300, Number(seconds) || 30));
    set({ syncIntervalSec });
    const bridge = ensureBridge();
    await bridge.settings.update({ syncIntervalSec });
  },

  setSelectedTaskListId: async (id) => {
    set({ selectedTaskListId: id });
    const bridge = ensureBridge();
    await bridge.settings.update({ selectedTaskListId: id });
  },

  applyTheme: () => {
    const { theme } = get();

    if (mediaQueryCleanup) {
      mediaQueryCleanup();
      mediaQueryCleanup = null;
    }

    if (theme === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    } else if (theme === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light';

      const handler = (e) => {
        document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
      };
      mq.addEventListener('change', handler);
      mediaQueryCleanup = () => mq.removeEventListener('change', handler);
    }
  }
}));
