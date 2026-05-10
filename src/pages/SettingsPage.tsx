import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, Moon, Sun } from "lucide-react";

export function SettingsPage() {
  const { settings, fetchSettings, setSetting } = useSettingsStore();
  const [logLevel, setLogLevel] = useState("info");
  const [transfers, setTransfers] = useState("4");
  const [timeout, setTimeout_] = useState("300");
  const [proxy, setProxy] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [rclonePath, setRclonePath] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setLogLevel(settings.log_level ?? "info");
    setTransfers(settings.transfers ?? "4");
    setTimeout_(settings.timeout ?? "300");
    setProxy(settings.proxy ?? "");
    setDarkMode(settings.theme === "dark");
    setRclonePath(settings.rclone_path ?? "");
  }, [settings]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSetting("log_level", logLevel);
      await setSetting("transfers", transfers);
      await setSetting("timeout", timeout);
      await setSetting("proxy", proxy);
      await setSetting("theme", darkMode ? "dark" : "light");
      await setSetting("rclone_path", rclonePath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">全局设置</h1>
          <p className="text-sm text-[var(--muted-foreground)]">配置应用偏好与同步参数</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">外观</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <Label>深色模式</Label>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">同步参数</CardTitle>
          <CardDescription>影响同步任务的默认行为</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>默认日志级别</Label>
            <Select value={logLevel} onChange={(e) => setLogLevel(e.target.value)}>
              <option value="debug">DEBUG</option>
              <option value="info">INFO</option>
              <option value="warn">WARN</option>
              <option value="error">ERROR</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>并发传输数</Label>
            <Input type="number" min="1" max="20" value={transfers} onChange={(e) => setTransfers(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>网络超时 (秒)</Label>
            <Input type="number" min="30" value={timeout} onChange={(e) => setTimeout_(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">网络</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>代理地址</Label>
            <Input
              placeholder="http://127.0.0.1:7890"
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">rclone</CardTitle>
          <CardDescription>rclone 二进制文件路径配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>rclone 路径 (留空使用内嵌版本)</Label>
            <Input
              placeholder="/usr/bin/rclone"
              value={rclonePath}
              onChange={(e) => setRclonePath(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
