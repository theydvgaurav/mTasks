import { AnimatePresence, motion } from 'framer-motion';
import { useTaskStore } from '../store/useTaskStore';

const dotColors = {
  error: 'bg-danger',
  success: 'bg-success',
  warning: 'bg-accent'
};

export default function Toast() {
  const toast = useTaskStore((s) => s.toast);
  const dismissToast = useTaskStore((s) => s.dismissToast);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-16 left-4 right-4 z-50 no-drag"
        >
          <div className="bg-surface border border-border rounded-lg shadow-panel px-3 py-2 text-xs flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[toast.type] || 'bg-muted'}`} />
            <span className="text-ink flex-1 truncate">{toast.message}</span>
            <button
              onClick={dismissToast}
              className="text-muted hover:text-ink transition-colors shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
