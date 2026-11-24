"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Download, Eye, EyeOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { AiKeyStatus, PaidProviderView } from "@/lib/ai-status";

export type Notice = { tone: "success" | "error"; text: string; scope?: "model" | "paid" } | null;
type CallResult = { status?: AiKeyStatus; models?: string[] } | null;

interface Props {
  status: AiKeyStatus;
  busy: string | null;
  notice: Notice;
  call: (body: unknown, kind: string) => Promise<CallResult>;
  setNotice: (notice: Notice) => void;
}

const when = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function paidState(provider: PaidProviderView, active: boolean) {
  if (provider.unreadable) return { tone: "bad", text: "Kunci tidak bisa dibaca. Hapus lalu tambahkan lagi." };
  if (provider.status === "rejected") return { tone: "bad", text: "Kunci ditolak penyedia. Hapus lalu tambahkan kunci baru." };
  if (provider.status === "cooldown" && provider.cooldownUntil && new Date(provider.cooldownUntil) > new Date()) return { tone: "warn", text: `${provider.lastError || "Istirahat"}. Dicoba lagi ${when.format(new Date(provider.cooldownUntil))}.` };
  return { tone: "ok", text: active ? "Sumber aktif" : "Cadangan, dipakai kalau sumber aktif gagal" };
}

/** Paid OpenAI-compatible providers: each has its own base URL, one key, and a model the owner types. */
export default function AiPaidProviders({ status, busy, notice, call, setNotice }: Props) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [editModels, setEditModels] = useState<Record<string, string>>({});

  const ready = name.trim().length >= 2 && baseUrl.trim() && apiKey.trim() && model.trim();

  async function fetchModels(target: string, body: Record<string, unknown>) {
    const data = await call({ action: "models", ...body }, `paid-models:${target}`);
    if (data?.models) {
      setModels((prev) => ({ ...prev, [target]: data.models as string[] }));
      setNotice({ tone: "success", text: `${data.models.length} model terbaca. Pilih dari saran saat mengetik nama model.`, scope: "paid" });
    }
  }

  async function add() {
    const data = await call({ action: "paid-add", name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() }, "paid-add");
    if (!data) return;
    setName(""); setBaseUrl(""); setApiKey(""); setModel("");
    setNotice({ tone: "success", text: `Penyedia "${name.trim()}" ditambahkan setelah lolos uji.${data.status?.active.startsWith("paid:") ? " Sekarang jadi sumber aktif." : " Pilih sebagai sumber aktif di atas kalau mau dipakai duluan."}`, scope: "paid" });
  }

  async function saveModel(provider: PaidProviderView) {
    const next = (editModels[provider.id] ?? "").trim();
    if (!next) return;
    const data = await call({ action: "paid-model", id: provider.id, model: next }, `paid-model:${provider.id}`);
    if (data) {
      setEditModels((prev) => { const rest = { ...prev }; delete rest[provider.id]; return rest; });
      setNotice({ tone: "success", text: `Model ${provider.name} diganti ke ${next}.`, scope: "paid" });
    }
  }

  async function act(action: "paid-remove" | "paid-reset", provider: PaidProviderView) {
    setConfirm(null);
    const data = await call({ action, id: provider.id }, `${action}:${provider.id}`);
    if (data) setNotice({ tone: "success", text: action === "paid-remove" ? `Penyedia ${provider.name} dihapus.` : `${provider.name} dimasukkan lagi ke giliran.`, scope: "paid" });
  }

  return (
    <section className="ai-setup-section ai-key-entry" aria-labelledby="ai-paid-title">
      <div className="ai-setup-section-heading">
        <div>
          <h3 id="ai-paid-title">Penyedia berbayar</h3>
          <p>API di luar OpenRouter (OpenAI, DeepSeek, proxy sendiri, dll.). Satu kunci per penyedia, model diketik sendiri.</p>
        </div>
        <span>{status.paid.length} tersimpan</span>
      </div>

      {status.paid.length > 0 && <ul className="ai-key-list" aria-label="Daftar penyedia berbayar">
        {status.paid.map((provider) => {
          const state = paidState(provider, status.active === `paid:${provider.id}`);
          const listId = `paid-models-${provider.id}`;
          const draft = editModels[provider.id] ?? provider.model;
          return <li key={provider.id} className="ai-key-item">
            <div className="ai-key-main">
              <strong>{provider.name}</strong>
              <span className="muted">{provider.baseUrl} · kunci berakhir …{provider.hint}</span>
              <span className={`ai-key-state ai-key-${state.tone}`}>{state.text}</span>
            </div>
            <div className="ai-key-model-row">
              <input type="text" className="ai-key-model-input" list={listId} autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setEditModels((prev) => ({ ...prev, [provider.id]: e.target.value }))} aria-label={`Model untuk ${provider.name}`} />
              <datalist id={listId}>{(models[provider.id] ?? []).map((m) => <option key={m} value={m} />)}</datalist>
              <button type="button" className="btn btn-sm" disabled={busy !== null || provider.unreadable} onClick={() => void fetchModels(provider.id, { paidId: provider.id })} title="Ambil daftar model dari penyedia">{busy === `paid-models:${provider.id}` ? "Mengambil…" : <><Download size={15} aria-hidden="true" /> Daftar</>}</button>
              <button type="button" className="btn btn-sm" disabled={busy !== null || !draft.trim() || draft.trim() === provider.model} onClick={() => saveModel(provider)}>{busy === `paid-model:${provider.id}` ? "Menyimpan…" : "Simpan"}</button>
            </div>
            <div className="actions">
              {provider.status !== "ok" && !provider.unreadable && <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => act("paid-reset", provider)}><RotateCcw size={16} aria-hidden="true" />Coba lagi</button>}
              {confirm === provider.id
                ? <><button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => act("paid-remove", provider)}>Ya, hapus</button><button type="button" className="btn btn-sm" onClick={() => setConfirm(null)}>Batal</button></>
                : <button type="button" className="btn btn-quiet btn-sm" disabled={busy !== null} onClick={() => setConfirm(provider.id)}><Trash2 size={16} aria-hidden="true" />Hapus</button>}
            </div>
          </li>;
        })}
      </ul>}

      <div className="ai-paid-form">
        <div className="field">
          <label htmlFor="ai-paid-name">Nama penyedia</label>
          <input id="ai-paid-name" type="text" autoComplete="off" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: DeepSeek" />
        </div>
        <div className="field">
          <label htmlFor="ai-paid-url">Base URL</label>
          <input id="ai-paid-url" type="url" autoComplete="off" spellCheck={false} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" />
          <span className="field-help">Alamat API yang kompatibel dengan OpenAI, biasanya berakhiran <code>/v1</code>.</span>
        </div>
        <div className="field">
          <label htmlFor="ai-paid-key">Kunci API</label>
          <div className="password-wrap">
            <input id="ai-paid-key" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Salin dari dashboard penyedia…" />
            <button type="button" className="password-toggle" aria-label={show ? "Sembunyikan kunci" : "Tampilkan kunci"} aria-pressed={show} onClick={() => setShow((v) => !v)}>
              {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ai-paid-model">Model</label>
          <div className="ai-key-model-row">
            <input id="ai-paid-model" type="text" className="ai-key-model-input" list="paid-models-new" autoComplete="off" spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Contoh: deepseek-chat" />
            <datalist id="paid-models-new">{(models.new ?? []).map((m) => <option key={m} value={m} />)}</datalist>
            <button type="button" className="btn btn-sm" disabled={busy !== null || !baseUrl.trim() || !apiKey.trim()} onClick={() => void fetchModels("new", { baseUrl: baseUrl.trim(), apiKey: apiKey.trim() })}>{busy === "paid-models:new" ? "Mengambil…" : <><Download size={15} aria-hidden="true" /> Ambil daftar model</>}</button>
          </div>
          <span className="field-help">Ketik nama model persis seperti di dashboard penyedia, atau ambil daftarnya dulu.</span>
        </div>
        {notice?.scope === "paid" && (
          <div className={notice.tone === "success" ? "notice notice-success" : "notice notice-error"} role={notice.tone === "success" ? "status" : "alert"}>
            {notice.tone === "success" ? <CircleCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
            <span>{notice.text}</span>
          </div>
        )}
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={busy !== null || !ready} onClick={add}>{busy === "paid-add" ? "Menguji ke penyedia…" : <><Plus size={16} aria-hidden="true" /> Tambah dan uji penyedia</>}</button>
        </div>
      </div>
    </section>
  );
}
