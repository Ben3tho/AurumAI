import React from "react";
import { Upload, Activity, User, FileBarChart } from "lucide-react";

// Fixed 64px left utility rail (desktop). File import, engine status, profile.
export default function LeftRail({ hasData, onFileSelect, engineRunning, fileName }) {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 flex-col items-center justify-between py-4 border-r hairline bg-[#0B0D11] z-30">
      <div className="flex flex-col items-center gap-4">
        <div className="w-9 h-9 rounded-md bg-gold flex items-center justify-center font-display font-bold text-[#0B0D11] text-lg">A</div>
        <button
          onClick={onFileSelect}
          title="Import XAUUSDm15.csv"
          className="w-10 h-10 rounded-md border hairline flex items-center justify-center hover:bg-surface-elevated transition-colors"
        >
          <Upload className="w-4 h-4 text-aurum-text-secondary" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${hasData ? "animate-ping bg-bull" : "bg-aurum-text-secondary"}`}
            />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hasData ? "bg-bull" : "bg-aurum-text-secondary"}`} />
          </span>
          <Activity className="w-4 h-4 text-aurum-text-secondary mt-1" />
        </div>
        <FileBarChart className={`w-4 h-4 ${hasData ? "text-gold" : "text-aurum-text-secondary"}`} />
        <div className="w-9 h-9 rounded-full border hairline flex items-center justify-center bg-surface-elevated">
          <User className="w-4 h-4 text-aurum-text-secondary" />
        </div>
      </div>
    </aside>
  );
}