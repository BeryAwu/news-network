"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Switch from "@/components/switch";
import { asFailure, failure, readBody } from "@/components/plain-errors";

export default function UserToggle({ userId, status, name }: { userId: string; status: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = status === "ACTIVE";

  async function toggle() {
    const question = active
      ? `Nonaktifkan akun ${name}? Orang ini langsung tidak bisa masuk. Naskah dan riwayat kerjanya tetap ada, dan Anda bisa mengaktifkannya lagi kapan saja.`
      : `Aktifkan akun ${name}? Orang ini bisa masuk lagi dengan peran dan akses media yang sama seperti sebelumnya.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, action: active ? "disable" : "enable" }) });
      const result = await readBody(response);
      if (!response.ok) throw failure(response.status, result, {}, "Status akun belum berubah. Coba lagi sebentar lagi.");
      router.refresh();
    } catch (e) {
      setError(asFailure(e, "Status akun belum berubah. Coba lagi sebentar lagi.").message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-sm">
      <Switch checked={active} onChange={toggle} disabled={busy} label={busy ? "Menyimpan…" : active ? "Boleh masuk" : "Tidak bisa masuk"} ariaLabel={`Izin masuk untuk ${name}: ${active ? "boleh masuk" : "tidak bisa masuk"}`} />
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>
  );
}
