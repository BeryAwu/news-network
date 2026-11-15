"use client";

import "@/app/css/media.css";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { asFailure, failure, readBody } from "@/components/plain-errors";

type Site = { id: string; displayName: string; domains: { id: string; hostname: string; isCanonical: boolean; isActive: boolean; verificationStatus: string }[] };

const apiFields = { hostname: "Alamat situs belum benar. Tulis alamatnya saja, misalnya berita.example.id." };

/** Accepts what people paste ("https://Berita.example.id/") and returns the bare host, or null when it cannot be an address. */
function cleanHostname(raw: string) {
  const host = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host) && host.length >= 3 && host.length <= 253 ? host : null;
}

export default function DomainForm({ site }: { site: Site }) {
  const router = useRouter();
  const uid = useId();
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState<{ text: string; next?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const firstPending = site.domains.find((domain) => domain.verificationStatus !== "VERIFIED")?.id;

  async function send(body: Record<string, unknown>, fallback: string) {
    const response = await fetch("/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaSiteId: site.id, ...body }) });
    const result = await readBody(response);
    if (!response.ok) throw failure(response.status, result, apiFields, fallback);
    return result;
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setFieldError("");
    setMessage(null);
    const hostname = cleanHostname(String(data.get("hostname") || ""));
    if (!hostname) {
      setFieldError("Tulis alamat situsnya saja, tanpa garis miring atau spasi, dan pakai titik. Contoh: berita.example.id.");
      document.getElementById(`${uid}-hostname`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await send({ hostname, isCanonical: data.get("isCanonical") === "on", action: "add" }, "Alamat situs belum tersimpan. Coba lagi sebentar lagi.");
      setMessage({ text: `${hostname} sudah ditambahkan. Arahkan DNS-nya ke server aplikasi, lalu tekan Konfirmasi alamat ini di kartu alamat tersebut.` });
      form.reset();
      router.refresh();
    } catch (e) {
      const problem = asFailure(e, "Alamat situs belum tersimpan. Coba lagi sebentar lagi.");
      if (problem.field === "hostname") setFieldError(problem.message);
      else setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  async function dnsHint(hostname: string) {
    try {
      const response = await fetch(`/api/domains/dns?hostname=${encodeURIComponent(hostname)}`, { cache: "no-store" });
      if (!response.ok) return "Pengecekan DNS tidak bisa dilakukan sekarang.";
      const result = await response.json() as { addresses: string[]; expected: string | null; pointsHere: boolean | null };
      if (result.pointsHere === true) return "Pengecekan DNS: alamat ini sudah mengarah ke server kami.";
      if (result.pointsHere === false) return result.addresses.length ? `Peringatan: alamat ini masih mengarah ke ${result.addresses.join(", ")}, bukan ke ${result.expected}. Situs belum bisa dibuka sebelum DNS diperbaiki.` : "Peringatan: alamat ini belum punya data DNS sama sekali. Situs belum bisa dibuka sebelum DNS dibuat.";
      return "";
    } catch { return ""; }
  }

  async function change(hostname: string, action: "verify" | "disable", isCanonical: boolean) {
    const hint = action === "verify" ? await dnsHint(hostname) : "";
    const question = action === "verify"
      ? `${hint ? hint + "\n\n" : ""}Konfirmasi ${hostname}? Menekan OK berarti Anda menyatakan alamat ini milik media Anda.`
      : `Nonaktifkan ${hostname}? Naskah baru tidak bisa terbit ke alamat ini. Naskah yang sudah terbit tetap ada, dan Anda bisa mengonfirmasi alamat ini lagi nanti.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      await send({ hostname, action, isCanonical }, "Status alamat belum berubah. Coba lagi sebentar lagi.");
      if (action === "verify") setMessage({ text: `${hostname} sudah dikonfirmasi dan aktif. Media ${site.displayName} sekarang bisa menerbitkan naskah ke alamat ini.`, next: true });
      else setMessage({ text: `${hostname} dinonaktifkan. Konfirmasi lagi kalau alamat ini mau dipakai.` });
      router.refresh();
    } catch (e) {
      setError(asFailure(e, "Status alamat belum berubah. Coba lagi sebentar lagi.").message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack">
    <div className="form-intro">
      <h3>Alamat situs (domain)</h3>
      <p>Ini alamat yang diketik pembaca, misalnya beritakota.id. Sebelum menekan Konfirmasi, alamat itu harus diarahkan ke server kami lewat pengaturan DNS. <Link href="/guide#alamat-situs">Lihat panduan langkah demi langkah</Link>.</p>
    </div>

    {site.domains.length === 0
      ? <EmptyState title="Belum ada alamat situs" detail="Tambahkan alamat yang akan dibuka pembaca. Naskah baru bisa terbit setelah satu alamat dikonfirmasi." />
      : <ul className="domain-list">
        {site.domains.map((domain) => {
          const confirmed = domain.verificationStatus === "VERIFIED";
          return <li className="domain-item" key={domain.id}>
            <div className="domain-item-head">
              <strong className="domain-name">{domain.hostname}</strong>
              <div className="actions">
                <span className={confirmed ? "badge badge-green" : "badge badge-yellow"}>{confirmed ? "Terkonfirmasi" : "Belum dikonfirmasi"}</span>
                <span className={domain.isActive ? "badge badge-green" : "badge"}>{domain.isActive ? "Aktif" : "Nonaktif"}</span>
                {domain.isCanonical && <span className="badge badge-blue">Alamat utama</span>}
              </div>
            </div>
            {confirmed
              ? <div className="row-between">
                <p className="muted">Alamat ini aktif dan menerima naskah yang diterbitkan.</p>
                {domain.isActive && <button type="button" className="btn btn-danger" disabled={busy} onClick={() => change(domain.hostname, "disable", false)}>Nonaktifkan</button>}
              </div>
              : <div className="row-between">
                <p className="muted">Arahkan DNS {domain.hostname} ke server aplikasi dulu. Aplikasi tidak memeriksanya sendiri.</p>
                <button type="button" className={domain.id === firstPending ? "btn btn-primary" : "btn"} disabled={busy} onClick={() => change(domain.hostname, "verify", domain.isCanonical)}>Konfirmasi alamat ini</button>
              </div>}
          </li>;
        })}
      </ul>}

    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice notice-success"><div className="stack-sm"><span>{message.text}</span>{message.next && <Link className="btn btn-primary" href={`/media?site=${site.id}&tab=kategori`}>Buat kategori</Link>}</div></div>}

    <hr className="divider"/>

    <form onSubmit={add} noValidate className="stack domain-add" aria-labelledby={`${uid}-add`}>
      <h3 id={`${uid}-add`}>Tambah alamat situs</h3>
      <div className="field">
        <label htmlFor={`${uid}-hostname`}>Alamat situs</label>
        <input id={`${uid}-hostname`} name="hostname" placeholder="berita.example.id" maxLength={253} inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} aria-required="true" aria-invalid={Boolean(fieldError)} aria-describedby={`${uid}-hostname-note`}/>
        <p id={`${uid}-hostname-note`} className={fieldError ? "field-error" : "field-help"}>{fieldError || "Tulis alamatnya saja, tanpa https://. Alamat baru belum aktif sampai Anda mengonfirmasinya."}</p>
      </div>
      <label className="checkline"><input type="checkbox" name="isCanonical"/><span className="choice-copy"><strong>Jadikan alamat utama</strong><small className="muted">Alamat utama dipakai sebagai alamat resmi situs. Alamat pertama otomatis jadi utama setelah dikonfirmasi.</small></span></label>
      <div className="actions"><button type="submit" className={site.domains.length === 0 ? "btn btn-primary" : "btn"} disabled={busy}>{busy ? "Menyimpan…" : "Tambah alamat situs"}</button></div>
    </form>
  </div>;
}
