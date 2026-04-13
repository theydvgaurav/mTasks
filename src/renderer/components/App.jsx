import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTaskStore } from '../store/useTaskStore';
import LoginScreen from './LoginScreen';
import Header from './Header';
import TaskList from './TaskList';
import CreateTaskInput from './CreateTaskInput';
import Toast from './Toast';

export default function App() {
  const status = useAuthStore((s) => s.status);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const initializeSettings = useSettingsStore((s) => s.initialize);
  const selectedTaskListId = useSettingsStore((s) => s.selectedTaskListId);
  const syncIntervalSec = useSettingsStore((s) => s.syncIntervalSec);
  const fetchTaskLists = useTaskStore((s) => s.fetchTaskLists);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const startSync = useTaskStore((s) => s.startSync);
  const stopSync = useTaskStore((s) => s.stopSync);
  const reset = useTaskStore((s) => s.reset);

  // Initialize auth + settings on mount
  useEffect(() => {
    initializeAuth();
    initializeSettings();
  }, []);

  // When authenticated, load tasks and start sync
  useEffect(() => {
    if (status !== 'authenticated') {
      reset();
      return;
    }

    let cancelled = false;

    const load = async () => {
      const response = await fetchTaskLists();
      if (cancelled) return;

      const listId =
        useSettingsStore.getState().selectedTaskListId || response?.defaultTaskListId;
      if (listId) {
        await fetchTasks(listId);
      }
      if (!cancelled) {
        startSync();
      }
    };

    load();
    return () => {
      cancelled = true;
      stopSync();
    };
  }, [status]);

  // Re-fetch when selected list changes (after initial load)
  useEffect(() => {
    if (status === 'authenticated' && selectedTaskListId) {
      fetchTasks(selectedTaskListId);
    }
  }, [selectedTaskListId]);

  useEffect(() => {
    if (status === 'authenticated') {
      startSync();
    }
  }, [status, syncIntervalSec]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <LoginScreen />;
  }

  return (
    <div className="flex flex-col h-screen bg-panel text-ink font-ui overflow-hidden no-drag">
      <Header />
      <TaskList />
      <CreateTaskInput />
      <Toast />
    </div>
  );
}
