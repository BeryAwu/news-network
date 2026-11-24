"use client";

import "@/app/css/ai-key.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CircleAlert, CircleCheck, Download, Eye, EyeOff, KeyRound, RotateCcw, Trash2 } from "lucide-react";
import type { AiKeyStatus, AiKeyView } from "@/lib/ai-status";

interface CheckResult { label: string; limit: number | null; remaining: number | null }
type Notice = { tone: "success" | "error"; text: string; inModel?: boolean } | null;

interface ModelCatalogue { baseUrl: string; models: string[]; freeIds: Set<string> }
const MODEL_BATCH = 24;

const PROVIDERS: { value: string; label: string; defaultBaseUrl: string; hint: string }[] = [
  { value: "openrouter", label: "OpenRouter", defaultBaseUrl: "https://openrouter.ai/api/v1", hint: "Salin dari openrouter.ai/settings/keys." },
  { value: "openai-compatible", label: "OpenAI-compatible (ngodeai, LiteLLM, dll.)", defaultBaseUrl: "https://llm.ngodeai.net/v1", hint: "Gunakan base URL dari dashboard penyedia." },
  { value: "openai", label: "OpenAI", defaultBaseUrl: "https://api.openai.com/v1", hint: "Salin dari platform.openai.com/api-keys." },
];

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

export default function AiKeyForm({ initial }: { initial: AiKeyStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState(initial.provider || "openrouter");
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl || "");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [catalogue, setCatalogue] = useState<ModelCatalogue | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [keyModels, setKeyModels] = useState<Record<string, string>>({});
  const [bulkKeys, setBulkKeys] = useState("");

  const providerMeta = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];
  const effectiveBaseUrl = baseUrl.trim() || providerMeta.defaultBaseUrl;
  const currentCatalogue = catalogue?.baseUrl === effectiveBaseUrl ? catalogue : null;
  const query = modelQuery.trim().toLowerCase();
  const visibleModels = currentCatalogue
    ? currentCatalogue.models
        .filter((id) => (!freeOnly || currentCatalogue.freeIds.has(id)) && id.toLowerCase().includes(query))
        .sort((a, b) => Number(currentCatalogue.freeIds.has(b)) - Number(currentCatalogue.freeIds.has(a)))
    : [];
  const candidate = model.trim();

  async function call(method: "POST" | "DELETE", body: unknown, kind: string) {
    const inModel = kind === "models" || kind === "model";
    setBusy(kind);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/ai", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setNotice({ tone: "error", text: await failureText(response), inModel }); return null; }
      const data = await response.json() as { status?: AiKeyStatus; check?: CheckResult; models?: string[]; freeModels?: string[] };
      if (data.status) {
        setStatus(data.status);
        router.refresh();
      }
      return data;
    } catch {
      setNotice({ tone: "error", text: "Tidak bisa terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.", inModel });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveProvider() {
    const data = await call("POST", { action: "provider", provider, baseUrl: effectiveBaseUrl }, "provider");
    if (data) setNotice({ tone: "success", text: `Penyedia disimpan: ${providerMeta.label} · ${effectiveBaseUrl}` });
  }

  async function addBulk() {
    const keys = bulkKeys.split(/[\n,]+/).map((k) => k.trim()).filter((k) => k.length >= 20);
    if (!keys.length) { setNotice({ tone: "error", text: "Tidak ada kunci yang valid. Paste satu kunci per baris." }); return; }
    const data = await call("POST", { action: "bulk", apiKeys: keys }, "bulk");
    if (data) {
      setBulkKeys("");
      const added = (data as { added?: number }).added ?? 0;
      setNotice({ tone: "success", text: `${added} kunci baru ditambahkan${added < keys.length ? `, ${keys.length - added} sudah ada sebelumnya` : ""}.` });
    }
  }

  async function add() {
    if (!apiKey.trim()) { setNotice({ tone: "error", text: "Tempel kunci API dulu." }); return; }
    const data = await call("POST", { action: "add", apiKey: apiKey.trim(), label: label.trim(), baseUrl: effectiveBaseUrl, model: model.trim() || undefined }, "add");
    if (!data) return;
    setApiKey("");
    setLabel("");
    setNotice({ tone: "success", text: `Kunci ditambahkan setelah lolos uji. ${data.check ? creditText(data.check) : ""}` });
  }

  async function loadModels() {
    const data = await call("POST", { action: "models", baseUrl: effectiveBaseUrl, apiKey: apiKey.trim() || undefined }, "models");
    if (data?.models) {
      const freeList: string[] = data.freeModels ?? [];
      setCatalogue({ baseUrl: effectiveBaseUrl, models: data.models, freeIds: new Set(freeList) });
      const freeCount = freeList.length;
      setNotice({ tone: "success", text: `${data.models.length} model terbaca${freeCount ? ` · ${freeCount} gratis` : ""}.`, inModel: true });
    }
  }

  async function saveModel() {
    if (!model.trim()) { setNotice({ tone: "error", text: "Isi nama model dulu." }); return; }
    const data = await call("POST", { action: "model", model: model.trim() }, "model");
    if (data) { setModel(""); setNotice({ tone: "success", text: "Model disimpan." }); }
  }

  async function refreshFreeModels() {
    const data = await call("POST", { action: "freemodels" }, "freemodels");
    if (data) setNotice({ tone: "success", text: `${(data as { freeCount?: number }).freeCount ?? 0} model gratis tersimpan. Sistem akan otomatis rotasi saat model utama lambat atau penuh.` });
  }

  async function saveKeyModel(key: AiKeyView) {
    const m = (keyModels[key.id] ?? "").trim();
    if (!m) return;
    const data = await call("POST", { action: "keymodel", id: key.id, model: m }, `keymodel:${key.id}`);
    if (data) setNotice({ tone: "success", text: `Model untuk kunci "${key.label || key.hint}" disimpan: ${m}` });
  }

  async function check() {
    const data = await call("POST", { action: "check" }, "check");
    if (data?.check) setNotice({ tone: "success", text: `Tersambung. Kunci yang dipakai sekarang berfungsi. ${creditText(data.check)}` });
    else if (data) setNotice({ tone: "success", text: "Tersambung. Kunci yang dipakai sekarang berfungsi." });
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
    if (data) setNotice({ tone: "success", text: data.status?.source === "env" ? "Semua kunci dashboard dihapus. Aplikasi kembali memakai kunci dari server." : "Semua kunci dashboard dihapus. Pasang kunci baru agar penulisan AI bisa dipakai." });
  }

  const hasReady = status.keys.some((key) => !key.unreadable && key.status !== "rejected");
  const unreadable = status.keys.some((key) => key.unreadable);

  return (
    <section className="card stack ai-key" aria-labelledby="ai-key-title">
      <div className="stack-sm">
        <h2 id="ai-key-title"><KeyRound size={22} aria-hidden="true" /> Kunci AI</h2>
        <p className="muted">Pilih penyedia dan tambahkan kunci API. Kalau kredit satu kunci habis atau kena batas, aplikasi otomatis pindah ke kunci berikutnya. Anda tidak perlu menyentuh pengaturan server.</p>
      </div>

      <dl className="ai-key-status">
        <div><dt>Penyedia</dt><dd>{status.provider || "belum dipilih"}</dd></div>
        <div><dt>Base URL</dt><dd>{status.baseUrl || "belum disetel"}</dd></div>
        <div><dt>Model</dt><dd>{status.model || "belum dipilih"}</dd></div>
        <div><dt>Kunci cadangan dari server</dt><dd>{status.envKey ? "Ada, dipakai paling akhir" : "Tidak ada"}</dd></div>
        {status.testMode && <div><dt>Mode</dt><dd>Mode uji (bukan AI sungguhan)</dd></div>}
      </dl>

      {unreadable && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Ada kunci yang tidak bisa dibaca lagi (kunci rahasia server berubah). Hapus kunci itu lalu tempel lagi.</span></div>}
      {!hasReady && !status.envKey && !status.testMode && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Belum ada kunci yang bisa dipakai. Penulisan AI belum berjalan sampai Anda menambah kunci.</span></div>}

      <details className="ai-setup-section" open={!status.provider}>
        <summary><span><strong>01</strong> Penyedia API</span><small>{status.provider || "Belum disetel"}</small></summary>
        <div className="stack-sm ai-setup-content">
          <div className="field">
            <label htmlFor="ai-provider-select">Penyedia</label>
            <select id="ai-provider-select" value={provider} onChange={(e) => { setProvider(e.target.value); setBaseUrl(""); }}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ai-base-url-input">Base URL</label>
            <input id="ai-base-url-input" type="url" autoComplete="off" spellCheck={false} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={providerMeta.defaultBaseUrl} />
            <span className="field-help">Kosongkan untuk memakai default: <code>{providerMeta.defaultBaseUrl}</code></span>
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={busy !== null} onClick={saveProvider}>{busy === "provider" ? "Menyimpan…" : "Simpan penyedia"}</button>
          </div>
        </div>
      </details>

      <section className="ai-setup-section ai-key-entry" aria-labelledby="ai-key-entry-title">
        <div className="ai-setup-section-heading"><div><h3 id="ai-key-entry-title"><strong>02</strong> Kunci API</h3><p>Kunci dipakai bergantian otomatis per request (round-robin). Tambah banyak kunci sekaligus untuk menghindari limit.</p></div><span>{status.keys.length} tersimpan</span></div>
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
                  placeholder={status.model || "Model (opsional, kosong = pakai global)"}
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
          <input id="ai-key-input" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={providerMeta.hint.split(".")[0] + "…"} />
          <button type="button" className="password-toggle" aria-label={show ? "Sembunyikan kunci" : "Tampilkan kunci"} aria-pressed={show} onClick={() => setShow((value) => !value)}>
            {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
        <span className="field-help">{providerMeta.hint} Kunci baru masuk daftar paling bawah setelah lolos uji.</span>
      </div>
      <div className="field">
        <label htmlFor="ai-key-label">Nama kunci (opsional)</label>
        <input id="ai-key-label" type="text" autoComplete="off" maxLength={40} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Contoh: Akun cadangan" />
      </div>
      </section>

      <details className="ai-setup-section" open={Boolean(status.model)}>
        <summary><span><strong>03</strong> Model</span><small>{status.model ? status.model : status.freeModelCount > 0 ? `Otomatis (${status.freeModelCount} model gratis)` : "Belum dipilih"}</small></summary>
        <div className="ai-setup-content">
          <div className="model-picker">
            <div className="model-picker-toolbar">
              <input id="ai-model-input" className="model-picker-search" type="text" autoComplete="off" spellCheck={false} value={candidate || modelQuery} onChange={(e) => { setModel(e.target.value); setModelQuery(e.target.value); }} placeholder={status.model || "Ketik atau cari nama model…"} aria-label="Nama model" />
              <button type="button" className="btn" disabled={busy !== null} onClick={() => void loadModels()} title="Ambil daftar dari penyedia">{busy === "models" ? "Mengambil…" : <><Download size={15} aria-hidden="true" /> Import dari /models</>}</button>
            </div>
            {currentCatalogue && (
              <div className="model-picker-filters">
                <span className="model-picker-count">{currentCatalogue.models.length} model · {currentCatalogue.freeIds.size} gratis</span>
                <button type="button" className={`btn btn-sm${freeOnly ? " btn-active" : ""}`} onClick={() => { setFreeOnly((v) => !v); setModelQuery(""); }}>{freeOnly ? "✓ Gratis" : "Gratis saja"}</button>
                {modelQuery && <button type="button" className="btn btn-sm btn-quiet" onClick={() => { setModelQuery(""); setModel(""); }}>Hapus pencarian</button>}
              </div>
            )}
            {visibleModels.length > 0 && (
              <ul className="model-picker-list" role="listbox" aria-label="Daftar model">
                {visibleModels.slice(0, MODEL_BATCH).map((id) => (
                  <li key={id} role="option" aria-selected={candidate === id} className={`model-picker-item${candidate === id ? " is-selected" : ""}`} onClick={() => { setModel(id); setModelQuery(""); }}>
                    <span className="model-picker-id">{id}</span>
                    {currentCatalogue?.freeIds.has(id) && <span className="model-picker-free">gratis</span>}
                  </li>
                ))}
                {visibleModels.length > MODEL_BATCH && <li className="model-picker-more">+{visibleModels.length - MODEL_BATCH} lainnya — ketik untuk menyaring</li>}
              </ul>
            )}
            {currentCatalogue && visibleModels.length === 0 && <p className="model-picker-empty">Tidak ada model yang cocok.</p>}
          </div>
          {notice?.inModel && (
            <div className={notice.tone === "success" ? "notice notice-success" : "notice notice-error"} role={notice.tone === "success" ? "status" : "alert"}>
              {notice.tone === "success" ? <CircleCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
              <span>{notice.text}</span>
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy !== null || !candidate} onClick={saveModel}>{busy === "model" ? "Menyimpan…" : "Simpan model"}</button>
            <button type="button" className="btn" disabled={busy !== null} onClick={refreshFreeModels}>{busy === "freemodels" ? "Mengambil…" : `Perbarui model gratis${status.freeModelCount > 0 ? ` (${status.freeModelCount})` : ""}`}</button>
          </div>
          <span className="field-help">Gunakan nama persis dari katalog penyedia, termasuk prefix — misal <code>ngodeai/glm-5.3-flash</code>.</span>
        </div>
      </details>

      {notice && (
        <div className={notice.tone === "success" ? "notice notice-success" : "notice notice-error"} role={notice.tone === "success" ? "status" : "alert"}>
          {notice.tone === "success" ? <CircleCheck size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={add}>{busy === "add" ? "Menguji ke penyedia…" : "Tambah dan uji kunci"}</button>
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
