"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies only the addresses, one per line. When the browser blocks the clipboard the text is shown selected so the user can copy it by hand. */
async function writeToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let done = false;
    try {
      done = document.execCommand("copy");
    } catch {
      done = false;
    }
    area.remove();
    return done;
  }
}

export default function BlastCopyLinks({ urls }: { urls: string[] }) {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const area = useRef<HTMLTextAreaElement>(null);
  const text = urls.join("\n");

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (blocked) area.current?.select(); }, [blocked]);

  async function copy() {
    clearTimeout(timer.current);
    if (await writeToClipboard(text)) {
      setBlocked(false);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 4000);
    } else {
      setCopied(false);
      setBlocked(true);
    }
  }

  return (
    <div className="bl-copy">
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => void copy()} disabled={urls.length === 0}>
          {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
          {copied ? "Tersalin" : "Salin semua link"}
        </button>
        <span role="status" aria-live="polite" className={copied ? "field-help" : "visually-hidden"}>
          {copied ? `${urls.length} link sudah tersalin. Tempel di mana saja dengan tombol tempel.` : ""}
        </span>
      </div>
      {blocked && (
        <div className="field">
          <label htmlFor="bl-copy-fallback">Browser Anda tidak mengizinkan salin otomatis</label>
          <textarea id="bl-copy-fallback" ref={area} readOnly value={text} onFocus={(event) => event.currentTarget.select()} aria-describedby="bl-copy-fallback-help" />
          <span id="bl-copy-fallback-help" className="field-help">Semua link sudah terpilih di kotak ini. Tahan jari atau tekan Ctrl+C untuk menyalinnya.</span>
        </div>
      )}
    </div>
  );
}
