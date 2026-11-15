"use client";

import "@/app/css/switch.css";

/** A real on/off switch: a button with role="switch". The visible label is part of the hit target. */
export default function Switch({ checked, onChange, disabled = false, label, ariaLabel, describedBy }: { checked: boolean; onChange: () => void; disabled?: boolean; label: React.ReactNode; ariaLabel?: string; describedBy?: string }) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={ariaLabel} aria-describedby={describedBy} disabled={disabled} onClick={onChange}>
      <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
      <span>{label}</span>
    </button>
  );
}
