import Link from "next/link";
import { UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import UserForm from "@/components/user-form";
import UserToggle from "@/components/user-toggle";
import UserMedia from "@/components/user-media";
import { roleNames } from "@/components/team-roles";
import "@/app/css/team.css";

export const dynamic = "force-dynamic";

const lastLoginFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function UsersPage() {
  const viewer = await requireRole("OWNER");
  const viewerIsOwner = viewer.roles.some((assignment) => assignment.role === "OWNER");
  const [users, mediaRows] = await Promise.all([
    db.user.findMany({ include: { roles: true, mediaScopes: { select: { mediaSiteId: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.mediaSite.findMany({ where: { deletedAt: null }, select: { id: true, displayName: true, domains: { select: { hostname: true, isCanonical: true, isActive: true }, orderBy: [{ isCanonical: "desc" }, { createdAt: "asc" }] } }, orderBy: { displayName: "asc" } }),
  ]);
  const media = mediaRows.map((item) => ({ id: item.id, displayName: item.displayName, address: (item.domains.find((domain) => domain.isActive) || item.domains[0])?.hostname || "" }));

  return <>
    <PageHeading
      title="Tim dan akses"
      subtitle="Tambahkan orang ke redaksi, tentukan peran mereka, dan pilih media yang boleh mereka buka."
      action={<Link className="btn btn-primary" href="#tambah-anggota"><UserPlus size={18} aria-hidden="true" />Tambah anggota</Link>}
    />

    <section className="stack" aria-labelledby="daftar-tim">
      <div className="section-head">
        <h2 id="daftar-tim">Anggota tim</h2>
        <span className="muted num">{users.length} orang</span>
      </div>
      {users.length === 0
        ? <EmptyState title="Belum ada anggota tim" detail="Akun yang Anda buat dengan formulir di bawah muncul di sini, lengkap dengan peran dan media yang boleh dibukanya." />
        : <div className="card flush">
          <ul className="member-list">
            {users.map((user) => {
              const isOwner = user.roles.some((assignment) => assignment.role === "OWNER");
              const networkWide = user.roles.some((assignment) => assignment.role === "OWNER" || assignment.role === "ADMIN");
              const scopeIds = user.mediaScopes.map((scope) => scope.mediaSiteId);
              return <li className="member-row" key={user.id}>
                <div className="member-id">
                  <strong>{user.name}</strong>
                  <span className="muted">{user.email}</span>
                </div>
                <div className="member-access">
                  <div className="member-badges">
                    {user.roles.length
                      ? user.roles.map((assignment) => <span className={assignment.role === "OWNER" ? "badge badge-blue" : "badge"} key={assignment.role}>{roleNames[assignment.role] || assignment.role}</span>)
                      : <span className="badge badge-yellow">Belum punya peran</span>}
                  </div>
                  <p className="muted">
                    {networkWide ? "Boleh membuka semua media." : scopeIds.length ? `Boleh memakai ${scopeIds.length} media.` : "Belum diberi akses ke media mana pun."}
                  </p>
                </div>
                <div className="member-state">
                  <StatusBadge status={user.status} />
                  <p className="muted">{user.lastLoginAt ? `Terakhir masuk ${lastLoginFormat.format(user.lastLoginAt)}` : "Belum pernah masuk"}</p>
                  {isOwner
                    ? <p className="muted">Akun pemilik tidak bisa dinonaktifkan.</p>
                    : <UserToggle userId={user.id} status={user.status} name={user.name} />}
                </div>
                <UserMedia userId={user.id} name={user.name} current={scopeIds} media={media} networkWide={networkWide} canEdit={viewerIsOwner} />
              </li>;
            })}
          </ul>
        </div>}
    </section>

    <section id="tambah-anggota" aria-label="Tambah anggota tim">
      <UserForm media={media} />
    </section>
  </>;
}
