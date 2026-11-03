import { PageHeading } from "@/components/ui";
import DashboardLiveSummary from "@/components/dashboard-live-summary";
import { requireUser } from "@/lib/auth";
import { dashboardSnapshot } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const snapshot = await dashboardSnapshot(user.id);
  return <>
    <PageHeading
      title={`Selamat datang, ${user.name.split(" ")[0]}`}
      subtitle="Satu tempat untuk menyiapkan sumber, meninjau naskah, dan memantau publikasi setiap media."
    />
    <DashboardLiveSummary initialSnapshot={snapshot} userRoles={user.roles.map((assignment) => assignment.role)}/>
  </>;
}
