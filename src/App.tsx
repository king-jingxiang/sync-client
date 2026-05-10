import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { ConfigPage } from "@/pages/ConfigPage";
import { FileBrowserPage } from "@/pages/FileBrowserPage";
import { TasksPage } from "@/pages/TasksPage";
import { DiffPage } from "@/pages/DiffPage";
import { LogsPage } from "@/pages/LogsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useEffect } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useTaskStore } from "@/stores/taskStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { onTaskProgress, onTaskStatusChange } from "@/lib/api";

function AppInitializer({ children }: { children: React.ReactNode }) {
  const fetchRemotes = useConfigStore((s) => s.fetchRemotes);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const updateRuntimeState = useTaskStore((s) => s.updateRuntimeState);

  useEffect(() => {
    fetchRemotes();
    fetchTasks();
    fetchSettings();

    const unlistenProgress = onTaskProgress((state) => {
      updateRuntimeState(state);
    });
    const unlistenStatus = onTaskStatusChange((state) => {
      updateRuntimeState(state);
      if (state.status === "completed" || state.status === "failed") {
        fetchTasks();
      }
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, []);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/files" element={<FileBrowserPage />} />
            <Route path="/diff" element={<DiffPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Route>
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
