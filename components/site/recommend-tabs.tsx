"use client";

import { useId, useRef, useState, type ReactNode } from "react";

export interface RecommendTab { key: string; label: string; content: ReactNode }

/** Tabs for the recommendation column (Minggu ini, Bulan ini, Semua). Panels are rendered on the server; this only switches which one shows. */
export default function RecommendTabs({ tabs }: { tabs: RecommendTab[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function move(next: number) {
    const i = (next + tabs.length) % tabs.length;
    setActive(i);
    buttons.current[i]?.focus();
  }

  return (
    <div className="site-tabs">
      <div role="tablist" aria-label="Rekomendasi menurut waktu terbit" className="site-tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => { buttons.current[i] = el; }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.key}`}
            aria-controls={`${base}-panel-${tab.key}`}
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(event) => { if (event.key === "ArrowRight") move(i + 1); if (event.key === "ArrowLeft") move(i - 1); }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.key} role="tabpanel" id={`${base}-panel-${tab.key}`} aria-labelledby={`${base}-tab-${tab.key}`} hidden={i !== active} tabIndex={0}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
