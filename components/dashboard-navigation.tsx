"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const sections = [
  {
    title: "Ruang redaksi",
    items: [
      ["Ringkasan", "/dashboard"],
      ["Kelola media", "/media"],
      ["Brief sumber", "/briefs"],
      ["Tinjau naskah", "/editorial"],
      ["Publikasi", "/publishing"],
      ["Pustaka gambar", "/assets"]
    ]
  },
  {
    title: "Pengelolaan",
    items: [
      ["Pemantauan", "/monitoring"],
      ["Pengguna & akses", "/users"],
      ["Integrasi", "/settings"]
    ]
  }
] as const;

const pageNames = new Map<string, string>(sections.flatMap((section) => section.items.map(([label, href]) => [href, label] as [string, string])));

export function DashboardNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) { setOpen(false); menuButton.current?.focus(); }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <div className="sidebar-header">
      <Link href="/dashboard" className="brand" aria-label="Newsroom, buka ringkasan">
        <span className="brand-mark" aria-hidden="true">N</span>
        <span>Newsroom<small>Pusat operasi media</small></span>
      </Link>
      <button ref={menuButton} className="mobile-nav-toggle" type="button" aria-expanded={open} aria-controls="dashboard-navigation" onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
        <span>{open ? "Tutup menu" : "Menu"}</span>
      </button>
    </div>
    <nav id="dashboard-navigation" className={`nav${open ? " nav-open" : ""}`} aria-label="Navigasi utama">
      {sections.map((section) => <div className="nav-section" key={section.title}>
        <div className="nav-label">{section.title}</div>
        {section.items.map(([label, href]) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined} onClick={() => setOpen(false)}>{label}</Link>;
        })}
      </div>)}
    </nav>
  </>;
}

export function DashboardPageLabel() {
  const pathname = usePathname();
  return <div className="topbar-context" aria-live="polite">
    <span className="topbar-eyebrow">Newsroom</span>
    <strong>{pageNames.get(pathname) || "Pusat operasi media"}</strong>
  </div>;
}
