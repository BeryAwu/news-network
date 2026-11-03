import { redirect } from "next/navigation";
import { currentUser, clearSession } from "@/lib/auth";
import { DashboardNavigation, DashboardPageLabel } from "@/components/dashboard-navigation";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const roleNames: Record<string, string> = { OWNER: "Pemilik", ADMIN: "Admin", EDITOR: "Editor", REVIEWER: "Peninjau", PUBLISHER: "Penerbit" };
  const roleLabel = user.roles.map((assignment) => roleNames[assignment.role] || assignment.role).join(" · ");

  return <div className="layout">
    <aside className="sidebar">
      <DashboardNavigation />
      <div className="user-panel">
        <div className="user-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</div>
        <div className="user-details"><strong>{user.name}</strong><span>{roleLabel || "Anggota ruang redaksi"}</span></div>
        <form action={async () => { "use server"; await clearSession(); redirect("/login"); }}>
          <button className="logout-button" type="submit">Keluar</button>
        </form>
      </div>
    </aside>
    <div className="main">
      <header className="topbar">
        <DashboardPageLabel />
        <span className="topbar-note">Konten & publikasi</span>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}
