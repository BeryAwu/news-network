"use client";

import "@/app/css/ai-key.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CircleAlert, CircleCheck, Eye, EyeOff, KeyRound, RotateCcw, Trash2 } from "lucide-react";
import type { AiKeyStatus, AiKeyView } from "@/lib/ai-status";

interface CheckResult { label: string; limit: number | null; remaining: number | null }
type Notice = { tone: "success" | "error"; text: string } | null;

const MODELS = ["qwen/qwen3-235b-a22b-2507", "qwen/qwen3-32b"];
const when = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

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

function keyState(key: AiKeyView, isFirst: boolean) {
  if (key.unreadable) return { tone: "bad", text: "Tidak bisa dibaca. Hapus lalu tempel lagi." };
  if (key.status === "rejected") return { tone: "bad", text: "Ditolak OpenRouter. Ganti kunci ini." };
  if (key.status === "cooldown" && key.cooldownUntil && new Date(key.cooldownUntil) > new Date()) return { tone: "warn", text: `${key.lastError || "Istirahat"}. Dicoba lagi ${when.format(new Date(key.cooldownUntil))}.` };
  return { tone: "ok", text: isFirst ? "Dipakai pertama" : "Siaga, dipakai kalau kunci di atasnya gagal" };
}

export default function AiKeyForm({ initial }: { initial: AiKeyStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function call(method: "POST" | "DELETE", body: unknown, kind: string) {
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

  async function add() {
    if (!apiKey.trim()) { setNotice({ tone: "error", text: "Tempel kunci API dulu." }); return; }
    const data = await call("POST", { action: "add", apiKey: apiKey.trim(), label: label.trim() }, "add");
    if (!data) return;
    setApiKey("");
    setLabel("");
    setNotice({ tone: "success", text: `Kunci ditambahkan setelah lolos uji. ${data.check ? creditText(data.check) : ""}` });
  }

  async function saveModel() {
    if (!model.trim()) { setNotice({ tone: "error", text: "Isi nama model dulu." }); return; }
    const data = await call("POST", { action: "model", model: model.trim() }, "model");
    if (data) { setModel(""); setNotice({ tone: "success", text: "Model diganti dan sudah diuji." }); }
  }

  async function check() {
    const data = await call("POST", { action: "check" }, "check");
    if (data?.check) setNotice({ tone: "success", text: `Tersambung. Kunci yang dipakai sekarang berfungsi. ${creditText(data.check)}` });
  }

  async function act(action: "remove" | "primary" | "reset", key: AiKeyView) {
    setConfirm(null);
    const data = await call("POST", { action, id: key.id }, `${action}:${key.id}`);
    if (!data) return;
    const text = action === "remove" ? "Kunci dihapus." : action === "primary" ? "Kunci ini sekarang dicoba pertama." : "Kunci dimasukkan lagi ke giliran.";
    setNotice({ tone: "success", text });
  }

  async function clearAll() {
    setConfirm(null);
    const data = await call("DELETE", {}, "clear");
    if (data) setNotice({ tone: "success", text: data.status.source === "env" ? "Semua kunci dashboard dihapus. Aplikasi kembali memakai kunci dari server." : "Semua kunci dashboard dihapus. Pasang kunci baru agar penulisan AI bisa dipakai." });
  }

  const hasReady = status.keys.some((key) => !key.unreadable && key.status !== "rejected");
  const unreadable = status.keys.some((key) => key.unreadable);

  return (
    <section className="card stack ai-key" aria-labelledby="ai-key-title">
      <div className="stack-sm">
        <h2 id="ai-key-title"><KeyRound size={22} aria-hidden="true" /> Kunci AI (OpenRouter)</h2>
        <p className="muted">Tambahkan beberapa kunci. Kalau kredit satu kunci habis atau kena batas, aplikasi otomatis pindah ke kunci berikutnya dan berita tetap jadi. Anda tidak perlu menyentuh pengaturan server.</p>
      </div>

      <dl className="ai-key-status">
        <div><dt>Model</dt><dd>{status.model || "belum dipilih"}</dd></div>
        <div><dt>Kunci cadangan dari server</dt><dd>{status.envKey ? "Ada, dipakai paling akhir" : "Tidak ada"}</dd></div>
        {status.testMode && <div><dt>Mode</dt><dd>Mode uji (bukan AI sungguhan)</dd></div>}
      </dl>

      {unreadable && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Ada kunci yang tidak bisa dibaca lagi (kunci rahasia server berubah). Hapus kunci itu lalu tempel lagi.</span></div>}
      {!hasReady && !status.envKey && !status.testMode && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Belum ada kunci yang bisa dipakai. Penulisan AI belum berjalan sampai Anda menambah kunci.</span></div>}

      {status.keys.length > 0 && (
        <ol className="ai-key-list" aria-label="Daftar kunci, dicoba dari atas ke bawah">
          {status.keys.map((key, index) => {
            const state = keyState(key, index === 0);
            const first = index === 0;
            return (
              <li key={key.id} className="ai-key-item">
                <div className="ai-key-main">
                  <strong>{key.label || `Kunci ${index + 1}`}</strong>
                  <span className="muted">berakhir …{key.hint}{key.addedByName ? `, ditambah ${key.addedByName}` : ""}</span>
                  <span className={`ai-key-state ai-key-${state.tone}`}>{state.text}</span>
                </div>
                <div className="actions">
                  {!first && <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => act("primary", key)}><ArrowUp size={16} aria-hidden="true" />Jadikan pertama</button>}
                  {key.status !== "ok" && !key.unreadable && <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => act("reset", key)}><RotateCcw size={16} aria-hidden="true" />Coba lagi</button>}
                  {confirm === key.id
                    ? <><button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => act("remove", key)}>Ya, hapus</button><button type="button" className="btn btn-sm" onClick={() => setConfirm(null)}>Batal</button></>
                    : <button type="button" className="btn btn-quiet btn-sm" disabled={busy !== null} onClick={() => setConfirm(key.id)}><Trash2 size={16} aria-hidden="true" />Hapus</button>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="field">
        <label htmlFor="ai-key-input">Tambah kunci API</label>
        <div className="password-wrap">
          <input id="ai-key-input" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-…" />
          <button type="button" className="password-toggle" aria-label={show ? "Sembunyikan kunci" : "Tampilkan kunci"} aria-pressed={show} onClick={() => setShow((value) => !value)}>
            {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
        <span className="field-help">Salin dari openrouter.ai/settings/keys. Kunci baru masuk daftar paling bawah setelah lolos uji.</span>
      </div>
      <div className="field">
        <label htmlFor="ai-key-label">Nama kunci (opsional)</label>
        <input id="ai-key-label" type="text" autoComplete="off" maxLength={40} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Contoh: Akun cadangan" />
      </div>

      <details className="advanced">
        <summary>Ganti model (opsional)</summary>
        <div className="field">
          <label htmlFor="ai-model-input">Nama model</label>
          <input id="ai-model-input" type="text" autoComplete="off" spellCheck={false} value={model} onChange={(event) => setModel(event.target.value)} placeholder={status.model || "qwen/qwen3-235b-a22b-2507"} />
          <div className="actions">{MODELS.map((name) => <button key={name} type="button" className="btn btn-sm" onClick={() => setModel(name)}>{name}</button>)}</div>
          <div className="actions"><button type="button" className="btn" disabled={busy !== null} onClick={saveModel}>{busy === "model" ? "Menguji…" : "Simpan model"}</button></div>
          <span className="field-help">Model 32b lebih murah dan sedikit lebih sederhana.</span>
        </div>
      </details>

      {notice && (
        <div className={notice.tone === "success" ? "notice notice-success" : "notice notice-error"} role={notice.tone === "success" ? "status" : "alert"}>
          {notice.tone === "success" ? <CircleCheck size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={add}>{busy === "add" ? "Menguji ke OpenRouter…" : "Tambah dan uji kunci"}</button>
        <button type="button" className="btn" disabled={busy !== null || (!status.configured && !status.testMode)} onClick={check}>{busy === "check" ? "Memeriksa…" : "Cek koneksi sekarang"}</button>
        {status.keys.length > 0 && confirm !== "all" && <button type="button" className="btn btn-quiet" disabled={busy !== null} onClick={() => setConfirm("all")}>Hapus semua kunci dashboard</button>}
      </div>

      {confirm === "all" && (
        <div className="notice notice-warn" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <div className="stack-sm">
            <span>Semua kunci dari dashboard dihapus dan aplikasi kembali memakai kunci dari server, kalau ada. Lanjutkan?</span>
            <div className="actions">
              <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={clearAll}>Ya, hapus semua</button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirm(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
