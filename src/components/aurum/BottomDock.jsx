import React from "react";
import { LayoutDashboard, Database, BarChart3, Dice5, Crosshair } from "lucide-react";

// Mobile bottom dock — quick-access tab bar.
export default function BottomDock({ active, onChange }) {
  const tabs = [
    { id: "live", label: "Live", icon: LayoutDashboard },
    { id: "sniper", label: "Sniper", icon: Crosshair },
    { id: "data", label: "Data", icon: Database },
    { id: "backtest", label: "Backtest", icon: BarChart3 },
    { id: "montecarlo", label: "MC Risk", icon: Dice5 }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0B0D11] border-t hairline">
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex flex-col items-center justify-center py-2.5 gap-0.5 ${isActive ? "text-gold" : "text-aurum-text-secondary"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[0.625rem] font-data uppercase tracking-[0.05em]">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}