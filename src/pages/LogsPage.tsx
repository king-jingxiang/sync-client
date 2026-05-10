import { useEffect, useState } from "react";
import { useLogStore } from "@/stores/logStore";
import { useTaskStore } from "@/stores/taskStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download, ChevronRight } from "lucide-react";
import { formatDate, formatBytes, formatDuration } from "@/lib/utils";
import type { SyncLog } from "@/lib/types";

const STATUS_VARIANT: Record<string, "success" | "destructive" | "secondary" | "warning"> = {
  completed: "success",
  failed: "destructive",
  running: "warning",
  cancelled: "secondary",
};

export function LogsPage() {
  const { logs, currentChanges, fetchLogs, fetchChanges, getLogContent } = useLogStore();
  const { tasks, fetchTasks } = useTaskStore();
  const [filterTaskId, setFilterTaskId] = useState<number | "">("");
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const [logContent, setLogContent] = useState<string>("");

  useEffect(() => {
    fetchTasks();
    fetchLogs();
  }, []);

  const handleFilter = () => {
    fetchLogs(filterTaskId || undefined, 100);
  };

  const handleViewLog = async (log: SyncLog) => {
    setSelectedLog(log);
    await fetchChanges(log.id);
    if (log.log_path) {
      const content = await getLogContent(log.log_path);
      setLogContent(content);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">同步日志</h1>
          <p className="text-sm text-[var(--muted-foreground)]">查看同步历史与详细日志</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-end gap-4 py-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">按任务筛选</label>
            <Select
              value={filterTaskId.toString()}
              onChange={(e) => setFilterTaskId(e.target.value ? parseInt(e.target.value) : "")}
            >
              <option value="">全部任务</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id.toString()}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="outline" onClick={handleFilter}>
            筛选
          </Button>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>任务</TableHead>
              <TableHead className="w-16">方向</TableHead>
              <TableHead className="w-20">状态</TableHead>
              <TableHead className="w-20">文件数</TableHead>
              <TableHead className="w-24">传输量</TableHead>
              <TableHead className="w-16">新增</TableHead>
              <TableHead className="w-16">修改</TableHead>
              <TableHead className="w-16">删除</TableHead>
              <TableHead className="w-16">错误</TableHead>
              <TableHead className="w-36">开始时间</TableHead>
              <TableHead className="w-16">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.task_name ?? `#${log.task_id}`}</TableCell>
                <TableCell className="text-xs">{log.direction}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[log.status] ?? "secondary"}>{log.status}</Badge>
                </TableCell>
                <TableCell>{log.total_files}</TableCell>
                <TableCell className="text-xs">{formatBytes(log.transferred_bytes)}</TableCell>
                <TableCell>{log.added_count}</TableCell>
                <TableCell>{log.modified_count}</TableCell>
                <TableCell>{log.deleted_count}</TableCell>
                <TableCell>{log.error_count > 0 ? <span className="text-[var(--destructive)]">{log.error_count}</span> : 0}</TableCell>
                <TableCell className="text-xs">{formatDate(log.started_at)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleViewLog(log)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-[var(--muted-foreground)] py-8">
                  暂无同步日志
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedLog && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">
              日志详情 - {selectedLog.task_name ?? `#${selectedLog.task_id}`}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
              关闭
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value="changes" onValueChange={() => {}}>
              <TabsList>
                <TabsTrigger value="changes">变更记录 ({currentChanges.length})</TabsTrigger>
                <TabsTrigger value="raw">原始日志</TabsTrigger>
              </TabsList>
              <TabsContent value="changes">
                {currentChanges.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>文件路径</TableHead>
                        <TableHead className="w-16">类型</TableHead>
                        <TableHead className="w-16">来源</TableHead>
                        <TableHead className="w-24">大小</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentChanges.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.file_path}</TableCell>
                          <TableCell>
                            <Badge variant={
                              c.change_type === "added" ? "success" :
                              c.change_type === "modified" ? "warning" :
                              c.change_type === "deleted" ? "destructive" : "default"
                            }>
                              {c.change_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{c.side ?? "-"}</TableCell>
                          <TableCell className="text-xs">
                            {c.local_size != null ? formatBytes(c.local_size) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-4 text-center text-[var(--muted-foreground)]">无变更记录</p>
                )}
              </TabsContent>
              <TabsContent value="raw">
                <ScrollArea className="h-64 rounded-md bg-[var(--muted)] p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {logContent || "无日志内容"}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
