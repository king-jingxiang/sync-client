import { useEffect, useState } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GitCompareArrows, Search, Check, X, AlertTriangle } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";
import * as api from "@/lib/api";
import type { SyncChange, Task } from "@/lib/types";

const CHANGE_LABELS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "default" }> = {
  added: { label: "新增", variant: "success" },
  modified: { label: "修改", variant: "warning" },
  deleted: { label: "删除", variant: "destructive" },
  conflict: { label: "冲突", variant: "default" },
};

export function DiffPage() {
  const { tasks, fetchTasks } = useTaskStore();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [changes, setChanges] = useState<SyncChange[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleScan = async () => {
    if (!selectedTaskId) return;
    setScanning(true);
    try {
      const result = await api.scanDiff(selectedTaskId);
      setChanges(result);
    } catch (e) {
      console.error("Scan diff failed:", e);
    } finally {
      setScanning(false);
    }
  };

  const toggleSelection = (changeId: number, isSelected: boolean) => {
    setChanges((prev) =>
      prev.map((c) => (c.id === changeId ? { ...c, is_selected: isSelected } : c))
    );
  };

  const toggleAll = (isSelected: boolean) => {
    setChanges((prev) =>
      prev.map((c) => (filter === "all" || c.change_type === filter ? { ...c, is_selected: isSelected } : c))
    );
  };

  const filteredChanges = filter === "all" ? changes : changes.filter((c) => c.change_type === filter);
  const counts = {
    all: changes.length,
    added: changes.filter((c) => c.change_type === "added").length,
    modified: changes.filter((c) => c.change_type === "modified").length,
    deleted: changes.filter((c) => c.change_type === "deleted").length,
    conflict: changes.filter((c) => c.change_type === "conflict").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">差异对比</h1>
          <p className="text-sm text-[var(--muted-foreground)]">同步前预览文件变更</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-end gap-4 py-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">选择任务</label>
            <Select
              value={selectedTaskId?.toString() ?? ""}
              onChange={(e) => setSelectedTaskId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">-- 选择同步任务 --</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id.toString()}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={handleScan} disabled={!selectedTaskId || scanning}>
            <Search className="h-4 w-4" />
            {scanning ? "扫描中..." : "扫描差异"}
          </Button>
        </CardContent>
      </Card>

      {changes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">变更列表</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                全选
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                全不选
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">全部 ({counts.all})</TabsTrigger>
                <TabsTrigger value="added">新增 ({counts.added})</TabsTrigger>
                <TabsTrigger value="modified">修改 ({counts.modified})</TabsTrigger>
                <TabsTrigger value="deleted">删除 ({counts.deleted})</TabsTrigger>
                <TabsTrigger value="conflict">冲突 ({counts.conflict})</TabsTrigger>
              </TabsList>

              <TabsContent value={filter}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">同步</TableHead>
                      <TableHead>文件路径</TableHead>
                      <TableHead className="w-20">类型</TableHead>
                      <TableHead className="w-16">来源</TableHead>
                      <TableHead className="w-24">本地大小</TableHead>
                      <TableHead className="w-24">远端大小</TableHead>
                      <TableHead className="w-36">本地修改时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChanges.map((change) => {
                      const typeInfo = CHANGE_LABELS[change.change_type];
                      return (
                        <TableRow key={change.id}>
                          <TableCell>
                            <Checkbox
                              checked={change.is_selected}
                              onCheckedChange={(v) => toggleSelection(change.id, v)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[300px] truncate">
                            {change.file_path}
                          </TableCell>
                          <TableCell>
                            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {change.side ?? "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {change.local_size != null ? formatBytes(change.local_size) : "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {change.remote_size != null ? formatBytes(change.remote_size) : "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {change.local_modtime != null
                              ? new Date(change.local_modtime * 1000).toLocaleString("zh-CN")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredChanges.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-[var(--muted-foreground)] py-8">
                          没有此类型的变更
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!scanning && changes.length === 0 && selectedTaskId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitCompareArrows className="mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
            <p className="text-[var(--muted-foreground)]">点击「扫描差异」查看文件变更</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
