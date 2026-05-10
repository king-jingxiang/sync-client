import { useEffect, useState } from "react";
import { useConfigStore } from "@/stores/configStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, Trash2, Plug, HardDrive, FolderOpen } from "lucide-react";
import * as api from "@/lib/api";

const STORAGE_TYPES = [
  { value: "s3", label: "Amazon S3" },
  { value: "onedrive", label: "Microsoft OneDrive" },
  { value: "drive", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
  { value: "sftp", label: "SFTP" },
  { value: "webdav", label: "WebDAV" },
  { value: "local", label: "本地存储" },
  { value: "azureblob", label: "Azure Blob" },
  { value: "b2", label: "Backblaze B2" },
];

const TYPE_PARAMS: Record<string, { key: string; label: string; password?: boolean }[]> = {
  s3: [
    { key: "provider", label: "Provider" },
    { key: "env_auth", label: "Env Auth (true/false)" },
    { key: "access_key_id", label: "Access Key ID" },
    { key: "secret_access_key", label: "Secret Access Key", password: true },
    { key: "region", label: "Region" },
    { key: "endpoint", label: "Endpoint" },
  ],
  onedrive: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret", password: true },
    { key: "token", label: "Token", password: true },
  ],
  drive: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret", password: true },
    { key: "token", label: "Token", password: true },
  ],
  dropbox: [
    { key: "token", label: "Token", password: true },
  ],
  sftp: [
    { key: "host", label: "Host" },
    { key: "user", label: "User" },
    { key: "pass", label: "Password", password: true },
    { key: "port", label: "Port" },
    { key: "key_file", label: "SSH Key File" },
  ],
  webdav: [
    { key: "url", label: "URL" },
    { key: "user", label: "User" },
    { key: "pass", label: "Password", password: true },
    { key: "vendor", label: "Vendor (other/owncloud/nextcloud/sharepoint)" },
  ],
  local: [],
  azureblob: [
    { key: "account", label: "Account" },
    { key: "key", label: "Key", password: true },
  ],
  b2: [
    { key: "account", label: "Account ID" },
    { key: "key", label: "Application Key", password: true },
  ],
};

export function ConfigPage() {
  const { remotes, loading, error, fetchRemotes, createRemote, deleteRemote, testConnection } = useConfigStore();
  const [showCreate, setShowCreate] = useState(false);
  const [testingName, setTestingName] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ name: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchRemotes();
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-[var(--destructive)] px-4 py-3 text-sm text-[var(--destructive)]">
          错误: {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">配置管理</h1>
          <p className="text-sm text-[var(--muted-foreground)]">管理 rclone 远程存储配置</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {/* TODO: import */}}>
            导入配置
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            新建 Remote
          </Button>
        </div>
      </div>

      {loading && remotes.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
          加载中...
        </div>
      ) : remotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HardDrive className="mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
            <p className="text-lg font-medium">暂无配置</p>
            <p className="text-sm text-[var(--muted-foreground)]">点击「新建 Remote」添加云存储配置</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {remotes.map((remote) => (
            <Card key={remote.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{remote.name}</CardTitle>
                  <Badge variant="secondary">{remote.type}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={testingName === remote.name}
                    onClick={async () => {
                      setTestingName(remote.name);
                      try {
                        const result = await testConnection(remote.name);
                        setTestResult({ name: remote.name, ...result });
                      } catch (e: any) {
                        setTestResult({ name: remote.name, success: false, message: String(e) });
                      } finally {
                        setTestingName(null);
                      }
                    }}
                  >
                    <Plug className="h-4 w-4" />
                    {testingName === remote.name ? "测试中..." : "测试连接"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (confirm(`确定删除配置 "${remote.name}" 吗？`)) {
                        await deleteRemote(remote.name);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {testResult && testResult.name === remote.name && (
                  <div
                    className={`text-sm ${
                      testResult.success ? "text-[var(--success)]" : "text-[var(--destructive)]"
                    }`}
                  >
                    {testResult.success ? "连接成功" : `连接失败: ${testResult.message}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateRemoteDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

function CreateRemoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createRemote } = useConfigStore();
  const [name, setName] = useState("");
  const [type, setType] = useState("s3");
  const [params, setParams] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const currentParams = TYPE_PARAMS[type] ?? [];

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createRemote({ name: name.trim(), type, parameters: params });
      setName("");
      setType("s3");
      setParams({});
      onOpenChange(false);
    } catch (e: any) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>新建 Remote</DialogTitle>
          <DialogDescription>配置云存储连接信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>名称</Label>
            <Input
              placeholder="my-s3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>存储类型</Label>
            <Select value={type} onChange={(e) => { setType(e.target.value); setParams({}); }}>
              {STORAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          {currentParams.map((p) => (
            <div key={p.key} className="space-y-2">
              <Label>{p.label}</Label>
              <Input
                type={p.password ? "password" : "text"}
                value={params[p.key] ?? ""}
                onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                placeholder={p.label}
              />
            </div>
          ))}
        </div>
        {createError && (
          <div className="text-sm text-[var(--destructive)] py-2">
            创建失败: {createError}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={creating || !name.trim()}>
            {creating ? "创建中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
