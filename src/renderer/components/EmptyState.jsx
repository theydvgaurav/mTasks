import { motion } from 'framer-motion';

export default function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.3 }}
      className="flex-1 flex flex-col items-center justify-center text-center px-8 select-none"
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        className="text-muted/30"
      >
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" />
        <path
          d="M16 24l5.5 5.5L32 19"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-base font-medium text-ink mt-3">All clear</p>
      <p className="text-sm text-muted mt-1">
        Press <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-xs font-mono">Enter</kbd> to add a task
      </p>
    </motion.div>
  );
}
