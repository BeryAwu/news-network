"use client";

import "@/app/css/ai-key.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CircleAlert, CircleCheck, Download, Eye, EyeOff, KeyRound, RotateCcw, Trash2 } from "lucide-react";
import type { AiKeyStatus, AiKeyView } from "@/lib/ai-status";
import AiPaidProviders, { type Notice } from "@/components/ai-paid-providers";

interface CheckResult { label: string; limit: number | null; remaining: number | null }

interface ModelCatalogue { models: string[]; freeIds: Set<string> }
const MODEL_BATCH = 24;
const OPENROUTER = "openrouter";

const when = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function creditText(check: CheckResult) {
  if (check.remaining !== null) return `Sisa kredit pada kunci ini: $${check.remaining.toFixed(2)}.`;
  if (check.limit === null) return "Kunci ini tidak punya batas kredit yang tercatat.";
  return `Batas kredit kunci ini: $${check.limit.toFixed(2)}.`;
}

async function failureText(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; details?: { message?: string }[] };
  return body.details?.[0]?.message || body.error || "Permintaan gagal. Coba lagi sebentar lagi.";
}

function keyState(key: AiKeyView, isFirst: boolean) {
  if (key.unreadable) return { tone: "bad", text: "Tidak bisa dibaca. Hapus lalu tempel lagi." };
  if (key.status === "rejected") return { tone: "bad", text: "Ditolak penyedia. Ganti kunci ini." };
  if (key.status === "cooldown" && key.cooldownUntil && new Date(key.cooldownUntil) > new Date()) return { tone: "warn", text: `${key.lastError || "Istirahat"}. Dicoba lagi ${when.format(new Date(key.cooldownUntil))}.` };
  return { tone: "ok", text: isFirst ? "Dipakai pertama" : "Siaga, dipakai kalau kunci di atasnya gagal" };
}

/** Where a request's message shows: next to the OpenRouter model picker, in the paid section, or at the bottom. */
const scopeOf = (kind: string): "model" | "paid" | undefined =>
  kind.startsWith("paid") ? "paid" : kind === "models" || kind === "model" ? "model" : undefined;

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
  const [catalogue, setCatalogue] = useState<ModelCatalogue | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [keyModels, setKeyModels] = useState<Record<string, string>>({});
  const [bulkKeys, setBulkKeys] = useState("");

  const query = modelQuery.trim().toLowerCase();
  const visibleModels = catalogue
    ? catalogue.models
        .filter((id) => (!freeOnly || catalogue.freeIds.has(id)) && id.toLowerCase().includes(query))
        .sort((a, b) => Number(catalogue.freeIds.has(b)) - Number(catalogue.freeIds.has(a)))
    : [];
  const candidate = model.trim();

  async function call(method: "POST" | "DELETE", body: unknown, kind: string) {
    const scope = scopeOf(kind);
    setBusy(kind);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/ai", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setNotice({ tone: "error", text: await failureText(response), scope }); return null; }
      const data = await response.json() as { status?: AiKeyStatus; check?: CheckResult; models?: string[]; freeModels?: string[]; added?: number };
      if (data.status) {
        setStatus(data.status);
        router.refresh();
      }
      return data;
    } catch {
      setNotice({ tone: "error", text: "Tidak bisa terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.", scope });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function chooseSource(source: string) {
    if (source === status.active) return;
    const data = await call("POST", { action: "active", source }, "active");
    if (data) setNotice({ tone: "success", text: source === OPENROUTER ? "OpenRouter sekarang dipakai duluan. Penyedia berbayar jadi cadangan." : "Penyedia ini sekarang dipakai duluan. Sumber lain jadi cadangan." });
  }

  async function addBulk() {
    const keys = bulkKeys.split(/[\n,]+/).map((k) => k.trim()).filter((k) => k.length >= 20);
    if (!keys.length) { setNotice({ tone: "error", text: "Tidak ada kunci yang valid. Paste satu kunci per baris." }); return; }
    const data = await call("POST", { action: "bulk", apiKeys: keys }, "bulk");
    if (data) {
      setBulkKeys("");
      const added = data.added ?? 0;
      if (data.models) {
        setCatalogue({ models: data.models, freeIds: new Set(data.freeModels ?? []) });
        setFreeOnly(true);
      }
      const freeText = data.freeModels ? ` ${data.freeModels.length} model gratis siap sebagai cadangan otomatis. Pilih model utama di bawah.` : "";
      setNotice({ tone: "success", text: `${added} kunci baru ditambahkan${added < keys.length ? `, ${keys.length - added} sudah ada sebelumnya` : ""}.${freeText}` });
    }
  }

  async function add() {
    if (!apiKey.trim()) { setNotice({ tone: "error", text: "Tempel kunci API dulu." }); return; }
    const data = await call("POST", { action: "add", apiKey: apiKey.trim(), label: label.trim(), model: model.trim() || undefined }, "add");
    if (!data) return;
    setApiKey("");
    setLabel("");
    setNotice({ tone: "success", text: `Kunci ditambahkan setelah lolos uji. ${data.check ? creditText(data.check) : ""}` });
  }

  async function loadModels() {
    const data = await call("POST", { action: "models", apiKey: apiKey.trim() || undefined }, "models");
    if (data?.models) {
      const freeList: string[] = data.freeModels ?? [];
      setCatalogue({ models: data.models, freeIds: new Set(freeList) });
      const freeCount = freeList.length;
      setNotice({ tone: "success", text: `${data.models.length} model terbaca${freeCount ? ` · ${freeCount} gratis, dipakai otomatis kalau model utama lambat atau error` : ""}.`, scope: "model" });
    }
  }

  async function saveModel() {
    if (!model.trim()) { setNotice({ tone: "error", text: "Isi nama model dulu.", scope: "model" }); return; }
    const data = await call("POST", { action: "model", model: model.trim() }, "model");
    if (data) { setModel(""); setNotice({ tone: "success", text: "Model disimpan.", scope: "model" }); }
  }

  async function saveKeyModel(key: AiKeyView) {
    const m = (keyModels[key.id] ?? "").trim();
    if (!m) return;
    const data = await call("POST", { action: "keymodel", id: key.id, model: m }, `keymodel:${key.id}`);
    if (data) setNotice({ tone: "success", text: `Model untuk kunci "${key.label || key.hint}" disimpan: ${m}` });
  }

  async function check() {
    const data = await call("POST", { action: "check" }, "check");
    if (data?.check) setNotice({ tone: "success", text: `Tersambung. Sumber yang dipakai sekarang berfungsi. ${creditText(data.check)}` });
    else if (data) setNotice({ tone: "success", text: "Tersambung. Sumber yang dipakai sekarang berfungsi." });
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
    if (data) setNotice({ tone: "success", text: data.status?.source === "env" ? "Semua kunci dan penyedia dashboard dihapus. Aplikasi kembali memakai kunci dari server." : "Semua kunci dan penyedia dashboard dihapus. Pasang kunci baru agar penulisan AI bisa dipakai." });
  }

  const readyKeys = status.keys.filter((key) => !key.unreadable && key.status !== "rejected").length;
  const readyPaid = status.paid.some((p) => !p.unreadable && p.status !== "rejected");
  const unreadable = status.keys.some((key) => key.unreadable) || status.paid.some((p) => p.unreadable);
  const hasDashboard = status.keys.length > 0 || status.paid.length > 0;

  return (
    <section className="card stack ai-key" aria-labelledby="ai-key-title">
      <div className="stack-sm">
        <h2 id="ai-key-title"><KeyRound size={22} aria-hidden="true" /> Kunci AI</h2>
        <p className="muted">Dua jenis sumber: OpenRouter (banyak kunci, bergiliran, ada model gratis) dan penyedia berbayar (satu kunci per penyedia). Pilih mana yang dipakai duluan; sumber lain otomatis jadi cadangan kalau yang aktif gagal.</p>
      </div>

      <dl className="ai-key-status">
        <div><dt>Mulai dari</dt><dd>{status.provider || "belum ada"}</dd></div>
        <div><dt>Model</dt><dd>{status.model || "belum dipilih"}</dd></div>
        <div><dt>Kunci cadangan dari server</dt><dd>{status.envKey ? "Ada, dipakai paling akhir" : "Tidak ada"}</dd></div>
        {status.testMode && <div><dt>Mode</dt><dd>Mode uji (bukan AI sungguhan)</dd></div>}
      </dl>

      {unreadable && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Ada kunci yang tidak bisa dibaca lagi (kunci rahasia server berubah). Hapus lalu tempel lagi.</span></div>}
      {!readyKeys && !readyPaid && !status.envKey && !status.testMode && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Belum ada kunci yang bisa dipakai. Penulisan AI belum berjalan sampai Anda menambah kunci OpenRouter atau penyedia berbayar.</span></div>}

      <fieldset className="ai-source-picker">
        <legend>Sumber aktif</legend>
        <label className={status.active === OPENROUTER ? "is-active" : ""}>
          <input type="radio" name="ai-source" value={OPENROUTER} checked={status.active === OPENROUTER} disabled={busy !== null} onChange={() => void chooseSource(OPENROUTER)} />
          <span><strong>OpenRouter</strong><small>{readyKeys} kunci siap · {status.openRouterModel || "model belum dipilih"}</small></span>
        </label>
        {status.paid.map((p) => (
          <label key={p.id} className={status.active === `paid:${p.id}` ? "is-active" : ""}>
            <input type="radio" name="ai-source" value={`paid:${p.id}`} checked={status.active === `paid:${p.id}`} disabled={busy !== null || p.unreadable} onChange={() => void chooseSource(`paid:${p.id}`)} />
            <span><strong>{p.name}</strong><small>Berbayar · {p.model}</small></span>
          </label>
        ))}
        {!status.paid.length && <p className="field-help">Tambah penyedia berbayar di bawah untuk memakai API di luar OpenRouter.</p>}
      </fieldset>

      <h3 className="ai-source-title">OpenRouter</h3>

      <section className="ai-setup-section ai-key-entry" aria-labelledby="ai-key-entry-title">
        <div className="ai-setup-section-heading"><div><h3 id="ai-key-entry-title"><strong>01</strong> Kunci OpenRouter</h3><p>Kunci dipakai bergantian otomatis per request (round-robin). Tambah banyak kunci sekaligus untuk menghindari limit.</p></div><span>{status.keys.length} tersimpan</span></div>
        {status.keys.length > 0 && <ol className="ai-key-list" aria-label="Daftar kunci, dicoba dari atas ke bawah">
          {status.keys.map((key, index) => {
            const state = keyState(key, index === 0);
            const first = index === 0;
            return <li key={key.id} className="ai-key-item">
              <div className="ai-key-main"><strong>{key.label || `Kunci ${index + 1}`}</strong><span className="muted">berakhir …{key.hint}{key.addedByName ? `, ditambah ${key.addedByName}` : ""}</span><span className={`ai-key-state ai-key-${state.tone}`}>{state.text}</span></div>
              <div className="ai-key-model-row">
                <input
                  type="text" className="ai-key-model-input" autoComplete="off" spellCheck={false}
                  value={keyModels[key.id] ?? key.model ?? ""}
                  onChange={(e) => setKeyModels((prev) => ({ ...prev, [key.id]: e.target.value }))}
                  placeholder={status.openRouterModel || "Model (opsional, kosong = pakai model OpenRouter)"}
                  aria-label={`Model untuk kunci ${key.label || key.hint}`}
                />
                <button type="button" className="btn btn-sm" disabled={busy !== null || !(keyModels[key.id] ?? key.model)} onClick={() => saveKeyModel(key)}>
                  {busy === `keymodel:${key.id}` ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
              <div className="actions">
                {!first && <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => act("primary", key)}><ArrowUp size={16} aria-hidden="true" />Jadikan pertama</button>}
                {key.status !== "ok" && !key.unreadable && <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => act("reset", key)}><RotateCcw size={16} aria-hidden="true" />Coba lagi</button>}
                {confirm === key.id ? <><button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => act("remove", key)}>Ya, hapus</button><button type="button" className="btn btn-sm" onClick={() => setConfirm(null)}>Batal</button></> : <button type="button" className="btn btn-quiet btn-sm" disabled={busy !== null} onClick={() => setConfirm(key.id)}><Trash2 size={16} aria-hidden="true" />Hapus</button>}
              </div>
            </li>;
          })}
        </ol>}
        <div className="field">
          <label htmlFor="ai-bulk-input">Tambah banyak kunci sekaligus</label>
          <textarea id="ai-bulk-input" className="ai-bulk-textarea" autoComplete="off" spellCheck={false} value={bulkKeys} onChange={(e) => setBulkKeys(e.target.value)} placeholder={"sk-or-v1-abc...\nsk-or-v1-def...\nsk-or-v1-ghi..."} rows={4} />
          <span className="field-help">Paste satu kunci per baris. Duplikat otomatis dilewati. Kunci langsung aktif tanpa uji.</span>
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy !== null || !bulkKeys.trim()} onClick={addBulk}>{busy === "bulk" ? "Menyimpan…" : "Simpan semua kunci"}</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ai-key-input">Atau tambah satu kunci (dengan uji)</label>
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
        <div className="actions">
          <button type="button" className="btn" disabled={busy !== null || !apiKey.trim()} onClick={add}>{busy === "add" ? "Menguji ke OpenRouter…" : "Tambah dan uji kunci"}</button>
        </div>
      </section>

      <details className="ai-setup-section" open={Boolean(status.openRouterModel)}>
        <summary><span><strong>02</strong> Model OpenRouter</span><small>{status.openRouterModel || "Belum dipilih"}{status.freeModelCount > 0 ? ` · ${status.freeModelCount} gratis cadangan` : ""}</small></summary>
        <div className="ai-setup-content">
          <div className="model-picker">
            <div className="model-picker-toolbar">
              <input id="ai-model-input" className="model-picker-search" type="text" autoComplete="off" spellCheck={false} value={candidate || modelQuery} onChange={(e) => { setModel(e.target.value); setModelQuery(e.target.value); }} placeholder={status.openRouterModel || "Ketik atau cari nama model…"} aria-label="Nama model" />
              <button type="button" className="btn" disabled={busy !== null} onClick={() => void loadModels()} title="Ambil daftar dari OpenRouter">{busy === "models" ? "Mengambil…" : <><Download size={15} aria-hidden="true" /> Import dari /models</>}</button>
            </div>
            {catalogue && (
              <div className="model-picker-filters">
                <span className="model-picker-count">{catalogue.models.length} model · {catalogue.freeIds.size} gratis</span>
                <button type="button" className={`btn btn-sm${freeOnly ? " btn-active" : ""}`} onClick={() => { setFreeOnly((v) => !v); setModelQuery(""); }}>{freeOnly ? "✓ Gratis" : "Gratis saja"}</button>
                {modelQuery && <button type="button" className="btn btn-sm btn-quiet" onClick={() => { setModelQuery(""); setModel(""); }}>Hapus pencarian</button>}
              </div>
            )}
            {visibleModels.length > 0 && (
              <ul className="model-picker-list" role="listbox" aria-label="Daftar model">
                {visibleModels.slice(0, MODEL_BATCH).map((id) => (
                  <li key={id} role="option" aria-selected={candidate === id} className={`model-picker-item${candidate === id ? " is-selected" : ""}`} onClick={() => { setModel(id); setModelQuery(""); }}>
                    <span className="model-picker-id">{id}</span>
                    {catalogue?.freeIds.has(id) && <span className="model-picker-free">gratis</span>}
                  </li>
                ))}
                {visibleModels.length > MODEL_BATCH && <li className="model-picker-more">+{visibleModels.length - MODEL_BATCH} lainnya — ketik untuk menyaring</li>}
              </ul>
            )}
            {catalogue && visibleModels.length === 0 && <p className="model-picker-empty">Tidak ada model yang cocok.</p>}
          </div>
          {notice?.scope === "model" && (
            <div className={notice.tone === "success" ? "notice notice-success" : "notice notice-error"} role={notice.tone === "success" ? "status" : "alert"}>
              {notice.tone === "success" ? <CircleCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
              <span>{notice.text}</span>
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy !== null || !candidate} onClick={saveModel}>{busy === "model" ? "Menyimpan…" : "Simpan model"}</button>
          </div>
          <span className="field-help">Gunakan nama persis dari katalog OpenRouter, termasuk prefix — misal <code>qwen/qwen3-32b</code>.</span>
        </div>
      </details>

      <AiPaidProviders status={status} busy={busy} notice={notice} call={(body, kind) => call("POST", body, kind)} setNotice={setNotice} />

      {notice && !notice.scope && (
        <div className={notice.tone === "success" ? "notice notice-success" : "notice notice-error"} role={notice.tone === "success" ? "status" : "alert"}>
          {notice.tone === "success" ? <CircleCheck size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn" disabled={busy !== null || (!status.configured && !status.testMode)} onClick={check}>{busy === "check" ? "Memeriksa…" : "Cek koneksi sumber aktif"}</button>
        {hasDashboard && confirm !== "all" && <button type="button" className="btn btn-quiet" disabled={busy !== null} onClick={() => setConfirm("all")}>Hapus semua kunci dashboard</button>}
      </div>

      {confirm === "all" && (
        <div className="notice notice-warn" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <div className="stack-sm">
            <span>Semua kunci OpenRouter dan penyedia berbayar dari dashboard dihapus, dan aplikasi kembali memakai kunci dari server, kalau ada. Lanjutkan?</span>
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
