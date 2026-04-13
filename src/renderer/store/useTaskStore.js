import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useSettingsStore } from './useSettingsStore';
import { ensureBridge } from '../lib/bridge';

let toastTimeout = null;
let syncInterval = null;

export const useTaskStore = create((set, get) => ({
  taskLists: [],
  tasks: [],
  isLoadingLists: false,
  isLoadingTasks: false,
  isSyncing: false,
  toast: null,
  blockingError: null,
  isComposerFocused: false,

  fetchTaskLists: async () => {
    set({ isLoadingLists: true });
    try {
      const bridge = ensureBridge();
      const response = await bridge.tasks.getTaskLists();
      set({ taskLists: response.taskLists, isLoadingLists: false, blockingError: null });

      if (response.stale && response.warning) {
        get().showToast({ type: 'warning', message: response.warning });
      }

      const settings = useSettingsStore.getState();
      if (!settings.selectedTaskListId && response.defaultTaskListId) {
        await settings.setSelectedTaskListId(response.defaultTaskListId);
      }

      return response;
    } catch (error) {
      set({ isLoadingLists: false });
      get().handleError(error);
      return null;
    }
  },

  fetchTasks: async (taskListId) => {
    if (!taskListId) return;
    set({ isLoadingTasks: true });
    try {
      const bridge = ensureBridge();
      const response = await bridge.tasks.getTasks(taskListId);
      set({ tasks: sortTasks(response.tasks), isLoadingTasks: false, blockingError: null });

      if (response.stale && response.warning) {
        get().showToast({ type: 'warning', message: response.warning });
      }
    } catch (error) {
      set({ isLoadingTasks: false });
      get().handleError(error);
    }
  },

  createTask: async (title) => {
    const listId = useSettingsStore.getState().selectedTaskListId;
    if (!listId || !title.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const tempTask = {
      id: tempId,
      title: title.trim(),
      notes: '',
      status: 'needsAction',
      completed: false,
      completedAt: null,
      due: null,
      parent: null,
      position: '00000000000000000000',
      updatedAt: new Date().toISOString()
    };

    set((state) => ({ tasks: [tempTask, ...state.tasks] }));

    try {
      const bridge = ensureBridge();
      const realTask = await bridge.tasks.createTask(listId, { title: title.trim() });
      set((state) => ({
        tasks: sortTasks(state.tasks.map((t) => (t.id === tempId ? realTask : t)))
      }));
    } catch (error) {
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== tempId) }));
      get().handleError(error);
    }
  },

  toggleTask: async (taskId) => {
    const listId = useSettingsStore.getState().selectedTaskListId;
    if (!listId) return;

    const task = get().tasks.find((t) => t.id === taskId);
    if (!task || task.id.startsWith('temp-')) return;

    const newCompleted = !task.completed;
    set((state) => ({
      tasks: sortTasks(
        state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: newCompleted,
                status: newCompleted ? 'completed' : 'needsAction',
                completedAt: newCompleted ? new Date().toISOString() : null
              }
            : t
        )
      )
    }));

    try {
      const bridge = ensureBridge();
      await bridge.tasks.updateTask(listId, taskId, { completed: newCompleted });
    } catch (error) {
      set((state) => ({
        tasks: sortTasks(
          state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  completed: !newCompleted,
                  status: !newCompleted ? 'completed' : 'needsAction',
                  completedAt: !newCompleted ? task.completedAt : null
                }
              : t
          )
        )
      }));
      get().handleError(error);
    }
  },

  updateTaskTitle: async (taskId, newTitle) => {
    const listId = useSettingsStore.getState().selectedTaskListId;
    if (!listId || !newTitle.trim()) return;

    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const oldTitle = task.title;
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, title: newTitle.trim() } : t))
    }));

    try {
      const bridge = ensureBridge();
      await bridge.tasks.updateTask(listId, taskId, { title: newTitle.trim() });
    } catch (error) {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, title: oldTitle } : t))
      }));
      get().handleError(error);
    }
  },

  deleteTask: async (taskId) => {
    const listId = useSettingsStore.getState().selectedTaskListId;
    if (!listId) return;

    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) }));

    try {
      const bridge = ensureBridge();
      await bridge.tasks.deleteTask(listId, taskId);
    } catch (error) {
      set((state) => ({ tasks: sortTasks([...state.tasks, task]) }));
      get().handleError(error);
    }
  },

  startSync: () => {
    get().stopSync();
    const interval = useSettingsStore.getState().syncIntervalSec * 1000;
    syncInterval = setInterval(() => get().silentSync(), interval);
  },

  silentSync: async () => {
    const listId = useSettingsStore.getState().selectedTaskListId;
    if (!listId || get().isSyncing || get().isComposerFocused) return;

    set({ isSyncing: true });
    try {
      const bridge = ensureBridge();
      const response = await bridge.tasks.getTasks(listId);
      const serverTasks = response.tasks;
      const localTempTasks = get().tasks.filter((t) => t.id.startsWith('temp-'));
      set({ tasks: sortTasks([...localTempTasks, ...serverTasks]), isSyncing: false });
    } catch {
      set({ isSyncing: false });
    }
  },

  stopSync: () => {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  },

  showToast: ({ type, message }) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    const id = Date.now();
    set({ toast: { id, type, message } });
    toastTimeout = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3000);
  },

  dismissToast: () => {
    if (toastTimeout) clearTimeout(toastTimeout);
    set({ toast: null });
  },

  setComposerFocused: (value) => {
    set({ isComposerFocused: Boolean(value) });
  },

  clearBlockingError: () => {
    set({ blockingError: null });
  },

  handleError: (error) => {
    if (error?.code === 'unauthorized') {
      useAuthStore.getState().logout();
      return;
    }

    if (isBlockingErrorCode(error?.code)) {
      set({
        blockingError: {
          code: error.code,
          ...toBlockingPresentation(error)
        }
      });
      return;
    }

    get().showToast({
      type: 'error',
      message: error?.message || 'Something went wrong.'
    });
  },

  reset: () => {
    get().stopSync();
    set({
      taskLists: [],
      tasks: [],
      isLoadingLists: false,
      isLoadingTasks: false,
      isSyncing: false,
      toast: null,
      blockingError: null,
      isComposerFocused: false
    });
  }
}));

function isBlockingErrorCode(code) {
  return [
    'api_not_enabled',
    'oauth_not_configured',
    'oauth_invalid_client',
    'oauth_unauthorized_client',
    'oauth_redirect_uri_mismatch',
    'oauth_callback_port_in_use',
    'bridge_unavailable'
  ].includes(code);
}

function toBlockingPresentation(error) {
  const fallbackMessage = error?.message || 'Something went wrong while loading your tasks.';
  const byCode = {
    api_not_enabled: {
      title: 'Enable Google Tasks API',
      message:
        'Your OAuth login works, but Google Tasks API is disabled for this project. Enable it in Google Cloud and retry.'
    },
    oauth_not_configured: {
      title: 'OAuth Not Configured',
      message:
        'Set GOOGLE_CLIENT_ID in your environment and relaunch the app before signing in.'
    },
    oauth_invalid_client: {
      title: 'Invalid OAuth Client',
      message:
        'Your Google OAuth client is invalid. Verify GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET and use the same Cloud project.'
    },
    oauth_unauthorized_client: {
      title: 'Unauthorized OAuth Client',
      message:
        'This OAuth client cannot use desktop login flow. Create a Desktop app OAuth client in Google Cloud.'
    },
    oauth_redirect_uri_mismatch: {
      title: 'Redirect URI Mismatch',
      message:
        'Callback URL/port does not match Google OAuth config. Check GOOGLE_OAUTH_REDIRECT_PORT and your client redirect URI.'
    },
    oauth_callback_port_in_use: {
      title: 'Port In Use',
      message:
        'Another process is using the OAuth callback port. Quit other instances or switch GOOGLE_OAUTH_REDIRECT_PORT.'
    },
    bridge_unavailable: {
      title: 'App Bridge Not Ready',
      message:
        'Electron preload bridge is unavailable. Launch via `npm run dev` or relaunch the packaged app.'
    }
  };

  const matched = byCode[error?.code];
  if (!matched) {
    return {
      title: 'Task Sync Failed',
      message: fallbackMessage
    };
  }

  return {
    ...matched,
    message: error?.message || matched.message
  };
}

function sortTasks(tasks) {
  const topLevel = tasks.filter((t) => !t.parent);
  const incomplete = topLevel
    .filter((t) => !t.completed)
    .sort((a, b) => (a.position || '').localeCompare(b.position || ''));
  const completed = topLevel
    .filter((t) => t.completed)
    .sort((a, b) => {
      if (!a.completedAt || !b.completedAt) return 0;
      return new Date(b.completedAt) - new Date(a.completedAt);
    });
  return [...incomplete, ...completed];
}
