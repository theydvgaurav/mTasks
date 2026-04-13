import { create } from 'zustand';
import { ensureBridge, waitForBridge } from '../lib/bridge';

export const useAuthStore = create((set) => ({
  status: 'loading',
  user: null,
  loginError: null,

  initialize: async () => {
    const bridge = await waitForBridge();
    if (!bridge) {
      set({
        status: 'unauthenticated',
        user: null,
        loginError:
          'App bridge is not available. Start with `npm run dev` and fully relaunch Electron.'
      });
      return;
    }
    try {
      const session = await bridge.auth.getSession();
      if (session.isAuthenticated) {
        set({ status: 'authenticated', user: session.user, loginError: null });
      } else {
        set({ status: 'unauthenticated', user: null, loginError: null });
      }
    } catch {
      set({ status: 'unauthenticated', user: null, loginError: null });
    }
  },

  login: async () => {
    set({ status: 'loading', loginError: null });
    try {
      const bridge = ensureBridge();
      const session = await bridge.auth.login();
      if (session.isAuthenticated) {
        set({ status: 'authenticated', user: session.user, loginError: null });
      } else {
        set({ status: 'unauthenticated', loginError: 'Login failed. Please try again.' });
      }
    } catch (error) {
      set({
        status: 'unauthenticated',
        loginError: error?.message || 'Login failed. Please try again.'
      });
    }
  },

  logout: async () => {
    try {
      const bridge = ensureBridge();
      await bridge.auth.logout();
    } catch {
      // Continue with local cleanup
    }
    set({ status: 'unauthenticated', user: null, loginError: null });
  }
}));
