import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Settings,
  FolderSync,
  HardDrive,
  FileText,
  GitCompareArrows,
  FolderSearch,
} from "lucide-react";

const navItems = [
  { to: "/tasks", label: "同步任务", icon: FolderSync },
  { to: "/config", label: "配置管理", icon: HardDrive },
  { to: "/files", label: "文件浏览", icon: FolderSearch },
  { to: "/diff", label: "差异对比", icon: GitCompareArrows },
  { to: "/logs", label: "同步日志", icon: FileText },
  { to: "/settings", label: "全局设置", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-4">
        <FolderSync className="h-5 w-5 text-[var(--primary)]" />
        <span className="font-semibold text-sm">SyncClient</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <RcloneStatusBadge />
      </div>
    </aside>
  );
}

function RcloneStatusBadge() {
  const location = useLocation();
  // This is a simple display - real status will come from the store
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
      <div className="h-2 w-2 rounded-full bg-[var(--success)]" />
      <span>rclone 就绪</span>
    </div>
  );
}
