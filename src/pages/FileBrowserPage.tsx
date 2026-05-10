import { useEffect, useState, useMemo, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFileStore } from "@/stores/fileStore";
import { useConfigStore } from "@/stores/configStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
  FolderOpen,
  File,
  Download,
  Upload,
  Trash2,
  FolderPlus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  HardDrive,
  ChevronRight as ChevronBreadcrumb,
  ArrowUp,
} from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";
import * as api from "@/lib/api";
import type { RemoteFile } from "@/lib/types";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

export function FileBrowserPage() {
  const {
    currentRemote,
    currentPath,
    files,
    loading,
    error,
    page,
    pageSize,
    selectedPaths,
    transferring,
    transferProgress,
    browse,
    navigateToFolder,
    navigateUp,
    navigateToPathIndex,
    setPage,
    setPageSize,
    toggleSelection,
    selectAll,
    clearSelection,
    uploadFiles,
    downloadSelected,
    deleteSelected,
    createFolder,
    refresh,
  } = useFileStore();

  const { remotes, fetchRemotes } = useConfigStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    fetchRemotes();
  }, []);

  // Auto-select first remote
  useEffect(() => {
    if (!currentRemote && remotes.length > 0) {
      browse(remotes[0].name, "");
    }
  }, [remotes, currentRemote]);

  // Drag & drop listeners
  useEffect(() => {
    const unlistenEnter = listen<{ paths: string[] }>("tauri://drag-enter", () => {
      setIsDragOver(true);
    });
    const unlistenDrop = listen<{ paths: string[] }>("tauri://drag-drop", async (event) => {
      setIsDragOver(false);
      const paths = event.payload.paths;
      if (paths.length > 0 && currentRemote) {
        try {
          await uploadFiles(paths);
        } catch (e) {
          console.error("Upload failed:", e);
        }
      }
    });
    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragOver(false);
    });

    return () => {
      unlistenEnter.then((fn) => fn());
      unlistenDrop.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
    };
  }, [currentRemote, currentPath]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(files.length / pageSize));
  const paginatedFiles = useMemo(() => {
    const start = (page - 1) * pageSize;
    return files.slice(start, start + pageSize);
  }, [files, page, pageSize]);

  const allCurrentPageSelected = useMemo(() => {
    if (paginatedFiles.length === 0) return false;
    return paginatedFiles.every((f) => selectedPaths.has(f.path));
  }, [paginatedFiles, selectedPaths]);

  // Breadcrumb path segments
  const pathSegments = useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  // Handlers
  const handleRemoteChange = (name: string) => {
    browse(name, "");
  };

  const handleUploadClick = async () => {
    try {
      const paths = await api.pickFiles();
      if (paths && paths.length > 0) {
        await uploadFiles(paths);
      }
    } catch (e) {
      console.error("File pick failed:", e);
    }
  };

  const handleDownloadClick = async () => {
    if (selectedPaths.size === 0) return;
    try {
      const dir = await api.pickDirectory();
      if (dir) {
        const results = await downloadSelected(dir);
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          alert(`下载完成，其中 ${failed.length} 个文件失败`);
        }
      }
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleDeleteClick = async () => {
    if (selectedPaths.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedPaths.size} 个项目吗？`)) return;
    try {
      await deleteSelected();
    } catch (e) {
      alert(`删除失败: ${e}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      setShowNewFolder(false);
      setNewFolderName("");
    } catch (e) {
      alert(`创建文件夹失败: ${e}`);
    }
  };

  const handleFileDoubleClick = (file: RemoteFile) => {
    if (file.is_dir) {
      navigateToFolder(file);
    }
  };

  const getFileIcon = (file: RemoteFile) => {
    if (file.is_dir) {
      return <FolderOpen className="h-4 w-4 text-[var(--warning)]" />;
    }
    return <File className="h-4 w-4 text-[var(--muted-foreground)]" />;
  };

  const selectedFileCount = useMemo(() => {
    const selectedFiles = files.filter((f) => selectedPaths.has(f.path) && !f.is_dir);
    return selectedFiles.length;
  }, [files, selectedPaths]);

  return (
    <div className="space-y-4 relative" style={{ minHeight: "400px" }}>
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--primary)]/5 border-4 border-dashed border-[var(--primary)] rounded-lg m-4">
          <div className="flex flex-col items-center gap-3 p-8 bg-[var(--card)] rounded-xl shadow-lg">
            <Upload className="h-12 w-12 text-[var(--primary)]" />
            <p className="text-lg font-medium">拖拽文件到此处上传</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              将上传到: {currentRemote}{currentPath ? `:${currentPath}` : ":/"}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文件浏览</h1>
          <p className="text-sm text-[var(--muted-foreground)]">浏览和管理远程存储文件</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewFolder(true)}
            disabled={!currentRemote || transferring}
          >
            <FolderPlus className="h-4 w-4" />
            新建文件夹
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={!currentRemote || transferring}
          >
            <Upload className="h-4 w-4" />
            上传
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadClick}
            disabled={selectedFileCount === 0 || transferring}
          >
            <Download className="h-4 w-4" />
            下载 {selectedFileCount > 0 ? `(${selectedFileCount})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteClick}
            disabled={selectedPaths.size === 0 || transferring}
          >
            <Trash2 className="h-4 w-4" />
            删除 {selectedPaths.size > 0 ? `(${selectedPaths.size})` : ""}
          </Button>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading || !currentRemote}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Transfer Progress */}
      {transferring && transferProgress && (
        <Card>
          <CardContent className="py-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[400px]">
                  {transferProgress.currentFile || "处理中..."}
                </span>
                <span className="text-[var(--muted-foreground)]">
                  {transferProgress.current}/{transferProgress.total}
                </span>
              </div>
              <Progress
                value={
                  transferProgress.total > 0
                    ? (transferProgress.current / transferProgress.total) * 100
                    : 0
                }
                className="h-1.5"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-[var(--destructive)] px-4 py-3 text-sm text-[var(--destructive)]">
          错误: {error}
        </div>
      )}

      {/* Remote Selector & Breadcrumb */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 min-w-[200px]">
              <HardDrive className="h-4 w-4 text-[var(--muted-foreground)]" />
              <Select
                value={currentRemote ?? ""}
                onChange={(e) => handleRemoteChange(e.target.value)}
                className="flex-1"
              >
                <option value="" disabled>
                  选择配置源
                </option>
                {remotes.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({r.type})
                  </option>
                ))}
              </Select>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm overflow-x-auto flex-1">
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--muted)] text-[var(--primary)] font-medium shrink-0"
                onClick={() => currentRemote && browse(currentRemote, "")}
              >
                {currentRemote ?? "root"}
              </button>
              {pathSegments.map((segment, index) => (
                <span key={index} className="flex items-center gap-1 shrink-0">
                  <ChevronBreadcrumb className="h-3 w-3 text-[var(--muted-foreground)]" />
                  {index === pathSegments.length - 1 ? (
                    <span className="px-1.5 py-0.5 font-medium">{segment}</span>
                  ) : (
                    <button
                      className="px-1.5 py-0.5 rounded hover:bg-[var(--muted)] text-[var(--primary)]"
                      onClick={() => navigateToPathIndex(index)}
                    >
                      {segment}
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* Go up button */}
            {currentPath && currentPath !== "" && currentPath !== "/" && (
              <Button variant="ghost" size="icon" onClick={navigateUp} title="返回上级">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {!currentRemote ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HardDrive className="mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
            <p className="text-lg font-medium">请选择配置源</p>
            <p className="text-sm text-[var(--muted-foreground)]">从上方下拉框选择一个远程存储配置</p>
          </CardContent>
        </Card>
      ) : loading && files.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-[var(--muted-foreground)]">
            加载中...
          </CardContent>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
            <p className="text-lg font-medium">空目录</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              此目录下没有文件，可点击上传按钮或拖拽文件到此处
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allCurrentPageSelected && paginatedFiles.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAll();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="w-28 text-right">大小</TableHead>
                  <TableHead className="w-44">修改时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFiles.map((file) => (
                  <TableRow
                    key={file.path}
                    className={`cursor-pointer ${
                      selectedPaths.has(file.path) ? "bg-[var(--primary)]/5" : ""
                    }`}
                    onClick={() => toggleSelection(file.path)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedPaths.has(file.path)}
                        onCheckedChange={() => toggleSelection(file.path)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(file)}
                        <span className={file.is_dir ? "font-medium" : ""}>{file.name}</span>
                        {file.is_dir && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            文件夹
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[var(--muted-foreground)]">
                      {file.is_dir ? "-" : formatBytes(file.size)}
                    </TableCell>
                    <TableCell className="text-[var(--muted-foreground)]">
                      {file.mod_time ? formatDate(file.mod_time) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {files.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <span>共 {files.length} 项</span>
            {selectedPaths.size > 0 && <span>· 已选 {selectedPaths.size} 项</span>}
            <span>· 每页</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-16"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogClose onClick={() => setShowNewFolder(false)} />
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>在当前目录下创建新文件夹</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>文件夹名称</Label>
              <Input
                placeholder="新建文件夹"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>
              取消
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
