import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { ParticleBackground } from "./ParticleBackground";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-[#020617] text-gray-100 overflow-hidden relative">
      <ParticleBackground />
      <div className="absolute top-2 right-2 z-50 rounded bg-blue-500/20 px-2 py-1 text-[10px] text-blue-400 border border-blue-500/30 backdrop-blur-sm">v3.0.0</div>
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden bg-transparent backdrop-blur-[2px]">{children}</main>
    </div>
  );
}
