"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import NewsroomLogo from "@/components/newsroom-logo";
import { Activity, BarChart3, BookOpen, LayoutDashboard, ListChecks, Menu, Newspaper, PenLine, Plug, Users, X, type LucideIcon } from "lucide-react";

interface NavItem { label: string; href: string; icon: LucideIcon; showsReviewCount?: boolean; /** Hidden unless the user has one of these roles. Empty means everyone. */ roles?: string[] }
const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Kerja harian",
    items: [
      { label: "Beranda", href: "/dashboard", icon: LayoutDashboard },
      { label: "Tulis berita", href: "/briefs", icon: PenLine },
      { label: "Daftar berita", href: "/blasts", icon: ListChecks, showsReviewCount: true },
      { label: "Laporan", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Pengaturan",
    items: [
      { label: "Media saya", href: "/media", icon: Newspaper, roles: ["OWNER", "ADMIN"] },
      { label: "Tim dan akses", href: "/users", icon: Users, roles: ["OWNER"] },
      { label: "Kesehatan sistem", href: "/monitoring", icon: Activity, roles: ["OWNER", "ADMIN"] },
      { label: "Koneksi layanan", href: "/settings", icon: Plug, roles: ["OWNER"] },
    ],
  },
  {
    title: "Bantuan",
    items: [{ label: "Panduan", href: "/guide", icon: BookOpen }],
  },
];

const allItems = sections.flatMap((section) => section.items);
const isActive = (pathname: string, href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

/** Sidebar, mobile drawer and topbar. `footer` is the server-rendered user panel (it holds the logout server action). */
export function DashboardShell({ reviewCount, roles, footer, children }: { reviewCount: number; roles: string[]; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const visibleSections = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.roles || item.roles.some((role) => roles.includes(role))) }))
    .filter((section) => section.items.length > 0);
  const currentLabel = allItems.find((item) => isActive(pathname, item.href))?.label ?? "Newsroom";

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) { setOpen(false); menuButton.current?.focus(); }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="layout">
      <aside className="sidebar" data-open={open}>
        <div className="sidebar-header">
          <Link href="/dashboard" className="brand" aria-label="Newsroom, buka beranda" onClick={() => setOpen(false)}>
            <span className="brand-mark" aria-hidden="true"><NewsroomLogo size={36} /></span>
            <span>Newsroom<small>Pusat kerja redaksi</small></span>
          </Link>
          <button className="mobile-nav-toggle" type="button" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
        </div>
        <nav id="dashboard-navigation" aria-label="Menu utama" className="stack-sm">
          {visibleSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <div className="nav-label">{section.title}</div>
              {section.items.map(({ label, href, icon: Icon, showsReviewCount }) => (
                <Link key={href} href={href} className="nav-link" aria-current={isActive(pathname, href) ? "page" : undefined} onClick={() => setOpen(false)}>
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                  {showsReviewCount && reviewCount > 0 && <span className="nav-badge" aria-label={`${reviewCount} berita menunggu`}>{reviewCount}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        {footer}
      </aside>
      <div className="main">
        <header className="topbar">
          <button ref={menuButton} className="mobile-nav-toggle" type="button" aria-label="Buka menu" aria-expanded={open} aria-controls="dashboard-navigation" onClick={() => setOpen(true)}><Menu size={20} aria-hidden="true" /></button>
          <div className="topbar-context" aria-live="polite">{currentLabel}</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
