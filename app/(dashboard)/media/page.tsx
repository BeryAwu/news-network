import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { visibleMedia } from "@/lib/dashboard";
import { hasNetworkWideScope, requireUser } from "@/lib/auth";
import { EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import MediaForm from "@/components/media-form";
import DomainForm from "@/components/domain-actions";
import MediaEditForm from "@/components/media-edit-form";
import CategoryManager from "@/components/category-manager";
import WritingSkillsToggle from "@/components/writing-skills-toggle";
import { db } from "@/lib/db";
import "@/app/css/media.css";

export const dynamic = "force-dynamic";

type Site = Prisma.MediaSiteGetPayload<{ include: { profile: true; domains: true; _count: { select: { articles: true; assets: true } } } }>;
type Tab = "profil" | "alamat" | "kategori" | "gaya";
interface Step { n: number; title: string; done: boolean; hint: string; tab: Tab; action: string; allowed: boolean }

const tabLabels: Record<Tab, string> = { profil: "Profil dan tampilan", alamat: "Alamat situs", kategori: "Kategori", gaya: "Gaya penulisan" };
const href = (siteId: string, tab?: Tab) => `/media?site=${siteId}${tab ? `&tab=${tab}` : ""}`;

function setupSteps(site: Site, categoryCount: number, canSetUp: boolean, canEditCategories: boolean): Step[] {
  const confirmed = site.domains.find((domain) => domain.isActive && domain.verificationStatus === "VERIFIED");
  const profileDone = Boolean(site.profile?.niche.trim() && site.profile.targetAudience.trim());
  return [
    { n: 1, title: "Profil dasar", done: profileDone, tab: "profil", action: "Lengkapi profil", allowed: canSetUp, hint: profileDone ? "Fokus liputan dan pembaca utama sudah terisi." : "Isi fokus liputan dan pembaca utama supaya AI menulis sesuai media ini." },
    { n: 2, title: "Alamat situs (domain) terkonfirmasi", done: Boolean(confirmed), tab: "alamat", allowed: canSetUp, action: site.domains.length ? "Konfirmasi alamat ini" : "Tambah alamat situs", hint: confirmed ? `${confirmed.hostname} aktif.` : site.domains.length ? "Arahkan DNS ke server, lalu konfirmasi alamatnya." : "Tambahkan alamat yang dibuka pembaca." },
    { n: 3, title: "Kategori dibuat", done: categoryCount > 0, tab: "kategori", allowed: canEditCategories, action: "Buat kategori", hint: categoryCount > 0 ? `${categoryCount} kategori sudah ada.` : "Buat satu kategori untuk menu situs." },
  ];
}

function SetupTracker({ siteId, steps }: { siteId: string; steps: Step[] }) {
  const next = steps.find((step) => !step.done);
  return <ol className="setup-steps" aria-label="Langkah menyiapkan media">
    {steps.map((step) => {
      const state = step.done ? "done" : step === next ? "next" : "later";
      return <li className="setup-step" data-state={state} key={step.n} aria-current={state === "next" ? "step" : undefined}>
        <div className="setup-step-head">
          <span className="setup-mark" aria-hidden="true">{step.done ? <Check size={16} /> : step.n}</span>
          <span>{step.title}<span className="visually-hidden">{step.done ? ", selesai" : state === "next" ? ", langkah berikutnya" : ", belum"}</span></span>
        </div>
        <p className="setup-step-hint">{step.hint}</p>
        {state === "next" && (step.allowed
          ? <Link className="btn btn-primary" href={href(siteId, step.tab)}>{step.action}</Link>
          : <p className="setup-step-hint">Langkah ini dikerjakan oleh pemilik atau admin.</p>)}
      </li>;
    })}
  </ol>;
}

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ site?: string; tab?: string; baru?: string }> }) {
  const [media, user, query] = await Promise.all([visibleMedia(), requireUser(), searchParams]);
  const elevated = await hasNetworkWideScope(user.id);
  const canEditCategories = user.roles.some((assignment) => ["OWNER", "ADMIN", "EDITOR"].includes(assignment.role));
  const categoryRows = await db.category.findMany({ where: { mediaSiteId: { in: media.map((site) => site.id) } }, include: { _count: { select: { articles: true } } }, orderBy: { sortOrder: "asc" } });
  const categoriesOf = (siteId: string) => categoryRows.filter((category) => category.mediaSiteId === siteId);

  const selected = query.site ? media.find((site) => site.id === query.site) : undefined;
  if (query.site) {
    if (!selected) {
      return <>
        <PageHeading title="Media saya" action={<Link className="btn" href="/media"><ArrowLeft size={18} aria-hidden="true" />Semua media</Link>} />
        <div className="notice notice-error" role="alert">Media ini tidak ditemukan, atau akun Anda belum diberi akses. Buka daftar media lalu pilih lagi.</div>
      </>;
    }
    const categories = categoriesOf(selected.id);
    const steps = setupSteps(selected, categories.length, elevated, canEditCategories);
    const tabs: Tab[] = elevated ? ["profil", "alamat", "kategori", "gaya"] : ["kategori"];
    const nextTab = steps.find((step) => !step.done && step.allowed)?.tab;
    const active = tabs.find((tab) => tab === query.tab) ?? (nextTab && tabs.includes(nextTab) ? nextTab : tabs[0]);
    const language = selected.profile?.language === "Indonesian" ? "Bahasa Indonesia" : selected.profile?.language === "English" ? "Bahasa Inggris" : selected.profile?.language || "Bahasa belum dipilih";
    const profile = selected.profile ? { niche: selected.profile.niche, targetAudience: selected.profile.targetAudience, editorialMission: selected.profile.editorialMission, toneGuidelines: selected.profile.toneGuidelines, styleGuidelines: selected.profile.styleGuidelines, language: selected.profile.language } : null;

    return <>
      <PageHeading title={selected.displayName} subtitle="Atur profil, alamat situs, dan kategori media ini." action={<Link className="btn" href="/media"><ArrowLeft size={18} aria-hidden="true" />Semua media</Link>} />
      <section className="card media-card" aria-label="Ringkasan dan langkah penyiapan">
        <div className="media-card-head">
          <p className="media-facts">
            <span className="num">{selected._count.articles} artikel</span>
            <span className="num">{selected._count.assets} gambar</span>
            <span>{language}</span>
          </p>
          <StatusBadge status={selected.status} />
        </div>
        <SetupTracker siteId={selected.id} steps={steps} />
        {!elevated && <dl className="media-summary">
          <div><dt>Nama redaksi</dt><dd>{selected.newsroomByline}</dd></div>
          <div><dt>Alamat situs</dt><dd>{selected.domains.map((domain) => domain.hostname).join(", ") || "Belum ada"}</dd></div>
          <div><dt>Fokus liputan</dt><dd>{selected.profile?.niche || "Belum diisi"}</dd></div>
          <div><dt>Pembaca utama</dt><dd>{selected.profile?.targetAudience || "Belum diisi"}</dd></div>
        </dl>}
      </section>

      {tabs.length > 1 && <nav className="tabs media-tabs" aria-label="Bagian pengaturan media">
        {tabs.map((tab) => <Link key={tab} className="tab" href={href(selected.id, tab)} aria-current={tab === active ? "page" : undefined}>{tabLabels[tab]}</Link>)}
      </nav>}

      <section className="card media-panel" aria-label={tabLabels[active]}>
        {active === "profil" && <MediaEditForm site={{ id: selected.id, name: selected.name, displayName: selected.displayName, slug: selected.slug, status: selected.status, publisherDisclosure: selected.publisherDisclosure, ownershipDisclosure: selected.ownershipDisclosure, newsroomByline: selected.newsroomByline, themeConfig: selected.themeConfig, profile }} />}
        {active === "alamat" && <DomainForm site={{ id: selected.id, displayName: selected.displayName, domains: selected.domains.map((domain) => ({ id: domain.id, hostname: domain.hostname, isCanonical: domain.isCanonical, isActive: domain.isActive, verificationStatus: domain.verificationStatus })) }} />}
        {active === "kategori" && <CategoryManager mediaSiteId={selected.id} categories={categories} editable={canEditCategories} />}
        {active === "gaya" && <WritingSkillsToggle mediaSiteId={selected.id} />}
      </section>
    </>;
  }

  const showForm = elevated && (query.baru === "1" || media.length === 0);
  return <>
    <PageHeading
      title="Media saya"
      subtitle="Setiap media punya langkah penyiapan sendiri. Selesaikan ketiganya supaya naskah bisa terbit."
      action={elevated && !showForm ? <Link className="btn btn-primary" href="/media?baru=1"><Plus size={18} aria-hidden="true" />Tambah media</Link> : undefined}
    />

    {showForm && <section aria-label="Tambah media baru" className="stack">
      <MediaForm />
      {media.length > 0 && <div className="actions"><Link className="btn btn-quiet" href="/media">Tutup formulir</Link></div>}
    </section>}

    {media.length === 0
      ? !elevated && <EmptyState title="Belum ada media yang bisa Anda buka" detail="Minta pemilik atau admin menambahkan media, lalu memberi akun Anda akses ke media itu." />
      : <section className="stack" aria-label="Daftar media">
        {media.map((site) => {
          const categories = categoriesOf(site.id);
          const steps = setupSteps(site, categories.length, elevated, canEditCategories);
          const complete = steps.every((step) => step.done);
          const confirmed = site.domains.find((domain) => domain.isActive && domain.verificationStatus === "VERIFIED");
          return <article key={site.id} className="card media-card" aria-labelledby={`media-${site.id}`}>
            <div className="media-card-head">
              <div className="stack-sm">
                <h2 id={`media-${site.id}`}>{site.displayName}</h2>
                <p className="muted">{confirmed?.hostname || site.domains[0]?.hostname || "Belum ada alamat situs"}</p>
              </div>
              <StatusBadge status={site.status} />
            </div>
            <SetupTracker siteId={site.id} steps={steps} />
            <div className="media-card-foot">
              <p className="media-facts">
                <span className="num">{site._count.articles} artikel</span>
                <span className="num">{site._count.assets} gambar</span>
              </p>
              <Link className={complete ? "btn" : "btn btn-quiet"} href={href(site.id)}>Kelola media</Link>
            </div>
          </article>;
        })}
      </section>}
  </>;
}
