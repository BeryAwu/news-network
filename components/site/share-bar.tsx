"use client";

import { useState } from "react";

/** Brand glyphs drawn inline (24×24) so sharing needs no third-party script or image. */
const ICONS = {
  whatsapp: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3z",
  facebook: "M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V22h3.4z",
  x: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.2L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z",
  telegram: "M21.5 3.6L2.9 10.8c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.3 4.9 3.6c.9.5 1.5.2 1.8-.8l3.2-15.1c.3-1.3-.5-1.9-1.8-1.6zM8.6 13.4l9.6-6c.5-.3.9-.1.5.2l-8.1 7.3-.3 3.4-1.7-4.9z",
  link: "M10.6 13.4a4 4 0 0 0 5.7 0l3.5-3.5a4 4 0 0 0-5.7-5.7l-1.2 1.2 1.4 1.4 1.2-1.2a2 2 0 1 1 2.9 2.9l-3.5 3.5a2 2 0 0 1-2.9 0l-1.4 1.4zm2.8-2.8a4 4 0 0 0-5.7 0l-3.5 3.5a4 4 0 1 0 5.7 5.7l1.2-1.2-1.4-1.4-1.2 1.2a2 2 0 1 1-2.9-2.9l3.5-3.5a2 2 0 0 1 2.9 0l1.4-1.4z",
};

function Glyph({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={d} /></svg>;
}

/** Share to the networks Indonesian readers use most, plus copying the link. */
export default function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { key: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
  ] as const;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Salin tautan berita ini:", url);
    }
  }

  return (
    <div className="site-share" role="group" aria-label="Bagikan berita">
      <span className="site-share-label">Bagikan</span>
      {links.map((link) => (
        <a key={link.key} className={`site-share-btn is-${link.key}`} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`Bagikan ke ${link.label}`} title={link.label}>
          <Glyph d={ICONS[link.key]} />
        </a>
      ))}
      <button type="button" className="site-share-btn is-link" onClick={copy} aria-label="Salin tautan" title="Salin tautan">
        <Glyph d={ICONS.link} />
      </button>
      <span className="site-share-status" role="status">{copied ? "Tautan disalin" : ""}</span>
    </div>
  );
}
