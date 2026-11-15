"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies `value` and confirms in words, so the result is clear without relying on the icon. */
export default function CopyButton({ value, label = "Salin" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Salin teks ini:", value);
    }
  }
  return (
    <button type="button" className="btn btn-sm" onClick={copy} aria-live="polite">
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {copied ? "Tersalin" : label}
    </button>
  );
}
