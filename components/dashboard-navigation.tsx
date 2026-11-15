"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, BarChart3, BookOpen, Images, LayoutDashboard, ListChecks, Menu, Newspaper, PenLine, Plug, Users, X, type LucideIcon } from "lucide-react";

interface NavItem { label: string; href: string; icon: LucideIcon; showsReviewCount?: boolean }
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
      { label: "Media saya", href: "/media", icon: Newspaper },
      { label: "Pustaka gambar", href: "/assets", icon: Images },
      { label: "Tim dan akses", href: "/users", icon: Users },
      { label: "Kesehatan sistem", href: "/monitoring", icon: Activity },
      { label: "Koneksi layanan", href: "/settings", icon: Plug },
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
export function DashboardShell({ reviewCount, footer, children }: { reviewCount: number; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
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
            <span className="brand-mark" aria-hidden="true"><Newspaper size={20} /></span>
            <span>Newsroom<small>Pusat kerja redaksi</small></span>
          </Link>
          <button className="mobile-nav-toggle" type="button" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
        </div>
        <nav id="dashboard-navigation" aria-label="Menu utama" className="stack-sm">
          {sections.map((section) => (
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
