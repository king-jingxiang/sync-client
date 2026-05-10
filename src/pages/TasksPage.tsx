import { useEffect, useState } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { useConfigStore } from "@/stores/configStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Play,
  Square,
  FolderSync,
  Upload,
  Download,
  ArrowLeftRight,
  FolderOpen,
} from "lucide-react";
import { formatDate, formatSpeed } from "@/lib/utils";
import * as api from "@/lib/api";
import type { Task } from "@/lib/types";

const DIRECTION_LABELS: Record<string, { label: string; icon: typeof Upload; color: string }> = {
  upload: { label: "上传", icon: Upload, color: "bg-blue-500" },
  download: { label: "下载", icon: Download, color: "bg-green-500" },
  bisync: { label: "双向", icon: ArrowLeftRight, color: "bg-purple-500" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" }> = {
  idle: { label: "空闲", variant: "secondary" },
  scanning: { label: "扫描中", variant: "warning" },
  syncing: { label: "同步中", variant: "default" },
  completed: { label: "已完成", variant: "success" },
  failed: { label: "失败", variant: "destructive" },
};

export function TasksPage() {
  const { tasks, loading, fetchTasks, deleteTask, toggleTask, runTask, cancelTask, runtimeStates } =
    useTaskStore();
  const { remotes, fetchRemotes } = useConfigStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchRemotes();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">同步任务</h1>
          <p className="text-sm text-[var(--muted-foreground)]">管理文件同步任务</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          新建任务
        </Button>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
          加载中...
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderSync className="mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
            <p className="text-lg font-medium">暂无任务</p>
            <p className="text-sm text-[var(--muted-foreground)]">点击「新建任务」创建同步配置</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => {
            const runtime = runtimeStates.get(task.id);
            const dirInfo = DIRECTION_LABELS[task.direction];
            const DirIcon = dirInfo.icon;
            const statusInfo = runtime ? STATUS_LABELS[runtime.status] : STATUS_LABELS.idle;

            return (
              <Card key={task.id} className={!task.is_enabled ? "opacity-60" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md ${dirInfo.color}/10`}>
                      <DirIcon className={`h-4 w-4 ${dirInfo.color.replace("bg-", "text-")}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{task.name}</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span className="max-w-[200px] truncate">{task.local_path}</span>
                        <span>&harr;</span>
                        <span className="max-w-[200px] truncate">
                          {task.remote_name}:{task.remote_path}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <Badge variant="outline">{dirInfo.label}</Badge>
                    <Switch
                      checked={task.is_enabled}
                      onCheckedChange={(v) => toggleTask(task.id, v)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {runtime && (runtime.status === "scanning" || runtime.status === "syncing") && (
                    <div className="mb-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[300px]">{runtime.current_file ?? "处理中..."}</span>
                        <span>{runtime.progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={runtime.progress} className="h-1.5" />
                      {runtime.speed > 0 && (
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {formatSpeed(runtime.speed)}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-[var(--muted-foreground)]">
                      上次同步: {formatDate(task.last_sync_at)}
                      {task.auto_sync && task.sync_interval && ` | 间隔: ${task.sync_interval}分钟`}
                    </div>
                    <div className="flex items-center gap-1">
                      {runtime && (runtime.status === "scanning" || runtime.status === "syncing") ? (
                        <Button variant="outline" size="sm" onClick={() => cancelTask(task.id)}>
                          <Square className="h-3 w-3" />
                          停止
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!task.is_enabled}
                          onClick={() => runTask(task.id)}
                        >
                          <Play className="h-3 w-3" />
                          立即同步
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEditingTask(task)}>
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (confirm(`确定删除任务 "${task.name}" 吗？`)) {
                            await deleteTask(task.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TaskFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        remotes={remotes}
        mode="create"
      />
      <TaskFormDialog
        open={!!editingTask}
        onOpenChange={(v) => { if (!v) setEditingTask(null); }}
        remotes={remotes}
        task={editingTask}
        mode="edit"
      />
    </div>
  );
}

function TaskFormDialog({
  open,
  onOpenChange,
  remotes,
  task,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remotes: { name: string; type: string }[];
  task?: Task | null;
  mode: "create" | "edit";
}) {
  const { createTask, updateTask } = useTaskStore();
  const [name, setName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [remoteName, setRemoteName] = useState("");
  const [remotePath, setRemotePath] = useState("");
  const [direction, setDirection] = useState<"upload" | "download" | "bisync">("upload");
  const [conflictPolicy, setConflictPolicy] = useState<"newer" | "local" | "remote" | "manual">("newer");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState("");
  const [includeFilters, setIncludeFilters] = useState("");
  const [excludeFilters, setExcludeFilters] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task && mode === "edit") {
      setName(task.name);
      setLocalPath(task.local_path);
      setRemoteName(task.remote_name);
      setRemotePath(task.remote_path);
      setDirection(task.direction);
      setConflictPolicy(task.conflict_policy);
      setAutoSync(task.auto_sync);
      setSyncInterval(task.sync_interval?.toString() ?? "");
      try {
        const filters = task.filters ? JSON.parse(task.filters) : { include: [], exclude: [] };
        setIncludeFilters(filters.include?.join(", ") ?? "");
        setExcludeFilters(filters.exclude?.join(", ") ?? "");
      } catch {
        setIncludeFilters("");
        setExcludeFilters("");
      }
    } else {
      setName("");
      setLocalPath("");
      setRemoteName(remotes[0]?.name ?? "");
      setRemotePath("/");
      setDirection("upload");
      setConflictPolicy("newer");
      setAutoSync(false);
      setSyncInterval("");
      setIncludeFilters("");
      setExcludeFilters("");
    }
  }, [task, mode, open]);

  const handlePickDir = async () => {
    const path = await api.pickDirectory();
    if (path) setLocalPath(path);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !localPath.trim() || !remoteName.trim()) return;
    setSubmitting(true);
    try {
      const filters = JSON.stringify({
        include: includeFilters ? includeFilters.split(",").map((s) => s.trim()) : [],
        exclude: excludeFilters ? excludeFilters.split(",").map((s) => s.trim()) : [],
      });

      if (mode === "edit" && task) {
        await updateTask({
          ...task,
          name: name.trim(),
          local_path: localPath.trim(),
          remote_name: remoteName,
          remote_path: remotePath.trim(),
          direction,
          conflict_policy: conflictPolicy,
          auto_sync: autoSync,
          sync_interval: autoSync && syncInterval ? parseInt(syncInterval) : null,
          filters,
        });
      } else {
        await createTask({
          name: name.trim(),
          local_path: localPath.trim(),
          remote_name: remoteName,
          remote_path: remotePath.trim(),
          direction,
          conflict_policy: conflictPolicy,
          auto_sync: autoSync,
          sync_interval: autoSync && syncInterval ? parseInt(syncInterval) : null,
          is_enabled: true,
          filters,
        });
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建同步任务" : "编辑同步任务"}</DialogTitle>
          <DialogDescription>配置本地与远端的同步规则</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-auto">
          <div className="space-y-2">
            <Label>任务名称</Label>
            <Input placeholder="我的同步任务" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>本地目录</Label>
            <div className="flex gap-2">
              <Input placeholder="/path/to/local" value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
              <Button variant="outline" size="icon" onClick={handlePickDir}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Remote 名称</Label>
            <Select value={remoteName} onChange={(e) => setRemoteName(e.target.value)}>
              {remotes.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name} ({r.type})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>远端路径</Label>
            <Input placeholder="/remote/path" value={remotePath} onChange={(e) => setRemotePath(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>同步方向</Label>
            <Select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
              <option value="upload">上传 (本地 → 远端)</option>
              <option value="download">下载 (远端 → 本地)</option>
              <option value="bisync">双向同步</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>冲突策略</Label>
            <Select value={conflictPolicy} onChange={(e) => setConflictPolicy(e.target.value as typeof conflictPolicy)}>
              <option value="newer">最新优先</option>
              <option value="local">保留本地</option>
              <option value="remote">保留远端</option>
              <option value="manual">手动选择</option>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <Label>自动同步</Label>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            {autoSync && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="w-20"
                  placeholder="30"
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value)}
                />
                <span className="text-sm text-[var(--muted-foreground)]">分钟</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>包含规则 (逗号分隔)</Label>
            <Input placeholder="*.doc, *.pdf" value={includeFilters} onChange={(e) => setIncludeFilters(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>排除规则 (逗号分隔)</Label>
            <Input placeholder="*.tmp, node_modules/" value={excludeFilters} onChange={(e) => setExcludeFilters(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim() || !localPath.trim()}>
            {submitting ? "保存中..." : mode === "create" ? "创建" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
