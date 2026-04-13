import { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '../store/useTaskStore';

export default function CreateTaskInput() {
  const createTask = useTaskStore((s) => s.createTask);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      createTask(value.trim());
      setValue('');
    } else if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  return (
    <div className="border-t border-border px-4 py-3 bg-panel no-drag shrink-0">
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-accent shrink-0"
        >
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={inputRef}
          data-create-input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task..."
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted outline-none"
        />
        <kbd className="hidden sm:inline text-[10px] text-muted/60 border border-border/60 rounded px-1 py-0.5 font-mono select-none">
          {'\u2318'}K
        </kbd>
      </div>
    </div>
  );
}
