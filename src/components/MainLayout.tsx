import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";

export function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
