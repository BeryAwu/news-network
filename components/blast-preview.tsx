import Image from "next/image";
import type { BlastAsset, BlastContent } from "@/lib/blast-types";

function Picture({ asset }: { asset: BlastAsset }) {
  const caption = [asset.caption, asset.credit ? `Foto: ${asset.credit}` : ""].filter(Boolean).join(". ");
  return (
    <figure className="bl-figure">
      <Image src={asset.secureUrl} alt={asset.altText || asset.caption || ""} width={asset.width > 0 ? asset.width : 1200} height={asset.height > 0 ? asset.height : 800} sizes="(max-width: 52rem) 100vw, 52rem" unoptimized />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** The berita as readers see it: title, main picture with caption, text in paragraphs, extra pictures, tags. */
export function BlastPreview({ content, authorName }: { content: BlastContent; authorName: string }) {
  const paragraphs = content.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return (
    <article className="bl-preview" aria-label="Tampilan berita untuk pembaca">
      <h2 className="bl-preview-title">{content.title}</h2>
      <p className="bl-byline">Oleh {authorName}</p>
      {content.featured && <Picture asset={content.featured} />}
      {content.excerpt && <p className="bl-lead">{content.excerpt}</p>}
      <div className="bl-body">
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      {content.gallery.length > 0 && (
        <ul className="bl-gallery" aria-label="Foto tambahan">
          {content.gallery.map((asset) => <li key={asset.id}><Picture asset={asset} /></li>)}
        </ul>
      )}
      {content.tags.length > 0 && (
        <ul className="bl-tags" aria-label="Kata kunci">
          {content.tags.map((tag) => <li key={tag}><span className="badge">{tag}</span></li>)}
        </ul>
      )}
    </article>
  );
}

/** What the operator typed in the first step, kept untouched. */
export function OriginalNarrative({ text, open = false }: { text: string; open?: boolean }) {
  if (!text.trim()) return null;
  return (
    <details className="card bl-details" open={open}>
      <summary>Narasi asli saya</summary>
      <p className="bl-narrative">{text}</p>
    </details>
  );
}
