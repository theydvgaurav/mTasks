import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTaskStore } from '../store/useTaskStore';
import { cn } from '../utils/cn';

export default function TaskItem({ task }) {
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const updateTaskTitle = useTaskStore((s) => s.updateTaskTitle);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (task.completed || task.id.startsWith('temp-')) return;
    setEditValue(task.title);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.title) {
      updateTaskTitle(task.id, trimmed);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(task.title);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        'flex items-start gap-2.5 py-2 px-1 group rounded-lg transition-colors',
        !task.completed && 'hover:bg-surface/60'
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => toggleTask(task.id)}
        disabled={task.id.startsWith('temp-')}
        className="mt-0.5 shrink-0 disabled:opacity-40"
      >
        <div
          className={cn(
            'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all duration-150',
            task.completed
              ? 'bg-success border-success'
              : 'border-border group-hover:border-accent/50'
          )}
        >
          {task.completed && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path
                d="M2.5 5l2 2L7.5 3.5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          )}
        </div>
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0 mt-px">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="text-sm bg-transparent text-ink w-full outline-none border-b border-accent/40 pb-0.5"
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            className={cn(
              'text-sm leading-snug block cursor-default select-none',
              task.completed ? 'line-through text-muted' : 'text-ink'
            )}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Delete */}
      {!task.id.startsWith('temp-') && (
        <button
          onClick={() => deleteTask(task.id)}
          className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M10.5 3.5l-7 7M3.5 3.5l7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </motion.div>
  );
}
