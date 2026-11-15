import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { currentUser, clearSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-navigation";
import { reviewQueueCount } from "@/lib/dashboard";
import { appFont } from "@/lib/app-font";
import "@/app/app.css";

const roleNames: Record<string, string> = { OWNER: "Pemilik", ADMIN: "Admin", EDITOR: "Editor", REVIEWER: "Pemeriksa", PUBLISHER: "Penerbit", OPERATOR: "Operator" };

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const hasOperator = user.roles.some((assignment) => assignment.role === "OPERATOR");
  const impliedByOperator = ["EDITOR", "REVIEWER", "PUBLISHER"];
  const roleLabel = user.roles.filter((assignment) => !(hasOperator && impliedByOperator.includes(assignment.role))).map((assignment) => roleNames[assignment.role] || assignment.role).join(", ");
  const reviewCount = await reviewQueueCount(user.id);

  const footer = (
    <div className="user-panel">
      <div className="user-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</div>
      <div className="user-details"><strong>{user.name}</strong><span>{roleLabel || "Anggota redaksi"}</span></div>
      <form action={async () => { "use server"; await clearSession(); redirect("/login"); }} style={{ display: "contents" }}>
        <button className="logout-button" type="submit"><LogOut size={16} aria-hidden="true" />Keluar</button>
      </form>
    </div>
  );

  return <div className={`app ${appFont.variable}`}><DashboardShell reviewCount={reviewCount} footer={footer}>{children}</DashboardShell></div>;
}
