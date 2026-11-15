"use client";

import "@/app/css/ai-key.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Eye, EyeOff, KeyRound } from "lucide-react";
import type { AiKeyStatus } from "@/lib/ai-status";

interface CheckResult { label: string; limit: number | null; remaining: number | null }
type Busy = "save" | "check" | "clear" | null;
type Notice = { tone: "success" | "error"; text: string } | null;

const MODELS = ["qwen/qwen3-235b-a22b-2507", "qwen/qwen3-32b"];
const when = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function creditText(check: CheckResult) {
  if (check.remaining !== null) return `Sisa kredit pada kunci ini: $${check.remaining.toFixed(2)}.`;
  if (check.limit === null) return "Kunci ini tidak punya batas kredit yang tercatat.";
  return `Batas kredit kunci ini: $${check.limit.toFixed(2)}.`;
}

/** Turns an API failure into one plain sentence (zod details first, then the route's own message). */
async function failureText(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; details?: { message?: string }[] };
  return body.details?.[0]?.message || body.error || "Permintaan gagal. Coba lagi sebentar lagi.";
}

export default function AiKeyForm({ initial }: { initial: AiKeyStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function call(method: "PUT" | "POST" | "DELETE", body: unknown, kind: Exclude<Busy, null>) {
    setBusy(kind);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/ai", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setNotice({ tone: "error", text: await failureText(response) }); return null; }
      const data = await response.json() as { status: AiKeyStatus; check?: CheckResult };
      setStatus(data.status);
      router.refresh();
      return data;
    } catch {
      setNotice({ tone: "error", text: "Tidak bisa terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!apiKey.trim() && !model.trim()) { setNotice({ tone: "error", text: "Tempel kunci API baru, atau isi nama model yang ingin diganti." }); return; }
    const data = await call("PUT", { ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...(model.trim() ? { model: model.trim() } : {}) }, "save");
    if (!data) return;
    setApiKey("");
    setModel("");
    setNotice({ tone: "success", text: `Berhasil. Kunci sudah diuji ke OpenRouter dan mulai dipakai sekarang untuk semua berita baru. ${data.check ? creditText(data.check) : ""}` });
  }

  async function check() {
    const data = await call("POST", { action: "check" }, "check");
    if (data?.check) setNotice({ tone: "success", text: `Tersambung. Kunci yang dipakai sekarang berfungsi. ${creditText(data.check)}` });
  }

  async function clear() {
    setConfirmClear(false);
    const data = await call("DELETE", {}, "clear");
    if (data) setNotice({ tone: "success", text: data.status.source === "env" ? "Kunci dashboard dihapus. Aplikasi kembali memakai kunci dari server." : "Kunci dashboard dihapus. Belum ada kunci lain, jadi penulisan AI belum bisa dipakai sampai Anda memasang kunci baru." });
  }

  const sourceText = status.testMode ? "Mode uji (bukan AI sungguhan)"
    : status.source === "dashboard" ? `Kunci dari dashboard, berakhir …${status.hint}`
    : status.source === "env" ? "Kunci dari server (diatur teknisi)"
    : "Belum ada kunci";

  return (
    <section className="card stack ai-key" aria-labelledby="ai-key-title">
      <div className="stack-sm">
        <h2 id="ai-key-title"><KeyRound size={22} aria-hidden="true" /> Kunci AI (OpenRouter)</h2>
        <p className="muted">Kalau kredit habis atau kena batas, tempel kunci baru di sini. Anda tidak perlu menyentuh pengaturan server. Kunci diuji dulu, dan baru disimpan kalau berfungsi.</p>
      </div>

      <dl className="ai-key-status">
        <div><dt>Yang dipakai sekarang</dt><dd>{sourceText}</dd></div>
        <div><dt>Model</dt><dd>{status.model || "belum dipilih"}</dd></div>
        {status.updatedAt && <div><dt>Terakhir diganti</dt><dd>{when.format(new Date(status.updatedAt))}{status.updatedByName ? ` oleh ${status.updatedByName}` : ""}</dd></div>}
      </dl>

      {status.unreadable && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Kunci yang tersimpan tidak bisa dibaca lagi (kunci rahasia server berubah). Tempel kunci OpenRouter sekali lagi.</span></div>}

      <div className="field">
        <label htmlFor="ai-key-input">Kunci API baru</label>
        <div className="password-wrap">
          <input id="ai-key-input" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-…" />
          <button type="button" className="password-toggle" aria-label={show ? "Sembunyikan kunci" : "Tampilkan kunci"} aria-pressed={show} onClick={() => setShow((value) => !value)}>
            {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
        <span className="field-help">Salin dari openrouter.ai/settings/keys. Kunci lama diganti begitu yang baru lolos uji.</span>
      </div>

      <details className="advanced">
        <summary>Ganti model (opsional)</summary>
        <div className="field">
          <label htmlFor="ai-model-input">Nama model</label>
          <input id="ai-model-input" type="text" autoComplete="off" spellCheck={false} value={model} onChange={(event) => setModel(event.target.value)} placeholder={status.model || "qwen/qwen3-235b-a22b-2507"} />
          <div className="actions">{MODELS.map((name) => <button key={name} type="button" className="btn btn-sm" onClick={() => setModel(name)}>{name}</button>)}</div>
          <span className="field-help">Model 32b lebih murah dan sedikit lebih sederhana. Kosongkan untuk tetap memakai model sekarang.</span>
        </div>
      </details>

      {notice && (
        <div className={notice.tone === "success" ? "notice notice-success" : "notice notice-error"} role={notice.tone === "success" ? "status" : "alert"}>
          {notice.tone === "success" ? <CircleCheck size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={save}>{busy === "save" ? "Menguji ke OpenRouter…" : "Simpan dan uji kunci"}</button>
        <button type="button" className="btn" disabled={busy !== null || (!status.configured && !status.testMode)} onClick={check}>{busy === "check" ? "Memeriksa…" : "Cek koneksi sekarang"}</button>
        {status.source === "dashboard" && !confirmClear && <button type="button" className="btn btn-quiet" disabled={busy !== null} onClick={() => setConfirmClear(true)}>Pakai kunci server lagi</button>}
      </div>

      {confirmClear && (
        <div className="notice notice-warn" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <div className="stack-sm">
            <span>Kunci dari dashboard akan dihapus dan aplikasi kembali memakai kunci dari server{status.source === "dashboard" ? ", kalau ada" : ""}. Lanjutkan?</span>
            <div className="actions">
              <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={clear}>Ya, hapus kunci dashboard</button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmClear(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
