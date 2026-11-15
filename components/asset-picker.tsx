"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";

type PickerArticle = { id: string; title: string; mediaSite: { id: string; displayName: string } };
type PickerAsset = { id: string; mediaSiteId: string | null; secureUrl: string; altText: string; format: string; bytes: number; mediaSite: { displayName: string } | null };

export default function AssetPicker({ articles, assets }: { articles: PickerArticle[]; assets: PickerAsset[] }) {
  const router = useRouter();
  const [articleId, setArticleId] = useState(articles[0]?.id || "");
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const current = articles.find((article) => article.id === articleId);
  const options = assets.filter((asset) => asset.mediaSiteId === current?.mediaSite.id);

  async function assign() {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/assets/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ articleId, assetId: assetId || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gambar belum bisa dipasang ke naskah.");
      setDone(assetId ? "Gambar terpasang. Naskah mendapat versi baru, jadi perlu diperiksa lagi sebelum terbit." : "Gambar dilepas dari naskah. Naskah mendapat versi baru.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gambar belum bisa dipasang ke naskah.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card stack" id="pasang" aria-labelledby="picker-title">
    <div className="stack-sm">
      <h2 id="picker-title">Pasang gambar ke naskah</h2>
      <p className="muted">Pilih naskah, lalu gambar dari media yang sama. Memasang gambar membuat versi baru naskah.</p>
    </div>
    {articles.length === 0 ? <p className="muted">Belum ada naskah draf, perlu diperiksa, atau siap terbit yang bisa diberi gambar.</p> : <>
      <div className="grid-2">
        <div className="field"><label htmlFor="picker-article">Naskah</label><select id="picker-article" value={articleId} onChange={(event) => { setArticleId(event.target.value); setAssetId(""); setDone(""); }}><option value="">Pilih naskah</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.title} ({article.mediaSite.displayName})</option>)}</select></div>
        <div className="field"><label htmlFor="picker-asset">Gambar</label><select id="picker-asset" value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">Tanpa gambar</option>{options.map((asset) => <option key={asset.id} value={asset.id}>{asset.altText || asset.format} ({Math.round(asset.bytes / 1024)} KB)</option>)}</select>{articleId && options.length === 0 && <span className="field-help">Media naskah ini belum punya gambar di pustaka.</span>}</div>
      </div>
      {error && <div role="alert" className="notice notice-error"><CircleAlert size={20} aria-hidden="true"/><span>{error}</span></div>}
      {done && <div role="status" className="notice notice-success"><CircleCheck size={20} aria-hidden="true"/><span>{done}</span></div>}
      <div><button type="button" disabled={busy || !articleId} onClick={assign} className="btn btn-primary">{busy ? "Menyimpan…" : assetId ? "Pasang gambar" : "Lepas gambar dari naskah"}</button></div>
    </>}
  </section>;
}
