import { useTaskStore } from "@/stores/taskStore";
import { Progress } from "@/components/ui/progress";
import { formatSpeed, formatBytes } from "@/lib/utils";

export function StatusBar() {
  const runtimeStates = useTaskStore((s) => s.runtimeStates);
  const activeTasks = Array.from(runtimeStates.values()).filter(
    (s) => s.status === "scanning" || s.status === "syncing"
  );

  if (activeTasks.length === 0) return null;

  return (
    <div className="flex h-8 items-center gap-4 border-t border-[var(--border)] bg-[var(--card)] px-4 text-xs text-[var(--muted-foreground)]">
      <span>
        {activeTasks.length} 个任务运行中
      </span>
      {activeTasks.slice(0, 2).map((task) => (
        <div key={task.task_id} className="flex items-center gap-2">
          <span className="max-w-[120px] truncate">#{task.task_id}</span>
          <Progress value={task.progress} className="h-1.5 w-20" />
          <span>{task.progress.toFixed(0)}%</span>
          {task.speed > 0 && <span>{formatSpeed(task.speed)}</span>}
        </div>
      ))}
    </div>
  );
}
