import { AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../store/useTaskStore';
import TaskItem from './TaskItem';
import EmptyState from './EmptyState';

function Skeleton() {
  return (
    <div className="space-y-2 px-1 py-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2">
          <div className="w-[18px] h-[18px] rounded-full bg-surface animate-pulse" />
          <div
            className="h-4 bg-surface animate-pulse rounded"
            style={{ width: `${60 + Math.random() * 30}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function TaskList() {
  const tasks = useTaskStore((s) => s.tasks);
  const isLoadingTasks = useTaskStore((s) => s.isLoadingTasks);

  if (isLoadingTasks && tasks.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <Skeleton />
      </div>
    );
  }

  if (tasks.length === 0) {
    return <EmptyState />;
  }

  const incomplete = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 no-drag">
      <AnimatePresence mode="popLayout">
        {incomplete.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </AnimatePresence>

      {completed.length > 0 && (
        <>
          <div className="text-[11px] text-muted uppercase tracking-wide mt-3 mb-1 px-1 select-none font-medium">
            Completed
          </div>
          <AnimatePresence mode="popLayout">
            {completed.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
