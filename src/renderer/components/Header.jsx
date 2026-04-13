import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useTaskStore } from '../store/useTaskStore';
import { useSettingsStore } from '../store/useSettingsStore';

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const taskLists = useTaskStore((s) => s.taskLists);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const selectedTaskListId = useSettingsStore((s) => s.selectedTaskListId);
  const setSelectedTaskListId = useSettingsStore((s) => s.setSelectedTaskListId);
  const theme = useSettingsStore((s) => s.theme);
  const autoLaunch = useSettingsStore((s) => s.autoLaunch);
  const hideDockIcon = useSettingsStore((s) => s.hideDockIcon);
  const syncIntervalSec = useSettingsStore((s) => s.syncIntervalSec);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setAutoLaunch = useSettingsStore((s) => s.setAutoLaunch);
  const setHideDockIcon = useSettingsStore((s) => s.setHideDockIcon);
  const setSyncIntervalSec = useSettingsStore((s) => s.setSyncIntervalSec);

  const initial = (user?.name || user?.email || '?')[0].toUpperCase();
  const activeListId = selectedTaskListId || taskLists[0]?.id || null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleTabClick = async (id) => {
    if (!id || id === activeListId) {
      return;
    }
    await setSelectedTaskListId(id);
    fetchTasks(id);
  };

  return (
    <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border shrink-0">
      {/* Top bar — drag region */}
      <div className="flex items-center justify-between drag">
        <div className="flex items-center gap-2 no-drag">
          <div className="w-7 h-7 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-semibold select-none">
            {initial}
          </div>
          <span className="text-sm font-medium text-ink truncate max-w-[200px] select-none">
            {user?.name || user?.email || 'User'}
          </span>
        </div>

        <div className="flex items-center gap-1 no-drag">
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((open) => !open)}
              className="text-muted hover:text-ink transition-colors p-1 rounded"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6.7 1.8h2.6l.3 1.4c.3.1.5.2.8.3l1.2-.7 1.8 1.8-.7 1.2.3.8 1.4.3v2.6l-1.4.3c-.1.3-.2.5-.3.8l.7 1.2-1.8 1.8-1.2-.7-.8.3-.3 1.4H6.7l-.3-1.4-.8-.3-1.2.7-1.8-1.8.7-1.2-.3-.8-1.4-.3V6.7l1.4-.3c.1-.3.2-.5.3-.8l-.7-1.2 1.8-1.8 1.2.7.8-.3.3-1.4z"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-8 z-30 w-52 rounded-xl border border-border bg-surface shadow-panel p-2 space-y-2">
                <label className="block text-[11px] text-muted px-1">Theme</label>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  className="w-full text-xs rounded-md border border-border bg-panel px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent/40"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>

                <label className="block text-[11px] text-muted px-1">Sync Interval</label>
                <select
                  value={syncIntervalSec}
                  onChange={(event) => setSyncIntervalSec(Number(event.target.value))}
                  className="w-full text-xs rounded-md border border-border bg-panel px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent/40"
                >
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                </select>

                <label className="flex items-center justify-between text-xs px-1 pt-1">
                  <span className="text-ink">Launch at Login</span>
                  <input
                    type="checkbox"
                    checked={autoLaunch}
                    onChange={(event) => setAutoLaunch(event.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between text-xs px-1">
                  <span className="text-ink">Hide Dock Icon</span>
                  <input
                    type="checkbox"
                    checked={hideDockIcon}
                    onChange={(event) => setHideDockIcon(event.target.checked)}
                  />
                </label>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className="text-muted hover:text-danger transition-colors p-1 rounded"
            title="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M10.5 11.5L14 8l-3.5-3.5M14 8H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Task list tabs */}
      {taskLists.length > 1 && (
        <div className="no-drag -mx-1 px-1 overflow-x-auto">
          <div className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-surface p-1">
            {taskLists.map((list) => {
              const isActive = list.id === activeListId;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handleTabClick(list.id)}
                  className={`relative rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="task-list-active-tab"
                      className="absolute inset-0 rounded-lg bg-panel shadow-sm"
                      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{list.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
